import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Default settings
const defaultSettings = {
  defaultAmount: 250000,
  dueDate: 5,
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
      where: { isActive: true }
    })

    // Get current active period (current month)
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    
    let currentPeriod = await db.paymentPeriod.findFirst({
      where: { 
        month: currentMonth,
        year: currentYear,
        isActive: true 
      }
    })
    
    // Fallback to latest active period if current month not found
    if (!currentPeriod) {
      currentPeriod = await db.paymentPeriod.findFirst({
        where: { isActive: true },
        orderBy: { dueDate: 'desc' }
      })
    }

    // Get payment statistics based on schedule items (since payments can cover multiple periods)
    const paymentsStats = await db.payment.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { amount: true },
      where: currentPeriod
        ? { scheduleItems: { some: { periodId: currentPeriod.id } } }
        : {}
    })

    // Calculate statistics
    const totalPaid = paymentsStats.find(stat => stat.status === 'VERIFIED')?._count._all || 0
    const totalPending = paymentsStats.find(stat => stat.status === 'PENDING')?._count._all || 0
    const totalOverdue = paymentsStats.find(stat => stat.status === 'REJECTED')?._count._all || 0

    // Compute total income by summing verified and manual paid payments (more reliable approach)
    const incomeAgg = await db.payment.aggregate({
      where: { status: { in: ['VERIFIED', 'MANUAL_PAID'] } },
      _sum: { amount: true }
    })
    const totalIncome = incomeAgg._sum.amount || 0
    const collectionRate = totalResidents > 0 ? Math.round((totalPaid / totalResidents) * 100) : 0

    // Get recent payments
    const recentPayments = await db.payment.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        resident: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            rt: true,
            rw: true
          }
        },
        scheduleItems: {
          include: {
            period: {
              select: { id: true, name: true, month: true, year: true, amount: true }
            }
          }
        },
        proofs: {
          select: {
            id: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Format recent payments for response
    const formattedRecentPayments = recentPayments.map(payment => ({
      id: payment.id,
      residentName: payment.resident.name,
      amount: payment.amount,
      paymentDate: payment.paymentDate.toISOString().split('T')[0],
      status: payment.status,
      periods: payment.scheduleItems?.map(si => si.period?.name).filter(Boolean) || [],
      hasProof: payment.proofs.length > 0
    }))

    // Get unpaid residents for current period
    const unpaidResidents = currentPeriod ? await db.resident.findMany({
      where: {
        isActive: true,
        // Resident has schedule items for the current period
        scheduleItems: { some: { periodId: currentPeriod.id } },
        // And none of them are marked as paid for the current period
        AND: {
          scheduleItems: { none: { periodId: currentPeriod.id, paidDate: { not: null } } }
        }
      },
      take: 5,
      select: { id: true, name: true, address: true, phone: true }
    }) : []

    // Calculate days overdue for unpaid residents
    const formattedUnpaidResidents = unpaidResidents.map(resident => {
      const daysOverdue = currentPeriod ? 
        Math.max(0, Math.floor((new Date().getTime() - new Date(currentPeriod.dueDate).getTime()) / (1000 * 60 * 60 * 24))) : 
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
    const activeRWs = paymentSettings.rwSettings.activeRWs.join(',')
    const overdueByRT = currentPeriod ? await db.$queryRaw`
      SELECT
        r.rt,
        r.rw,
        COUNT(DISTINCT r.id) as totalResidents,
        COUNT(DISTINCT CASE WHEN psi.status NOT IN ('PAID', 'SKIPPED') AND psi.dueDate < datetime('now') THEN r.id END) as overdueResidents,
        SUM(CASE WHEN psi.status NOT IN ('PAID', 'SKIPPED') AND psi.dueDate < datetime('now') THEN psi.amount ELSE 0 END) as overdueAmount
      FROM residents r
      LEFT JOIN payment_schedule_items psi ON r.id = psi.residentId
        AND psi.periodId = ${currentPeriod.id}
      WHERE r.isActive = 1 AND r.rw IN (${activeRWs})
      GROUP BY r.rt, r.rw
      HAVING COUNT(DISTINCT r.id) > 0  -- Only show RT/RW combinations that actually have residents
      ORDER BY r.rw, r.rt
    ` as any[] : []

    const overdueByRW = currentPeriod ? await db.$queryRaw`
      SELECT
        r.rw,
        COUNT(DISTINCT r.id) as totalResidents,
        COUNT(DISTINCT CASE WHEN psi.status NOT IN ('PAID', 'SKIPPED') AND psi.dueDate < datetime('now') THEN r.id END) as overdueResidents,
        SUM(CASE WHEN psi.status NOT IN ('PAID', 'SKIPPED') AND psi.dueDate < datetime('now') THEN psi.amount ELSE 0 END) as overdueAmount
      FROM residents r
      LEFT JOIN payment_schedule_items psi ON r.id = psi.residentId
        AND psi.periodId = ${currentPeriod.id}
      WHERE r.isActive = 1 AND r.rw IN (${activeRWs})
      GROUP BY r.rw
      HAVING COUNT(DISTINCT r.id) > 0  -- Only show RW combinations that actually have residents
      ORDER BY r.rw
    ` as any[] : []

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
          dueDate: currentPeriod.dueDate.toISOString().split('T')[0]
        } : null
      },
      totalIncome,
      totalProofs,
      paymentSettings: {
        defaultAmount: paymentSettings.defaultAmount,
        dueDate: paymentSettings.dueDate
      },
      recentPayments: formattedRecentPayments,
      unpaidResidents: formattedUnpaidResidents,
      overdueByRT: overdueByRT.map(rt => ({
        rt: Number(rt.rt),
        rw: Number(rt.rw),
        totalResidents: Number(rt.totalResidents),
        overdueResidents: Number(rt.overdueResidents),
        overdueAmount: Number(rt.overdueAmount) || 0
      })),
      overdueByRW: overdueByRW.map(rw => ({
        rw: Number(rw.rw),
        totalResidents: Number(rw.totalResidents),
        overdueResidents: Number(rw.overdueResidents),
        overdueAmount: Number(rw.overdueAmount) || 0
      }))
    })
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data dashboard' },
      { status: 500 }
    )
  }
}