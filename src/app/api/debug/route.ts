import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Test database connection
    await db.$queryRaw`SELECT 1`
    
    // Count records in each table
    const [residentsCount, periodsCount, paymentsCount] = await Promise.all([
      db.resident.count(),
      db.paymentPeriod.count(),
      db.payment.count()
    ])

    // Get sample data
    const [sampleResident, samplePeriod] = await Promise.all([
      db.resident.findFirst(),
      db.paymentPeriod.findFirst()
    ])

    return NextResponse.json({
      status: 'Database connected successfully',
      counts: {
        residents: residentsCount,
        periods: periodsCount,
        payments: paymentsCount
      },
      samples: {
        resident: sampleResident,
        period: samplePeriod
      }
    })
  } catch (error) {
    console.error('Database connection error:', error)
    return NextResponse.json(
      { 
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}