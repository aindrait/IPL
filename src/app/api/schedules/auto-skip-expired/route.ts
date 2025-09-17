import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const now = new Date()
    
    // Find all expired donation items that are not paid yet
    const expiredDonations = await db.paymentScheduleItem.findMany({
      where: {
        type: 'DONATION',
        status: { notIn: ['PAID', 'SKIPPED'] }, // Only OPTIONAL and PLANNED donations
        dueDate: { lt: now }, // Past due date
        paymentId: null // Not paid
      },
      include: {
        resident: {
          select: { id: true, name: true }
        }
      }
    })

    if (expiredDonations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada sumbangan yang perlu di-skip',
        skippedCount: 0
      })
    }

    // Auto-skip expired donations
    const result = await db.paymentScheduleItem.updateMany({
      where: {
        id: { in: expiredDonations.map(item => item.id) }
      },
      data: {
        status: 'SKIPPED',
        notes: `Auto-skipped: Sumbangan sudah melewati batas waktu (${now.toLocaleDateString('id-ID')})`
      }
    })

    console.log(`Auto-skipped ${result.count} expired donation items`)

    return NextResponse.json({
      success: true,
      message: `Berhasil auto-skip ${result.count} sumbangan yang sudah expired`,
      skippedCount: result.count,
      expiredItems: expiredDonations.map(item => ({
        id: item.id,
        label: item.label,
        residentName: item.resident.name,
        dueDate: item.dueDate,
        amount: item.amount
      }))
    })

  } catch (error) {
    console.error('Error auto-skipping expired donations:', error)
    return NextResponse.json(
      { error: 'Gagal melakukan auto-skip sumbangan expired' },
      { status: 500 }
    )
  }
}
