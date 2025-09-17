import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const verifyManualSchema = z.object({
  paymentId: z.string(),
  action: z.enum(['approve', 'reject']),
  adminNotes: z.string().optional(),
  verificationMethod: z.enum(['BANK_STATEMENT', 'TRANSFER_PROOF', 'MANUAL_CHECK']),
  verificationDetails: z.object({
    bankAccount: z.string().optional(),
    transferAmount: z.number().optional(),
    transferDate: z.string().optional(),
    referenceNumber: z.string().optional(),
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = verifyManualSchema.parse(body)

    // Get payment with related data
    const payment = await db.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        resident: {
          select: { id: true, name: true, rt: true, rw: true }
        },
        scheduleItems: {
          include: {
            period: {
              select: { name: true, month: true, year: true }
            }
          }
        },
        proofs: true
      }
    })

    if (!payment) {
      return NextResponse.json({ error: 'Payment tidak ditemukan' }, { status: 404 })
    }

    if (payment.status !== 'PENDING') {
      return NextResponse.json({ 
        error: `Payment sudah ${payment.status === 'VERIFIED' ? 'diverifikasi' : 'ditolak'}` 
      }, { status: 400 })
    }

    // Update payment status
    const newStatus = input.action === 'approve' ? 'VERIFIED' : 'REJECTED'
    const verificationNotes = [
      `Manual verification: ${input.action === 'approve' ? 'APPROVED' : 'REJECTED'}`,
      `Method: ${input.verificationMethod}`,
      input.adminNotes ? `Admin notes: ${input.adminNotes}` : '',
      input.verificationDetails ? `Details: ${JSON.stringify(input.verificationDetails)}` : ''
    ].filter(Boolean).join(' | ')

    const updatedPayment = await db.payment.update({
      where: { id: input.paymentId },
      data: {
        status: newStatus,
        notes: payment.notes 
          ? `${payment.notes} | ${verificationNotes}`
          : verificationNotes,
        updatedAt: new Date()
      }
    })

    // Update related schedule items based on action
    if (input.action === 'approve') {
      // If approved, mark schedule items as paid
      await db.paymentScheduleItem.updateMany({
        where: { paymentId: payment.id },
        data: { 
          status: 'PAID',
          paidDate: new Date()
        }
      })
    } else {
      // If rejected, release schedule items (remove paymentId and reset status)
      await db.paymentScheduleItem.updateMany({
        where: { paymentId: payment.id },
        data: { 
          status: 'PLANNED', // Reset to planned status
          paidDate: null,
          paymentId: null // Remove payment association
        }
      })
    }

    // Create verification log
    await db.paymentVerification.create({
      data: {
        paymentId: payment.id,
        verifiedBy: 'ADMIN', // TODO: Get from session
        verificationMethod: input.verificationMethod,
        status: newStatus,
        notes: verificationNotes,
        verificationData: input.verificationDetails ? JSON.stringify(input.verificationDetails) : null
      }
    }).catch(() => {
      // Table might not exist yet, will be created in migration
      console.log('PaymentVerification table not ready yet')
    })

    return NextResponse.json({
      success: true,
      message: `Payment berhasil ${input.action === 'approve' ? 'diverifikasi' : 'ditolak'}`,
      payment: {
        id: updatedPayment.id,
        status: updatedPayment.status,
        residentName: payment.resident.name,
        amount: updatedPayment.amount,
        periods: payment.scheduleItems.map(item => item.period?.name).filter(Boolean)
      }
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validasi gagal', details: error.issues }, { status: 400 })
    }
    console.error('Error in manual verification:', error)
    return NextResponse.json({ error: 'Gagal melakukan verifikasi manual' }, { status: 500 })
  }
}
