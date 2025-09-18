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
  const startTime = Date.now()
  console.log('Dashboard API: Starting data fetch (OPTIMIZED)')
  
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

    // OPTIMIZED: Get all dashboard statistics in a single query using aggregation
    const statsStartTime = Date.now()
    
    // Get total residents count
    const totalResidents = await db.resident.count({
      where: { is_active: true }
    })

    // Initialize statistics
    let totalPaid = 0
    let totalPending = 0
    let totalOverdue = 0
    let collectionRate = 0

    if (currentPeriod) {
      // OPTIMIZED: Get payment statistics with a single aggregation query
      const paymentStats = await db.paymentScheduleItem.groupBy({
        by: ['status'],
        where: {
          period_id: currentPeriod.id
        },
        _count: {
          status: true
        },
        _sum: {
          amount: true
        }
      })

      // Calculate statistics from grouped results
      const statsMap = new Map(paymentStats.map(stat => [stat.status, stat]))
      totalPaid = statsMap.get('PAID')?._count.status || 0
      const totalScheduled = paymentStats.reduce((sum, stat) => sum + stat._count.status, 0) - (statsMap.get('SKIPPED')?._count.status || 0)
      collectionRate = totalScheduled > 0 ? Math.round((totalPaid / totalScheduled) * 100) : 0

      // Get pending payments (those with PENDING payment status)
      const pendingCount = await db.paymentScheduleItem.count({
        where: {
          period_id: currentPeriod.id,
          payment: {
            status: 'PENDING'
          }
        }
      })
      totalPending = pendingCount

      // Get overdue count using the optimized index
      totalOverdue = await db.paymentScheduleItem.count({
        where: {
          period_id: currentPeriod.id,
          status: { not: 'PAID' },
          due_date: { lt: now },
          payment: null
        }
      })
    }

    // Compute total income by summing verified and manual paid payments
    const incomeAgg = await db.payment.aggregate({
      where: { status: { in: ['VERIFIED', 'MANUAL_PAID'] } },
      _sum: { amount: true }
    })
    const totalIncome = incomeAgg._sum.amount || 0

    // Get total payment proofs count
    const totalProofs = await db.paymentProof.count()

    const statsEndTime = Date.now()
    console.log(`Dashboard API (Optimized): Statistics calculated in ${statsEndTime - statsStartTime}ms`)

    // OPTIMIZED: Get recent payments with optimized includes
    const recentPaymentsStartTime = Date.now()
    const recentPayments = await db.payment.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        resident: {
          select: { id: true, name: true }
        },
        schedule_items: {
          select: {
            period: {
              select: { name: true }
            }
          }
        },
        proofs: {
          select: { id: true }
        },
        created_by: {
          select: { id: true, name: true }
        }
      }
    })

    // Format recent payments for response
    const formattedRecentPayments = recentPayments.map(payment => ({
      id: payment.id,
      residentName: payment.resident?.name || 'Unknown',
      amount: payment.amount,
      payment_date: payment.payment_date.toISOString().split('T')[0],
      status: payment.status,
      periods: payment.schedule_items?.map(si => si.period?.name).filter(Boolean) || [],
      hasProof: payment.proofs?.length > 0 || false
    }))

    const recentPaymentsEndTime = Date.now()
    console.log(`Dashboard API (Optimized): Recent payments fetched in ${recentPaymentsEndTime - recentPaymentsStartTime}ms`)

    // OPTIMIZED: Get unpaid residents for current period
    const unpaidResidentsStartTime = Date.now()
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
    const formattedUnpaidResidents = unpaidResidents.map(resident => ({
      id: resident.id,
      name: resident.name,
      address: resident.address,
      phone: resident.phone,
      daysOverdue: currentPeriod ? 
        Math.max(0, Math.floor((new Date().getTime() - new Date(currentPeriod.due_date).getTime()) / (1000 * 60 * 60 * 24))) : 
        0
    }))

    const unpaidResidentsEndTime = Date.now()
    console.log(`Dashboard API (Optimized): Unpaid residents fetched in ${unpaidResidentsEndTime - unpaidResidentsStartTime}ms`)

    // OPTIMIZED: Get overdue statistics using a single query instead of N+1
    const overdueStartTime = Date.now()
    const activeRWs = paymentSettings.rwSettings.activeRWs
    
    let overdueByRT: any[] = []
    let overdueByRW: any[] = []

    if (currentPeriod) {
      // OPTIMIZED: Get all overdue statistics in a single query using SQL aggregation
      const overdueStats = await db.$queryRaw`
        SELECT 
          r.rt,
          r.rw,
          COUNT(DISTINCT r.id) as total_residents,
          COUNT(DISTINCT CASE WHEN psi.status != 'PAID' 
            AND psi.due_date < ${now} 
            AND psi.payment_id IS NULL 
            THEN r.id END) as overdue_residents,
          COALESCE(SUM(CASE WHEN psi.status != 'PAID' 
            AND psi.due_date < ${now} 
            AND psi.payment_id IS NULL 
            THEN psi.amount END), 0) as overdue_amount
        FROM residents r
        LEFT JOIN payment_schedule_items psi ON r.id = psi.resident_id 
          AND psi.period_id = ${currentPeriod.id}
        WHERE r.is_active = true 
          AND r.rw = ANY(${activeRWs})
        GROUP BY r.rt, r.rw
        ORDER BY r.rw, r.rt
      ` as Array<{
        rt: number
        rw: number
        total_residents: number
        overdue_residents: number
        overdue_amount: number
      }>

      // Transform results for RT level
      overdueByRT = overdueStats.map(stat => ({
        rt: stat.rt,
        rw: stat.rw,
        totalResidents: Number(stat.total_residents),
        overdueResidents: Number(stat.overdue_residents),
        overdueAmount: Number(stat.overdue_amount)
      }))

      // Aggregate by RW level
      const rwAggregates = new Map<number, {
        totalResidents: number
        overdueResidents: number
        overdueAmount: number
      }>()

      overdueStats.forEach(stat => {
        const rwKey = stat.rw
        if (!rwAggregates.has(rwKey)) {
          rwAggregates.set(rwKey, {
            totalResidents: 0,
            overdueResidents: 0,
            overdueAmount: 0
          })
        }
        const rwData = rwAggregates.get(rwKey)!
        rwData.totalResidents += Number(stat.total_residents)
        rwData.overdueResidents += Number(stat.overdue_residents)
        rwData.overdueAmount += Number(stat.overdue_amount)
      })

      overdueByRW = Array.from(rwAggregates.entries()).map(([rw, data]) => ({
        rw,
        totalResidents: data.totalResidents,
        overdueResidents: data.overdueResidents,
        overdueAmount: data.overdueAmount
      }))
    }

    const overdueEndTime = Date.now()
    console.log(`Dashboard API (Optimized): Overdue calculations completed in ${overdueEndTime - overdueStartTime}ms`)

    const endTime = Date.now()
    const totalTime = endTime - startTime
    console.log(`Dashboard API (Optimized): Total execution time: ${totalTime}ms`)
    
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
      overdueByRW: overdueByRW,
      debug: {
        executionTime: totalTime,
        statsCalculationTime: statsEndTime - statsStartTime,
        recentPaymentsTime: recentPaymentsEndTime - recentPaymentsStartTime,
        unpaidResidentsTime: unpaidResidentsEndTime - unpaidResidentsStartTime,
        overdueCalculationTime: overdueEndTime - overdueStartTime,
        isOptimized: true
      }
    })
  } catch (error) {
    const endTime = Date.now()
    const totalTime = endTime - startTime
    console.error(`Error fetching dashboard data after ${totalTime}ms:`, error)
    return NextResponse.json(
      { error: 'Gagal mengambil data dashboard' },
      { status: 500 }
    )
  }
}