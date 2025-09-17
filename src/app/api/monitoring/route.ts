import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Helper function to get month names
const MONTH_NAMES = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
]

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

interface MonthData {
  scheduled: boolean
  paid: boolean
  amount: number
  paymentDate?: string
  daysOverdue?: number
  status: 'paid' | 'overdue' | 'scheduled' | 'unscheduled' | 'pending' | 'skipped'
  scheduleItemId?: string
  paymentId?: string
}

interface ResidentMonitoring {
  id: string
  name: string
  blok: string
  houseNumber: string
  rt: number
  months: Record<string, MonthData>
  totalPaid: number
  totalScheduled: number
  paymentRate: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const rtFilter = searchParams.get('rt') || 'all'
    const yearFilter = parseInt(searchParams.get('year') || new Date().getFullYear().toString())

    console.log(`Fetching monitoring data for RT: ${rtFilter}, Year: ${yearFilter}`)

    // Build where clause for residents
    const residentsWhere: any = { isActive: true }
    if (rtFilter !== 'all') {
      residentsWhere.rt = parseInt(rtFilter)
    }

    // Get all residents matching the filter
    const residents = await db.resident.findMany({
      where: residentsWhere,
      select: {
        id: true,
        name: true,
        blok: true,
        houseNumber: true,
        rt: true,
        rw: true,
      },
      orderBy: [
        { rt: 'asc' },
        { blok: 'asc' },
        { houseNumber: 'asc' },
        { name: 'asc' }
      ]
    })

    console.log(`Found ${residents.length} residents`)

    // Get all schedule items for the year and residents
    const scheduleItems = await db.paymentScheduleItem.findMany({
      where: {
        residentId: { in: residents.map(r => r.id) },
        period: {
          year: yearFilter
        }
      },
      include: {
        period: {
          select: {
            id: true,
            name: true,
            month: true,
            year: true,
            amount: true,
            dueDate: true
          }
        },
        payment: {
          select: {
            id: true,
            status: true,
            paymentDate: true,
            amount: true
          }
        }
      }
    })

    console.log(`Found ${scheduleItems.length} schedule items`)

    // Get all payments for verification
    const payments = await db.payment.findMany({
      where: {
        residentId: { in: residents.map(r => r.id) },
        scheduleItems: {
          some: {
            period: {
              year: yearFilter
            }
          }
        }
      },
      include: {
        scheduleItems: {
          include: {
            period: true
          }
        }
      }
    })

    console.log(`Found ${payments.length} payments`)

    // Process data for each resident
    const monitoringData: ResidentMonitoring[] = residents.map(resident => {
      // Initialize all months as unscheduled
      const months: Record<string, MonthData> = {}
      
      // Initialize 12 months + THR
      MONTH_NAMES.forEach(monthKey => {
        months[monthKey] = {
          scheduled: false,
          paid: false,
          amount: 0,
          status: 'unscheduled'
        }
      })
      months['thr'] = {
        scheduled: false,
        paid: false,
        amount: 0,
        status: 'unscheduled'
      }

      // Get schedule items for this resident
      const residentScheduleItems = scheduleItems.filter(item => item.residentId === resident.id)
      
      let totalPaid = 0
      let totalScheduled = 0

      // Process each schedule item
      residentScheduleItems.forEach(item => {
        let monthKey: string
        
        if (item.type === 'MONTHLY' && item.period) {
          monthKey = MONTH_NAMES[item.period.month - 1]
        } else if (item.type === 'SPECIAL') {
          monthKey = 'thr'
        } else if (item.type === 'DONATION') {
          // For donations, we can map to the month they're due or show separately
          // For now, let's skip donations in the yearly grid as they're not regular schedule
          return
        } else {
          return // Skip other types
        }

        const dueDate = new Date(item.period?.dueDate || item.dueDate)
        const now = new Date()
        const isOverdue = dueDate < now
        const daysOverdue = isOverdue ? Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0

        months[monthKey] = {
          scheduled: true,
          paid: item.status === 'PAID' || Boolean(item.payment && item.payment.status === 'VERIFIED'),
          amount: item.amount,
          scheduleItemId: item.id,
          paymentId: item.payment?.id || undefined,
          paymentDate: item.payment?.paymentDate ? new Date(item.payment.paymentDate).toLocaleDateString('id-ID') : undefined,
          daysOverdue: isOverdue && !item.payment && (item.status as string) !== 'SKIPPED' ? daysOverdue : undefined,
          status: (item.status as string) === 'SKIPPED' 
            ? 'skipped'
            : item.payment && item.payment.status === 'VERIFIED' 
            ? 'paid' 
            : item.payment && (item.payment.status as string) === 'MANUAL_PAID'
            ? 'paid'
            : item.payment && item.payment.status === 'PENDING'
            ? 'pending'
            : isOverdue && !item.payment && (item.status as string) !== 'SKIPPED'
            ? 'overdue'
            : 'scheduled'
        }

        // Only count items that are not SKIPPED in totals
        if ((item.status as string) !== 'SKIPPED') {
          totalScheduled += item.amount
          if (months[monthKey].paid) {
            totalPaid += item.amount
          }
        }
      })

      const paymentRate = totalScheduled > 0 ? Math.round((totalPaid / totalScheduled) * 100) : 0

      return {
        id: resident.id,
        name: resident.name,
        blok: resident.blok || '',
        houseNumber: resident.houseNumber || '',
        rt: resident.rt,
        months,
        totalPaid,
        totalScheduled,
        paymentRate
      }
    })

    // Calculate summary statistics (excluding SKIPPED items)
    const summary = {
      totalResidents: residents.length,
      totalPaid: monitoringData.reduce((sum, resident) => sum + resident.totalPaid, 0),
      totalScheduled: monitoringData.reduce((sum, resident) => sum + resident.totalScheduled, 0),
      collectionRate: 0
    }

    summary.collectionRate = summary.totalScheduled > 0 
      ? Math.round((summary.totalPaid / summary.totalScheduled) * 100) 
      : 0

    // Get available years for filter
    const availableYears = await db.paymentPeriod.findMany({
      select: { year: true },
      distinct: ['year'],
      orderBy: { year: 'desc' }
    })

    // Get available RTs for filter
    const availableRTs = await db.rT.findMany({
      select: { number: true },
      orderBy: { number: 'asc' }
    })

    return NextResponse.json({
      filters: {
        rt: rtFilter === 'all' ? 'all' : parseInt(rtFilter),
        year: yearFilter
      },
      residents: monitoringData,
      summary,
      availableYears: availableYears.map(p => p.year),
      availableRTs: availableRTs.map(rt => rt.number),
      metadata: {
        monthNames: MONTH_NAMES_ID,
        generatedAt: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Error fetching monitoring data:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data monitoring' },
      { status: 500 }
    )
  }
}
