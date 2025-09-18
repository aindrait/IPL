import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const createScheduleSchema = z.object({
  name: z.string().min(1, 'Nama jadwal harus diisi'),
  description: z.string().optional(),
  start_date: z.string().min(1, 'Tanggal mulai harus diisi'),
  end_date: z.string().min(1, 'Tanggal selesai harus diisi'),
  period_id: z.string().min(1, 'Periode harus dipilih'),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    
    const skip = (page - 1) * limit

    const [schedules, total] = await Promise.all([
      db.paymentSchedule.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          period: {
            select: {
              id: true,
              name: true,
              month: true,
              year: true,
              amount: true
            }
          },
          created_by: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      }),
      db.paymentSchedule.count()
    ])

    return NextResponse.json({
      schedules,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching schedules:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data jadwal' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createScheduleSchema.parse(body)

    // Check if period exists
    const period = await db.paymentPeriod.findUnique({
      where: { id: validatedData.period_id }
    })

    if (!period) {
      return NextResponse.json(
        { error: 'Periode tidak ditemukan' },
        { status: 404 }
      )
    }

    // Get user from localStorage (in real app, use auth)
    const userId = 'system-user-id' // This should come from authentication

    const schedule = await db.paymentSchedule.create({
      data: {
        ...validatedData,
        start_date: new Date(validatedData.start_date),
        end_date: new Date(validatedData.end_date),
        created_by_id: userId,
      },
      include: {
        period: {
          select: {
            id: true,
            name: true,
            month: true,
            year: true,
            amount: true
          }
        },
        created_by: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating schedule:', error)
    return NextResponse.json(
      { error: 'Gagal membuat jadwal' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const schedule_id = searchParams.get('id')
    
    if (!schedule_id) {
      return NextResponse.json(
        { error: 'ID jadwal harus disertakan' },
        { status: 400 }
      )
    }

    // Check if schedule exists
    const schedule = await db.paymentSchedule.findUnique({
      where: { id: schedule_id }
    })

    if (!schedule) {
      return NextResponse.json(
        { error: 'Jadwal tidak ditemukan' },
        { status: 404 }
      )
    }

    // Delete all schedule items associated with this schedule
    await db.paymentScheduleItem.deleteMany({
      where: { schedule_id }
    })

    // Delete the schedule
    await db.paymentSchedule.delete({
      where: { id: schedule_id }
    })

    return NextResponse.json({
      message: 'Jadwal dan item terkait berhasil dihapus'
    })
  } catch (error) {
    console.error('Error deleting schedule:', error)
    return NextResponse.json(
      { error: 'Gagal menghapus jadwal' },
      { status: 500 }
    )
  }
}