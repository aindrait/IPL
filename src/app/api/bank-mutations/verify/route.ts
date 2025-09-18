import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  extractPaymentIndexFromAmount,
  parseDescription,
  findBestNameMatch,
  calculateDateDifference,
  calculateMatchConfidence,
} from '@/lib/bank-mutation-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const year: number | undefined = body.year ? parseInt(String(body.year), 10) : undefined
    const month: number | undefined = body.month ? parseInt(String(body.month), 10) : undefined

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 })
    }

    // Load residents and aliases
    const residents = await (db as any).resident.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        payment_index: true,
        blok: true,
        house_number: true,
      },
    })

    const aliases = await (db as any).residentBankAlias.findMany({
      select: { resident_id: true, bank_name: true },
    })

    const residentAliasesMap = new Map<string, string[]>()
    for (const a of aliases) {
      const list = residentAliasesMap.get(a.resident_id) ?? []
      list.push(a.bank_name)
      residentAliasesMap.set(a.resident_id, list)
    }

    const paymentIndexMap = new Map<number, string>()
    for (const r of residents) {
      if (typeof r.payment_index === 'number') {
        paymentIndexMap.set(r.payment_index, r.id)
      }
    }

    const residentNameList = residents.map((r: any) => ({
      id: r.id,
      name: r.name,
      aliases: residentAliasesMap.get(r.id) || [],
    }))

    // Fetch unverified, positive amount (credits) for the month/year
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0, 23, 59, 59, 999)

    const items = await (db as any).bankMutation.findMany({
      where: {
        is_verified: false,
        amount: { gt: 0 },
        transaction_date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [{ transaction_date: 'desc' as const }],
    })

    let autoVerified = 0
    let matchedOnly = 0

    // Allow multiple base IPL amounts via env: IPL_BASE_AMOUNT can be comma-separated, e.g. "200000,250000"
    const baseCandidates: number[] = (process.env.IPL_BASE_AMOUNT || "200000,250000")
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)

    for (const bm of items) {
      try {
        const transaction_date = new Date(bm.transaction_date)

        // Strategy 1: Payment Index via amount remainder (try multiple base amounts)
        let payment_index: number | null = null
        for (const base of baseCandidates) {
          payment_index = extractPaymentIndexFromAmount(Number(bm.amount), base)
          if (payment_index) break
        }
        let matched_resident_id: string | null = null
        let matched_payment_id: string | null = null
        let match_score = 0
        let matching_strategy = 'NONE'

        if (payment_index && paymentIndexMap.has(payment_index)) {
          matched_resident_id = paymentIndexMap.get(payment_index)!
          matching_strategy = 'PAYMENT_INDEX'
          match_score = 0.9
          // Find close payment
          const matchingPayment = await (db as any).payment.findFirst({
            where: {
              resident_id: matched_resident_id,
              amount: bm.amount,
              payment_date: {
                gte: new Date(transaction_date.getTime() - 7 * 24 * 60 * 60 * 1000),
                lte: new Date(transaction_date.getTime() + 7 * 24 * 60 * 60 * 1000),
              },
            },
            orderBy: { payment_date: 'desc' },
          })
          if (matchingPayment) {
            matched_payment_id = matchingPayment.id
            match_score = 0.95
          }
        }

        // Strategy 2: Fuzzy name match from description, aliases
        if (!matched_resident_id && typeof bm.description === 'string' && bm.description.trim()) {
          const desc = parseDescription(bm.description)
          for (const name of desc.names) {
            const nameMatch = findBestNameMatch(name, residentNameList)
            if (nameMatch && nameMatch.similarity > 0.7) {
              matched_resident_id = nameMatch.resident_id
              matching_strategy = 'NAME_MATCH'
              // Confidence from factors
              const dateDiff = calculateDateDifference(transaction_date, transaction_date)
              const confidence = calculateMatchConfidence({
                paymentIndexMatch: false,
                amountMatch: true,
                dateProximity: dateDiff,
                nameMatch: nameMatch.similarity,
                descriptionMatch: 0.5,
              })
              match_score = Math.max(match_score, confidence)
              break
            }
          }
        }

        const isAuto = match_score >= 0.8 && matched_resident_id
        if (matched_resident_id) {
          matchedOnly++
        }

        if (matched_resident_id || isAuto) {
          await (db as any).bankMutation.update({
            where: { id: bm.id },
            data: {
              matched_resident_id: matched_resident_id ?? bm.matched_resident_id,
              matched_payment_id: matched_payment_id ?? bm.matched_payment_id,
              match_score: match_score || bm.match_score,
              matching_strategy: matching_strategy !== 'NONE' ? matching_strategy : bm.matching_strategy,
              is_verified: Boolean(isAuto) || bm.is_verified,
              verified_at: isAuto ? new Date() : bm.verified_at,
              verified_by: isAuto ? 'AUTO' : bm.verified_by,
            },
          })
          if (isAuto) autoVerified++
        }
      } catch (e) {
        // continue; do not block the batch
      }
    }

    return NextResponse.json({ ok: true, processed: items.length, matchedOnly, autoVerified })
  } catch (error) {
    console.error('Auto verify failed:', error)
    return NextResponse.json({ error: 'Auto verify failed' }, { status: 500 })
  }
}


