import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const createRTSchema = z.object({
  number: z.number().min(1, 'Nomor RT harus diisi'),
  rw: z.number().min(1, 'Nomor RW harus diisi'),
  chairman: z.string().optional(),
  phone: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const rw = searchParams.get('rw') ? parseInt(searchParams.get('rw')!) : undefined
    
    const skip = (page - 1) * limit

    const where: any = {}
    if (rw) where.rw = rw

    const [rts, total] = await Promise.all([
      db.rT.findMany({
        where,
        skip,
        take: limit,
        orderBy: { number: 'asc' },
        include: {
          residents: {
            select: {
              id: true,
              name: true,
              blok: true,
              houseNumber: true,
              isActive: true,
            }
          }
        }
      }),
      db.rT.count({ where }),
    ])

    return NextResponse.json({
      rts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching RTs:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data RT' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = createRTSchema.parse(body)

    // Check if RT with same number and RW already exists
    // For single-RW system, prevent duplicate RT number regardless of RW
    const existingRT = await db.rT.findFirst({
      where: { number: validatedData.number }
    })

    if (existingRT) {
      return NextResponse.json(
        { error: 'Nomor RT sudah ada dalam sistem' },
        { status: 400 }
      )
    }

    const rt = await db.rT.create({
      data: validatedData
    })

    return NextResponse.json(rt, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating RT:', error)
    return NextResponse.json(
      { error: 'Gagal membuat RT' },
      { status: 500 }
    )
  }
}