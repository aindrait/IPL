import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Create system user if not exists
    let systemUser = await db.user.findFirst({ where: { email: 'system@localhost' } })
    if (!systemUser) {
      systemUser = await db.user.create({
        data: {
          email: 'system@localhost',
          name: 'System User',
          role: 'ADMIN',
          password: 'system-password'
        }
      })
    }

    // Create RT
    const rt = await db.rT.create({
      data: {
        number: 1,
        rw: 12,
        chairman: 'Budi Santoso',
        phone: '081234567890'
      }
    })

    // Create residents
    const residents = await Promise.all([
      db.resident.create({
        data: {
          name: 'Siti Aminah',
          address: 'Jl. Merdeka No. 10',
          phone: '081234567891',
          rt: 1,
          rw: 12,
          blok: 'C11',
          houseNumber: '10',
          paymentIndex: 1110,
          createdById: systemUser.id,
          rtId: rt.id
        }
      }),
      db.resident.create({
        data: {
          name: 'Ahmad Wijaya',
          address: 'Jl. Merdeka No. 11',
          phone: '081234567892',
          rt: 1,
          rw: 12,
          blok: 'C11',
          houseNumber: '11',
          paymentIndex: 1111,
          createdById: systemUser.id,
          rtId: rt.id
        }
      })
    ])

    // Create payment periods
    const periods = await Promise.all([
      db.paymentPeriod.create({
        data: {
          name: 'IPL Bulan Agustus 2025',
          month: 8,
          year: 2025,
          amount: 200000,
          dueDate: new Date('2025-08-31')
        }
      }),
      db.paymentPeriod.create({
        data: {
          name: 'IPL Bulan September 2025',
          month: 9,
          year: 2025,
          amount: 200000,
          dueDate: new Date('2025-09-30')
        }
      })
    ])

    // Create payment schedule
    const schedule = await db.paymentSchedule.create({
      data: {
        name: 'Jadwal Pembayaran Q3 2025',
        description: 'Jadwal pembayaran IPL Q3 2025',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2025-09-30'),
        periodId: periods[0].id,
        createdById: systemUser.id
      }
    })

    // Create schedule items for each resident and period
    const scheduleItems: any[] = []
    for (const resident of residents) {
      for (const period of periods) {
        const item = await db.paymentScheduleItem.create({
          data: {
            type: 'MONTHLY',
            label: `IPL ${period.name}`,
            amount: period.amount,
            dueDate: period.dueDate,
            scheduleId: schedule.id,
            periodId: period.id,
            residentId: resident.id
          }
        })
        scheduleItems.push(item)
      }
    }

    return NextResponse.json({
      message: 'Sample data created successfully',
      data: {
        users: 1,
        rts: 1,
        residents: residents.length,
        periods: periods.length,
        schedules: 1,
        scheduleItems: scheduleItems.length
      }
    })

  } catch (error) {
    console.error('Error creating sample data:', error)
    return NextResponse.json(
      { error: 'Gagal membuat data sample', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}