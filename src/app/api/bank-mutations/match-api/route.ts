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
      where: { is_active: true },
      select: { id: true, name: true }
    })

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

    let matched = 0
    let autoVerified = 0

    for (const bm of items) {
      try {
        const payload = {
          id: bm.id,
          amount: Number(bm.amount),
          description: String(bm.description || ''),
          date: new Date(bm.transaction_date).toISOString(),
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
        const resident_id: string | undefined = data.resident_id
        const confidence: number = typeof data.confidence === 'number' ? data.confidence : 0
        const payment_id: string | undefined = data.payment_id

        if (resident_id) {
          matched++
          const isAuto = confidence >= 0.9
          await (db as any).bankMutation.update({
            where: { id: bm.id },
            data: {
              matched_resident_id: resident_id,
              matched_payment_id: payment_id ?? bm.matched_payment_id,
              match_score: Math.max(confidence, bm.match_score ?? 0),
              matching_strategy: 'EXTERNAL_API',
              is_verified: isAuto || bm.is_verified,
              verified_at: isAuto ? new Date() : bm.verified_at,
              verified_by: isAuto ? 'API' : bm.verified_by,
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


