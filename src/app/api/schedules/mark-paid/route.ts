import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const markPaidSchema = z.object({
  itemIds: z.array(z.string()).min(1, 'Pilih minimal satu item'),
  payment_date: z.string().min(1, 'Tanggal pembayaran harus diisi'),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = markPaidSchema.parse(body)

    const items = await db.paymentScheduleItem.findMany({
      where: { id: { in: input.itemIds } },
      include: { resident: true, period: true },
    })

    if (items.length === 0) {
      return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })
    }

    // Ensure system user exists for payment creation
    let systemUser = await db.user.findFirst({ where: { email: 'system@localhost' } })
    if (!systemUser) {
      systemUser = await db.user.create({
        data: { email: 'system@localhost', name: 'System User', role: 'ADMIN', password: 'system-password' },
      })
    }

    const results: any[] = []
    for (const item of items) {
      if (item.status === 'PAID' && item.payment_id) {
        results.push({ itemId: item.id, status: 'already_paid', payment_id: item.payment_id })
        continue
      }

      // Create payment record per item (manual payment)
      // eslint-disable-next-line no-await-in-loop
      const payment = await db.payment.create({
        data: {
          amount: item.amount,
          payment_date: new Date(input.payment_date),
          status: 'MANUAL_PAID', // Different status for manual payments
          payment_method: input.payment_method || 'Manual Entry',
          notes: `Manual mark paid: ${input.notes || 'No notes'}`,
          resident_id: item.resident_id,
          created_by_id: systemUser.id,
        },
      })

      // eslint-disable-next-line no-await-in-loop
      await db.paymentScheduleItem.update({
        where: { id: item.id },
        data: { status: 'PAID', paid_date: new Date(input.payment_date), payment_id: payment.id },
      })

      results.push({ itemId: item.id, status: 'paid', payment_id: payment.id })
    }

    return NextResponse.json({ message: 'Item ditandai sebagai dibayar', results })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validasi gagal', details: error.issues }, { status: 400 })
    }
    console.error('Error marking items paid:', error)
    return NextResponse.json({ error: 'Gagal menandai item sebagai dibayar' }, { status: 500 })
  }
}


