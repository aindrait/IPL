import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  parseDescription,
} from '@/lib/bank-mutation-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const year: number | undefined = body.year ? parseInt(String(body.year), 10) : undefined
    const month: number | undefined = body.month ? parseInt(String(body.month), 10) : undefined
    const overrideUrl: string | undefined = body.url

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Invalid year/month' }, { status: 400 })
    }

    const apiUrl = overrideUrl || process.env.EXTERNAL_MATCH_API_URL
    if (!apiUrl) {
      return NextResponse.json({ error: 'External match API not configured' }, { status: 400 })
    }

    // Fetch candidates: active residents, names and aliases (basic)
    const residents = await (db as any).resident.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    })

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

    let matched = 0
    let autoVerified = 0

    for (const bm of items) {
      try {
        const payload = {
          id: bm.id,
          amount: Number(bm.amount),
          description: String(bm.description || ''),
          date: new Date(bm.transactionDate).toISOString(),
          candidates: residents,
          hints: parseDescription(String(bm.description || '')),
        }

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) continue
        const data = await res.json().catch(() => ({} as any))
        const residentId: string | undefined = data.residentId
        const confidence: number = typeof data.confidence === 'number' ? data.confidence : 0
        const paymentId: string | undefined = data.paymentId

        if (residentId) {
          matched++
          const isAuto = confidence >= 0.9
          await (db as any).bankMutation.update({
            where: { id: bm.id },
            data: {
              matchedResidentId: residentId,
              matchedPaymentId: paymentId ?? bm.matchedPaymentId,
              matchScore: Math.max(confidence, bm.matchScore ?? 0),
              matchingStrategy: 'EXTERNAL_API',
              isVerified: isAuto || bm.isVerified,
              verifiedAt: isAuto ? new Date() : bm.verifiedAt,
              verifiedBy: isAuto ? 'API' : bm.verifiedBy,
            },
          })
          if (isAuto) autoVerified++
        }
      } catch {
        // continue
      }
    }

    return NextResponse.json({ ok: true, processed: items.length, matched, autoVerified })
  } catch (error) {
    console.error('Match via API failed:', error)
    return NextResponse.json({ error: 'Match via API failed' }, { status: 500 })
  }
}


