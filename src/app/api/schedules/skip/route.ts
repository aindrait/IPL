import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const skipSchema = z.object({
  itemIds: z.array(z.string()).min(1, 'Pilih minimal satu item'),
  reason: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = skipSchema.parse(body)

    const items = await db.paymentScheduleItem.findMany({
      where: { id: { in: input.itemIds } },
      include: { resident: true, period: true },
    })

    if (items.length === 0) {
      return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })
    }

    const results: any[] = []
    for (const item of items) {
      if (item.status === 'PAID' && item.payment_id) {
        results.push({ itemId: item.id, status: 'cannot_skip_paid', message: 'Item sudah dibayar' })
        continue
      }

      // Update item status to SKIPPED
      // eslint-disable-next-line no-await-in-loop
      await db.paymentScheduleItem.update({
        where: { id: item.id },
        data: { 
          status: 'SKIPPED', 
          notes: input.reason ? `Dilewati: ${input.reason}` : 'Dilewati oleh admin'
        },
      })

      results.push({ itemId: item.id, status: 'skipped' })
    }

    return NextResponse.json({ message: 'Item berhasil dilewati', results })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validasi gagal', details: error.issues }, { status: 400 })
    }
    console.error('Error skipping items:', error)
    return NextResponse.json({ error: 'Gagal melewati item' }, { status: 500 })
  }
}
