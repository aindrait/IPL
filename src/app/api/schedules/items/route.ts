import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20')))
    const residentId = searchParams.get('residentId') || undefined
    const scheduleId = searchParams.get('scheduleId') || undefined
    const periodId = searchParams.get('periodId') || undefined
    const status = searchParams.get('status') || undefined
    const type = searchParams.get('type') || undefined
    const search = searchParams.get('search') || ''
    const includePaid = searchParams.get('includePaid') === 'true'
    const rt = searchParams.get('rt') || undefined
    const year = searchParams.get('year') || undefined
    const month = searchParams.get('month') || undefined

    const skip = (page - 1) * limit

    const where: any = {}
    if (residentId) where.residentId = residentId
    if (scheduleId) where.scheduleId = scheduleId
    if (periodId) where.periodId = periodId
    if (status) where.status = status
    if (type) where.type = type
    if (search) {
      where.OR = [
        { label: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { resident: { name: { contains: search, mode: 'insensitive' } } },
        { resident: { blok: { contains: search, mode: 'insensitive' } } },
        { resident: { houseNumber: { contains: search, mode: 'insensitive' } } },
        // Search by RT/RW numbers
        ...(search.match(/^RT?\s*(\d+)$/i) ? [{ resident: { rt: parseInt(search.match(/^RT?\s*(\d+)$/i)![1]) } }] : []),
        ...(search.match(/^RW\s*(\d+)$/i) ? [{ resident: { rw: parseInt(search.match(/^RW\s*(\d+)$/i)![1]) } }] : []),
        // Search by RT/RW combination like "RT01" or "RW02"
        ...(search.match(/^RT\s*0*(\d+)$/i) ? [{ resident: { rt: parseInt(search.match(/^RT\s*0*(\d+)$/i)![1]) } }] : []),
        ...(search.match(/^RW\s*0*(\d+)$/i) ? [{ resident: { rw: parseInt(search.match(/^RW\s*0*(\d+)$/i)![1]) } }] : []),
      ]
    }

    // RT filter
    if (rt) {
      where.resident = {
        ...where.resident,
        rt: parseInt(rt)
      }
    }

    // Year filter
    if (year) {
      where.period = {
        ...where.period,
        year: parseInt(year)
      }
    }

    // Month filter
    if (month) {
      where.period = {
        ...where.period,
        month: parseInt(month)
      }
    }

    // Filter out paid and skipped items by default unless explicitly requested
    if (!includePaid) {
      where.status = { notIn: ['PAID', 'SKIPPED'] }
      where.paymentId = null
    }

    // Hide expired donation (optional) items by default - donations cannot be selected after due date
    const now = new Date()
    const donationFilter: any = {
      NOT: {
        AND: [
          { type: 'DONATION' },
          { dueDate: { lt: now } },
          { status: { notIn: ['PAID', 'SKIPPED'] } } // Still show paid/skipped donations even if expired
        ]
      }
    }

    const [items, total, totalStats] = await Promise.all([
      db.paymentScheduleItem.findMany({
        where: { ...where, ...donationFilter },
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
        include: {
          resident: { select: { id: true, name: true, blok: true, houseNumber: true, rt: true, rw: true } },
          schedule: { select: { id: true, name: true } },
          period: { select: { id: true, name: true, month: true, year: true, amount: true, dueDate: true } },
          payment: true,
        },
      }),
      db.paymentScheduleItem.count({ where: { ...where, ...donationFilter } }),
      // Calculate totals excluding SKIPPED items
      db.paymentScheduleItem.aggregate({
        where: { 
          ...where, 
          ...donationFilter,
          status: { not: 'SKIPPED' } // Exclude SKIPPED items from totals
        },
        _sum: { amount: true },
        _count: { _all: true }
      })
    ])

    // Attach computed indexCode for display and selection UX
    const itemsWithIndex = items.map((it: any) => {
      let indexCode = ''
      if (it.type === 'MONTHLY' && it.period?.year && it.period?.month) {
        const mm = String(it.period.month).padStart(2, '0')
        indexCode = `${it.period.year}-${mm}`
      } else if (it.type === 'SPECIAL') {
        indexCode = `${it.period?.year || new Date(it.dueDate).getFullYear()}-THR`
      } else if (it.type === 'DONATION') {
        // naive S# based on order within same year; can be refined later
        indexCode = `${it.period?.year || new Date(it.dueDate).getFullYear()}-S1`
      }
      return { ...it, indexCode }
    })

    return NextResponse.json({
      items: itemsWithIndex,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      totals: {
        totalAmount: totalStats._sum.amount || 0,
        totalItems: totalStats._count._all || 0,
        // Calculate paid totals
        totalPaidAmount: items
          .filter(item => item.status === 'PAID' || (item.payment && item.payment.status === 'VERIFIED'))
          .reduce((sum, item) => sum + item.amount, 0),
        totalPaidItems: items
          .filter(item => item.status === 'PAID' || (item.payment && item.payment.status === 'VERIFIED'))
          .length
      }
    })
  } catch (error) {
    console.error('Error fetching schedule items:', error)
    return NextResponse.json({ error: 'Gagal mengambil data item jadwal' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID item jadwal diperlukan' }, { status: 400 })
    }
    
    // Check if schedule item is linked to a payment
    const scheduleItem = await db.paymentScheduleItem.findUnique({
      where: { id },
      include: { payment: true }
    })
    
    if (!scheduleItem) {
      return NextResponse.json({ error: 'Item jadwal tidak ditemukan' }, { status: 404 })
    }
    
    if (scheduleItem.paymentId) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus item jadwal yang sudah terbayar' },
        { status: 400 }
      )
    }
    
    await db.paymentScheduleItem.delete({
      where: { id }
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting schedule item:', error)
    return NextResponse.json({ error: 'Gagal menghapus item jadwal' }, { status: 500 })
  }
}

// Update schedule item (amount, status, notes) for compensation or corrections
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, amount, status, notes } = body as { id: string; amount?: number; status?: string; notes?: string }
    if (!id) return NextResponse.json({ error: 'ID item jadwal diperlukan' }, { status: 400 })

    // Check if schedule item is linked to a payment
    const scheduleItem = await db.paymentScheduleItem.findUnique({
      where: { id },
      include: { payment: true }
    })
    
    if (!scheduleItem) {
      return NextResponse.json({ error: 'Item jadwal tidak ditemukan' }, { status: 404 })
    }
    
    const data: any = {}
    
    // Validation for paid schedule items
    if (scheduleItem.paymentId) {
      // For paid items, only allow editing notes and dueDate (with restrictions)
      if (typeof amount === 'number') {
        return NextResponse.json(
          { error: 'Tidak dapat mengubah jumlah item yang sudah dibayar' },
          { status: 400 }
        )
      }
      
      if (typeof status === 'string' && status !== scheduleItem.status) {
        return NextResponse.json(
          { error: 'Tidak dapat mengubah status item yang sudah dibayar' },
          { status: 400 }
        )
      }
      
      if (typeof notes === 'string') data.notes = notes
    } else {
      // For unpaid items, allow editing all fields
      if (typeof amount === 'number') data.amount = amount
      if (typeof status === 'string') data.status = status
      if (typeof notes === 'string') data.notes = notes
    }
    
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Tidak ada data yang diupdate' }, { status: 400 })
    }

    const updated = await db.paymentScheduleItem.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating schedule item:', error)
    return NextResponse.json({ error: 'Gagal mengupdate item jadwal' }, { status: 500 })
  }
}


