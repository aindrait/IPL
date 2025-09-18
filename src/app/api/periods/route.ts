import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const createPeriodSchema = z.object({
  name: z.string().min(1, 'Nama periode harus diisi'),
  month: z.number().min(1, 'Bulan harus diisi').max(12, 'Bulan tidak valid'),
  year: z.number().min(2020, 'Tahun tidak valid'),
  amount: z.number().min(1, 'Jumlah iuran harus lebih dari 0'),
  due_date: z.string().min(1, 'Tanggal jatuh tempo harus diisi'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const where: any = {}
    if (activeOnly) {
      where.is_active = true
    }

    const periods = await db.paymentPeriod.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      include: {
        _count: {
          select: {
            schedule_items: true
          }
        }
      }
    })

    return NextResponse.json(periods)
  } catch (error) {
    console.error('Error fetching periods:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data periode' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createPeriodSchema.parse(body)

    // Check if period already exists
    const existingPeriod = await db.paymentPeriod.findFirst({
      where: {
        month: validatedData.month,
        year: validatedData.year,
      }
    })

    if (existingPeriod) {
      return NextResponse.json(
        { error: 'Periode untuk bulan dan tahun ini sudah ada' },
        { status: 400 }
      )
    }

    const period = await db.paymentPeriod.create({
      data: {
        ...validatedData,
        due_date: new Date(validatedData.due_date),
      }
    })

    return NextResponse.json(period, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating period:', error)
    return NextResponse.json(
      { error: 'Gagal menambahkan periode' },
      { status: 500 }
    )
  }
}
