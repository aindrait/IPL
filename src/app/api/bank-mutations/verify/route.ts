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
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        paymentIndex: true,
        blok: true,
        houseNumber: true,
      },
    })

    const aliases = await (db as any).residentBankAlias.findMany({
      select: { residentId: true, bankName: true },
    })

    const residentAliasesMap = new Map<string, string[]>()
    for (const a of aliases) {
      const list = residentAliasesMap.get(a.residentId) ?? []
      list.push(a.bankName)
      residentAliasesMap.set(a.residentId, list)
    }

    const paymentIndexMap = new Map<number, string>()
    for (const r of residents) {
      if (typeof r.paymentIndex === 'number') {
        paymentIndexMap.set(r.paymentIndex, r.id)
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
        isVerified: false,
        amount: { gt: 0 },
        transactionDate: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [{ transactionDate: 'desc' as const }],
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
        const transactionDate = new Date(bm.transactionDate)

        // Strategy 1: Payment Index via amount remainder (try multiple base amounts)
        let paymentIndex: number | null = null
        for (const base of baseCandidates) {
          paymentIndex = extractPaymentIndexFromAmount(Number(bm.amount), base)
          if (paymentIndex) break
        }
        let matchedResidentId: string | null = null
        let matchedPaymentId: string | null = null
        let matchScore = 0
        let matchingStrategy = 'NONE'

        if (paymentIndex && paymentIndexMap.has(paymentIndex)) {
          matchedResidentId = paymentIndexMap.get(paymentIndex)!
          matchingStrategy = 'PAYMENT_INDEX'
          matchScore = 0.9
          // Find close payment
          const matchingPayment = await (db as any).payment.findFirst({
            where: {
              residentId: matchedResidentId,
              amount: bm.amount,
              paymentDate: {
                gte: new Date(transactionDate.getTime() - 7 * 24 * 60 * 60 * 1000),
                lte: new Date(transactionDate.getTime() + 7 * 24 * 60 * 60 * 1000),
              },
            },
            orderBy: { paymentDate: 'desc' },
          })
          if (matchingPayment) {
            matchedPaymentId = matchingPayment.id
            matchScore = 0.95
          }
        }

        // Strategy 2: Fuzzy name match from description, aliases
        if (!matchedResidentId && typeof bm.description === 'string' && bm.description.trim()) {
          const desc = parseDescription(bm.description)
          for (const name of desc.names) {
            const nameMatch = findBestNameMatch(name, residentNameList)
            if (nameMatch && nameMatch.similarity > 0.7) {
              matchedResidentId = nameMatch.residentId
              matchingStrategy = 'NAME_MATCH'
              // Confidence from factors
              const dateDiff = calculateDateDifference(transactionDate, transactionDate)
              const confidence = calculateMatchConfidence({
                paymentIndexMatch: false,
                amountMatch: true,
                dateProximity: dateDiff,
                nameMatch: nameMatch.similarity,
                descriptionMatch: 0.5,
              })
              matchScore = Math.max(matchScore, confidence)
              break
            }
          }
        }

        const isAuto = matchScore >= 0.8 && matchedResidentId
        if (matchedResidentId) {
          matchedOnly++
        }

        if (matchedResidentId || isAuto) {
          await (db as any).bankMutation.update({
            where: { id: bm.id },
            data: {
              matchedResidentId: matchedResidentId ?? bm.matchedResidentId,
              matchedPaymentId: matchedPaymentId ?? bm.matchedPaymentId,
              matchScore: matchScore || bm.matchScore,
              matchingStrategy: matchingStrategy !== 'NONE' ? matchingStrategy : bm.matchingStrategy,
              isVerified: Boolean(isAuto) || bm.isVerified,
              verifiedAt: isAuto ? new Date() : bm.verifiedAt,
              verifiedBy: isAuto ? 'AUTO' : bm.verifiedBy,
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


