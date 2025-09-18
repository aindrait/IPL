import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get('limit') || '10')))
    const rtFilter = searchParams.get('rt') || 'all'
    const monthFilter = searchParams.get('month') || 'all'
    const yearFilter = searchParams.get('year') || 'all'
    const statusFilter = searchParams.get('status') || 'PENDING'
    const search = searchParams.get('search') || ''
    
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = { status: statusFilter === 'all' ? undefined : statusFilter }
    if (statusFilter === 'all') delete where.status
    
    if (rtFilter !== 'all') {
      where.resident = { rt: parseInt(rtFilter) }
    }

    if (yearFilter !== 'all') {
      // Filter by payment date year
      const startOfYear = new Date(parseInt(yearFilter), 0, 1)
      const endOfYear = new Date(parseInt(yearFilter) + 1, 0, 1)
      
      if (!where.payment_date) {
        where.payment_date = {}
      }
      where.payment_date = {
        gte: startOfYear,
        lt: endOfYear
      }
    }

    if (search) {
      where.OR = [
        { resident: { name: { contains: search, mode: 'insensitive' } } },
        { resident: { blok: { contains: search, mode: 'insensitive' } } },
        { resident: { phone: { contains: search, mode: 'insensitive' } } }
      ]
    }

    const [pendingPayments, total] = await Promise.all([
      db.payment.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          resident: {
            select: {
              id: true,
              name: true,
              rt: true,
              rw: true,
              blok: true,
              house_number: true,
              phone: true,
              payment_index: true
            }
          },
          schedule_items: {
            include: {
              period: {
                select: { name: true, month: true, year: true, amount: true, due_date: true }
              }
            }
          },
          proofs: {
            select: {
              id: true,
              filename: true,
              file_path: true,
              file_size: true,
              mime_type: true,
              analyzed: true,
              analysis_result: true,
              created_at: true
            }
          },
          created_by: {
            select: { name: true, email: true }
          }
        }
      }),
      db.payment.count({ where })
    ])

    // Format response
    const formattedPayments = pendingPayments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      payment_date: payment.payment_date.toISOString().split('T')[0],
      status: payment.status,
      payment_method: payment.payment_method,
      notes: payment.notes,
      created_at: payment.created_at.toISOString(),
      resident: {
        id: payment.resident.id,
        name: payment.resident.name,
        rt: payment.resident.rt,
        rw: payment.resident.rw,
        blok: payment.resident.blok,
        house_number: payment.resident.house_number,
        phone: payment.resident.phone,
        payment_index: payment.resident.payment_index || null,
        address: `${payment.resident.blok || ''} ${payment.resident.house_number || ''}`.trim()
      },
      schedule_items: payment.schedule_items.map(item => ({
        id: item.id,
        type: item.type,
        label: item.label,
        status: item.status,
        amount: item.amount,
        originalAmount: item.period?.amount || 0,
        due_date: item.due_date,
        notes: item.notes,
        isAmountEdited: item.amount !== (item.period?.amount || 0),
        period: {
          name: item.period?.name,
          month: item.period?.month,
          year: item.period?.year,
          amount: item.period?.amount,
          due_date: item.period?.due_date
        }
      })),
      periods: payment.schedule_items.map(item => ({
        name: item.period?.name,
        month: item.period?.month,
        year: item.period?.year,
        amount: item.period?.amount
      })).filter(p => p.name),
      proofs: payment.proofs.map(proof => ({
        id: proof.id,
        filename: proof.filename,
        file_path: proof.file_path,
        file_size: proof.file_size,
        mime_type: proof.mime_type,
        analyzed: proof.analyzed,
        analysis_result: proof.analysis_result,
        uploadedAt: proof.created_at.toISOString()
      })),
      submittedBy: payment.created_by?.name || 'System',
      totalScheduleAmount: payment.schedule_items.reduce((sum, item) => sum + item.amount, 0), // Use actual schedule item amounts (edited)
      totalOriginalAmount: payment.schedule_items.reduce((sum, item) => sum + (item.period?.amount || 0), 0), // Original period amounts
      // Verification helpers - check for both exact amount and amount+index
      amountMatch: (() => {
        const totalScheduleAmount = payment.schedule_items.reduce((sum, item) => sum + item.amount, 0)
        const totalOriginalAmount = payment.schedule_items.reduce((sum, item) => sum + (item.period?.amount || 0), 0)
        // Get resident payment index
        const residentPaymentIndex = payment.resident.payment_index || 0
        
        // Check if payment amount matches either:
        // 1. The exact schedule amount (which may have been edited)
        // 2. The original period amount plus payment index (admin fee)
        // The payment schedule should be treated as an invoice issued at the beginning
        return payment.amount === totalScheduleAmount ||
               payment.amount === totalOriginalAmount + residentPaymentIndex
      })(),
      hasEditedAmounts: payment.schedule_items.some(item => item.amount !== (item.period?.amount || 0)),
      hasProofs: payment.proofs.length > 0,
      daysWaiting: Math.floor((new Date().getTime() - payment.created_at.getTime()) / (1000 * 60 * 60 * 24))
    }))

    return NextResponse.json({
      payments: formattedPayments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      summary: {
        totalPending: total,
        totalAmount: pendingPayments.reduce((sum, p) => sum + p.amount, 0),
        withProofs: pendingPayments.filter(p => p.proofs.length > 0).length,
        withoutProofs: pendingPayments.filter(p => p.proofs.length === 0).length
      }
    })

  } catch (error) {
    console.error('Error fetching pending payments:', error)
    return NextResponse.json({ error: 'Gagal mengambil data payment pending' }, { status: 500 })
  }
}
