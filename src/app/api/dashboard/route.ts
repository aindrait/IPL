import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Default settings
const defaultSettings = {
  defaultAmount: parseInt((process.env.NEXT_PUBLIC_IPL_BASE_AMOUNT || "250000").split(',')[0], 10) || 250000,
  due_date: parseInt(process.env.NEXT_PUBLIC_DEFAULT_DUE_DATE || "5", 10) || 5,
  rwSettings: {
    activeRWs: [12],
    defaultRW: 12
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get payment settings
    let paymentSettings = defaultSettings
    try {
      const settings = await db.settings.findMany()
      const settingsObj: Record<string, any> = {}
      settings.forEach(setting => {
        try {
          settingsObj[setting.key] = JSON.parse(setting.value)
        } catch {
          settingsObj[setting.key] = setting.value
        }
      })
      
      // Merge with defaults
      paymentSettings = {
        ...defaultSettings,
        ...settingsObj.paymentSettings
      }
    } catch (error) {
      console.log('Using default payment settings for dashboard')
    }

    // Get total residents count
    const totalResidents = await db.resident.count({
      where: { is_active: true }
    })

    // Get current active period (current month)
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    
    let currentPeriod = await db.paymentPeriod.findFirst({
      where: { 
        month: currentMonth,
        year: currentYear,
        is_active: true 
      }
    })
    
    // Fallback to latest active period if current month not found
    if (!currentPeriod) {
      currentPeriod = await db.paymentPeriod.findFirst({
        where: { is_active: true },
        orderBy: { due_date: 'desc' }
      })
    }

    // Get payment statistics based on schedule items for current period
    let totalPaid = 0
    let totalPending = 0
    let totalOverdue = 0

    if (currentPeriod) {
      // Count residents who have paid for current period
      const paidResidents = await db.paymentScheduleItem.count({
        where: {
          period_id: currentPeriod.id,
          status: 'PAID'
        }
      })

      // Count residents with pending payments for current period
      const pendingResidents = await db.paymentScheduleItem.count({
        where: {
          period_id: currentPeriod.id,
          payment: {
            status: 'PENDING'
          }
        }
      })

      // Count residents who are overdue (have schedule items but no payment and past due date)
      const now = new Date()
      const overdueResidents = await db.paymentScheduleItem.count({
        where: {
          period_id: currentPeriod.id,
          status: { not: 'PAID' },
          due_date: { lt: now },
          payment: null
        }
      })

      totalPaid = paidResidents
      totalPending = pendingResidents
      totalOverdue = overdueResidents
    }

    // Compute total income by summing verified and manual paid payments (more reliable approach)
    const incomeAgg = await db.payment.aggregate({
      where: { status: { in: ['VERIFIED', 'MANUAL_PAID'] } },
      _sum: { amount: true }
    })
    const totalIncome = incomeAgg._sum.amount || 0
    
    // Calculate collection rate based on schedule items for current period
    let collectionRate = 0
    if (currentPeriod) {
      const totalScheduled = await db.paymentScheduleItem.count({
        where: {
          period_id: currentPeriod.id,
          status: { not: 'SKIPPED' }
        }
      })
      collectionRate = totalScheduled > 0 ? Math.round((totalPaid / totalScheduled) * 100) : 0
    }

    // Get recent payments
    const recentPayments = await db.payment.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        resident: true,
        schedule_items: {
          include: {
            period: true
          }
        },
        proofs: true,
        created_by: true
      }
    })

    // Format recent payments for response
    const formattedRecentPayments = recentPayments.map(payment => ({
      id: payment.id,
      residentName: (payment as any).resident?.name || 'Unknown',
      amount: payment.amount,
      payment_date: payment.payment_date.toISOString().split('T')[0],
      status: payment.status,
      periods: (payment as any).schedule_items?.map((si: any) => si.period?.name).filter(Boolean) || [],
      hasProof: (payment as any).proofs?.length > 0 || false
    }))

    // Get unpaid residents for current period (those with overdue schedule items)
    const unpaidResidents = currentPeriod ? await db.resident.findMany({
      where: {
        is_active: true,
        schedule_items: {
          some: {
            period_id: currentPeriod.id,
            status: { not: 'PAID' },
            due_date: { lt: new Date() },
            payment: null
          }
        }
      },
      take: 5,
      select: { id: true, name: true, address: true, phone: true }
    }) : []

    // Calculate days overdue for unpaid residents
    const formattedUnpaidResidents = unpaidResidents.map(resident => {
      const daysOverdue = currentPeriod ? 
        Math.max(0, Math.floor((new Date().getTime() - new Date(currentPeriod.due_date).getTime()) / (1000 * 60 * 60 * 24))) : 
        0
      
      return {
        id: resident.id,
        name: resident.name,
        address: resident.address,
        phone: resident.phone,
        daysOverdue
      }
    })

    // Get total payment proofs count
    const totalProofs = await db.paymentProof.count()

    // Get tunggakan (overdue) statistics per RT and RW
    const activeRWs = paymentSettings.rwSettings.activeRWs
    
    // Get all RTs first, then calculate overdue statistics
    const allRTs = await db.rT.findMany({
      where: { 
        rw: { in: activeRWs },
        is_active: true 
      },
      select: { number: true, rw: true },
      orderBy: [{ rw: 'asc' }, { number: 'asc' }]
    })

    const overdueByRT = currentPeriod ? await Promise.all(allRTs.map(async (rt) => {
      // Get residents for this RT
      const residents = await db.resident.findMany({
        where: { 
          rt: rt.number, 
          rw: rt.rw, 
          is_active: true 
        },
        select: { id: true }
      })

      const residentIds = residents.map(r => r.id)
      
      if (residentIds.length === 0) {
        // RT has no residents
        return {
          rt: rt.number,
          rw: rt.rw,
          totalResidents: 0,
          overdueResidents: 0,
          overdueAmount: 0
        }
      }

      // Get overdue statistics for this RT
      const totalResidents = residents.length
      
      // Count overdue residents (those with unpaid schedule items past due date)
      const overdueResidents = await db.paymentScheduleItem.count({
        where: {
          resident_id: { in: residentIds },
          period_id: currentPeriod.id,
          status: { not: 'PAID' },
          due_date: { lt: new Date() },
          payment: null
        }
      })
      
      // Calculate overdue amount
      const overdueAmountResult = await db.paymentScheduleItem.aggregate({
        where: {
          resident_id: { in: residentIds },
          period_id: currentPeriod.id,
          status: { not: 'PAID' },
          due_date: { lt: new Date() },
          payment: null
        },
        _sum: { amount: true }
      })
      
      return {
        rt: rt.number,
        rw: rt.rw,
        totalResidents,
        overdueResidents,
        overdueAmount: Number(overdueAmountResult._sum.amount) || 0
      }
    })) : []

    const overdueByRW = currentPeriod ? await Promise.all(activeRWs.map(async (rw) => {
      // Get all residents for this RW
      const rwResidents = await db.resident.findMany({
        where: { 
          rw: rw, 
          is_active: true 
        },
        select: { id: true }
      })

      const residentIds = rwResidents.map(r => r.id)
      
      if (residentIds.length === 0) {
        return {
          rw: rw,
          totalResidents: 0,
          overdueResidents: 0,
          overdueAmount: 0
        }
      }

      // Count overdue residents for this RW
      const overdueResidents = await db.paymentScheduleItem.count({
        where: {
          resident_id: { in: residentIds },
          period_id: currentPeriod.id,
          status: { not: 'PAID' },
          due_date: { lt: new Date() },
          payment: null
        }
      })
      
      // Calculate overdue amount for this RW
      const overdueAmountResult = await db.paymentScheduleItem.aggregate({
        where: {
          resident_id: { in: residentIds },
          period_id: currentPeriod.id,
          status: { not: 'PAID' },
          due_date: { lt: new Date() },
          payment: null
        },
        _sum: { amount: true }
      })
      
      return {
        rw: rw,
        totalResidents: residentIds.length,
        overdueResidents,
        overdueAmount: Number(overdueAmountResult._sum.amount) || 0
      }
    })) : []

    return NextResponse.json({
      stats: {
        totalResidents,
        totalPaid,
        totalPending,
        totalOverdue,
        collectionRate,
        currentPeriod: currentPeriod ? {
          name: currentPeriod.name,
          month: currentPeriod.month,
          year: currentPeriod.year,
          amount: currentPeriod.amount,
          due_date: currentPeriod.due_date.toISOString().split('T')[0]
        } : null
      },
      totalIncome,
      totalProofs,
      paymentSettings: {
        defaultAmount: paymentSettings.defaultAmount,
        due_date: paymentSettings.due_date
      },
      recentPayments: formattedRecentPayments,
      unpaidResidents: formattedUnpaidResidents,
      overdueByRT: overdueByRT,
      overdueByRW: overdueByRW
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data dashboard' },
      { status: 500 }
    )
  }
}