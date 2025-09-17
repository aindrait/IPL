import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST() {
  try {
    // Create sample payment periods for the next 12 months
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const iplAmount = 200000 // IPL amount per month

    const periods: Array<{
      name: string
      month: number
      year: number
      amount: number
      dueDate: Date
      isActive: boolean
    }> = []
    
    // Create periods for next 12 months
    for (let i = 0; i < 12; i++) {
      const targetMonth = currentMonth + i
      const year = currentYear + Math.floor(targetMonth / 12)
      const month = ((targetMonth - 1) % 12) + 1
      
      const periodName = `IPL Bulan ${new Date(year, month - 1).toLocaleDateString('id-ID', { month: 'long' })} ${year}`
      const dueDate = new Date(year, month, 5) // Due on 5th of next month
      
      periods.push({
        name: periodName,
        month,
        year,
        amount: iplAmount,
        dueDate,
        isActive: true
      })
    }

    // Delete existing periods and create new ones
    await db.paymentPeriod.deleteMany()
    
    const createdPeriods = await db.paymentPeriod.createMany({
      data: periods
    })

    // Create or get system user for resident creation
    let systemUser = await db.user.findFirst({
      where: { email: 'system@localhost' }
    })

    if (!systemUser) {
      systemUser = await db.user.create({
        data: {
          email: 'system@localhost',
          name: 'System User',
          role: 'ADMIN',
          password: 'system-password'
        }
      })
      console.log('Created system user:', systemUser)
    }

    // Create sample residents
    const sampleResidents = [
      {
        name: 'Budi Santoso',
        address: 'Jl. Merdeka No. 10',
        phone: '081234567890',
        email: 'budi@email.com',
        rt: 1,
        rw: 1,
        createdById: systemUser.id
      },
      {
        name: 'Siti Aminah',
        address: 'Jl. Sudirman No. 15',
        phone: '081234567891',
        email: 'siti@email.com',
        rt: 1,
        rw: 1,
        createdById: systemUser.id
      },
      {
        name: 'Ahmad Wijaya',
        address: 'Jl. Gatot Subroto No. 20',
        phone: '081234567892',
        email: 'ahmad@email.com',
        rt: 2,
        rw: 1,
        createdById: systemUser.id
      },
      {
        name: 'Dewi Lestari',
        address: 'Jl. Thamrin No. 25',
        phone: '081234567893',
        email: 'dewi@email.com',
        rt: 2,
        rw: 1,
        createdById: systemUser.id
      },
      {
        name: 'Eko Prasetyo',
        address: 'Jl. Pancasila No. 30',
        phone: '081234567894',
        email: 'eko@email.com',
        rt: 3,
        rw: 1,
        createdById: systemUser.id
      }
    ]

    // Delete existing residents and create new ones
    await db.resident.deleteMany()
    
    const createdResidents = await db.resident.createMany({
      data: sampleResidents
    })

    return NextResponse.json({
      message: 'Sample data created successfully',
      periods: {
        count: createdPeriods.count,
        data: periods
      },
      residents: {
        count: createdResidents.count,
        data: sampleResidents
      }
    })

  } catch (error) {
    console.error('Error creating sample data:', error)
    return NextResponse.json(
      { error: 'Failed to create sample data' },
      { status: 500 }
    )
  }
}
