import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status, notes } = await request.json()

    // Check if payment exists
    const payment = await db.payment.findUnique({
      where: { id: params.id },
      include: {
        resident: true,
        period: true
      }
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Pembayaran tidak ditemukan' },
        { status: 404 }
      )
    }

    // Update payment status
    const updatedPayment = await db.payment.update({
      where: { id: params.id },
      data: {
        status: status || 'VERIFIED',
        notes: notes || payment.notes
      },
      include: {
        resident: {
          select: { id: true, name: true, address: true, phone: true }
        },
        period: {
          select: { id: true, name: true, month: true, year: true, amount: true }
        },
        proofs: true
      }
    })

    return NextResponse.json({
      message: `Pembayaran berhasil ${status === 'VERIFIED' ? 'diverifikasi' : 'diperbarui'}`,
      payment: updatedPayment
    })

  } catch (error) {
    console.error('Error verifying payment:', error)
    return NextResponse.json(
      { error: 'Gagal memverifikasi pembayaran' },
      { status: 500 }
    )
  }
}