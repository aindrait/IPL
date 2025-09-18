import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePaymentIndex } from '@/lib/payment-utils'

const createResidentSchema = z.object({
  name: z.string().min(1, 'Nama warga harus diisi'),
  address: z.string().min(1, 'Alamat harus diisi'),
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit'),
  email: z.string().email('Email tidak valid').optional().nullable(),
  rt: z.number().min(1, 'RT harus diisi').max(20, 'RT maksimal 20'),
  rw: z.number().min(1, 'RW harus diisi').max(20, 'RW maksimal 20'),
  blok: z.string().min(1, 'BLOK harus diisi').optional(),
  houseNumber: z.string().min(1, 'Nomor rumah harus diisi').optional(),
  paymentIndex: z.number().min(1, 'Index pembayaran harus lebih dari 0').optional(),
  ownership: z.enum(['MILIK', 'SEWA']).optional().nullable(),
  rtId: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Validate query parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const rt = searchParams.get('rt')
    const rw = searchParams.get('rw')

    // Validate page and limit
    if (isNaN(page) || page < 1) {
      return NextResponse.json(
        { error: 'Parameter halaman tidak valid', details: 'Halaman harus berupa angka positif' },
        { status: 400 }
      )
    }

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Parameter batas tidak valid', details: 'Batas harus berupa angka antara 1 dan 100' },
        { status: 400 }
      )
    }

    const skip = (page - 1) * limit

    const where: any = {
      isActive: true,
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { address: { contains: search } },
        { phone: { contains: search } },
        { blok: { contains: search } },
        { houseNumber: { contains: search } },
      ]
    }

    if (rt && rt !== 'all') {
      const rtNum = parseInt(rt)
      if (isNaN(rtNum)) {
        return NextResponse.json(
          { error: 'Parameter RT tidak valid', details: 'RT harus berupa angka' },
          { status: 400 }
        )
      }
      where.rt = rtNum
    }

    if (rw && rw !== 'all') {
      const rwNum = parseInt(rw)
      if (isNaN(rwNum)) {
        return NextResponse.json(
          { error: 'Parameter RW tidak valid', details: 'RW harus berupa angka' },
          { status: 400 }
        )
      }
      where.rw = rwNum
    }

    const [residents, total] = await Promise.all([
      db.resident.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          rtRelation: {
            select: { id: true, chairman: true }
          },
          _count: {
            select: {
              payments: true
            }
          }
        },
        orderBy: { paymentIndex: 'asc' },
        skip,
        take: limit,
      }),
      db.resident.count({ where }),
    ])

    return NextResponse.json({
      residents,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching residents:', error)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('database') || error.message.includes('prisma')) {
        return NextResponse.json(
          { error: 'Kesalahan database', details: error.message },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Gagal mengambil data warga', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input data
    const validatedData = createResidentSchema.safeParse(body)
    if (!validatedData.success) {
      return NextResponse.json(
        {
          error: 'Validasi gagal',
          details: validatedData.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const data = validatedData.data

    // If rtId provided, sync rt & rw from RT table
    let rtNumber = data.rt
    let rwNumber = data.rw
    let rtId: string | null = data.rtId || null

    if (rtId) {
      const rt = await db.rT.findUnique({ where: { id: rtId } })
      if (!rt) {
        return NextResponse.json(
          { error: 'RT tidak ditemukan', details: `ID RT ${rtId} tidak terdaftar dalam sistem` },
          { status: 404 }
        )
      }
      rtNumber = rt.number
      rwNumber = rt.rw
    }

    // Check if phone already exists
    const existingResident = await db.resident.findUnique({
      where: { phone: data.phone }
    })

    if (existingResident) {
      return NextResponse.json(
        { error: 'Nomor telepon sudah terdaftar', details: `Nomor telepon ${data.phone} sudah terdaftar atas nama ${existingResident.name}` },
        { status: 409 }
      )
    }

    // Handle payment index
    let paymentIndex: number | undefined = data.paymentIndex
    
    // Only generate payment index if not explicitly provided and BLOK and house number are provided
    if (!paymentIndex && data.blok && data.houseNumber) {
      try {
        paymentIndex = generatePaymentIndex(data.blok, data.houseNumber)
        
        // Check if payment index already exists
        // Using raw query since Prisma client might not be updated
        const existingPaymentIndex = await db.$queryRaw`
          SELECT id FROM residents WHERE "paymentIndex" = ${paymentIndex} LIMIT 1
        ` as any[]

        if (existingPaymentIndex && existingPaymentIndex.length > 0) {
          return NextResponse.json(
            { error: 'Index pembayaran sudah terdaftar', details: `Kombinasi BLOK ${data.blok} dan nomor rumah ${data.houseNumber} sudah terdaftar` },
            { status: 409 }
          )
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Gagal generate index pembayaran', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 400 }
        )
      }
    }
    
    // If payment index is explicitly provided, check if it already exists
    if (paymentIndex) {
      const existingPaymentIndex = await db.$queryRaw`
        SELECT id FROM residents WHERE "paymentIndex" = ${paymentIndex} LIMIT 1
      ` as any[]

      if (existingPaymentIndex && existingPaymentIndex.length > 0) {
        return NextResponse.json(
          { error: 'Index pembayaran sudah terdaftar', details: `Index pembayaran ${paymentIndex} sudah digunakan oleh warga lain` },
          { status: 409 }
        )
      }
    }

    // Ensure 'system' user exists
    let systemUser = await db.user.findFirst({
      where: { email: 'system@localhost' }
    })

    if (!systemUser) {
      try {
        systemUser = await db.user.create({
          data: {
            email: 'system@localhost',
            name: 'System User',
            role: 'ADMIN',
            password: 'system-password-123'
          }
        })
        console.log('Created system user:', systemUser)
      } catch (createError) {
        console.error('Error creating system user:', createError)
        return NextResponse.json(
          { error: 'Gagal membuat pengguna sistem', details: createError instanceof Error ? createError.message : 'Unknown error' },
          { status: 500 }
        )
      }
    }

    // Use raw SQL to create resident since Prisma client might not be updated
    const resident = await db.$queryRaw`
      INSERT INTO residents (
        id, name, address, phone, email, rt, rw, blok, "houseNumber", "paymentIndex", ownership,
        "isActive", "createdAt", "updatedAt", "createdById", "rtId"
      ) VALUES (
        gen_random_uuid(),
        ${data.name}, ${data.address}, ${data.phone},
        ${data.email === '' ? null : data.email || null}, ${rtNumber}, ${rwNumber},
        ${data.blok || null}, ${data.houseNumber || null},
        ${paymentIndex || null}, ${data.ownership ? `'${data.ownership}'::"HouseOwnership"` : null}, 1, NOW(), NOW(), ${systemUser.id}, ${rtId}
      )
      RETURNING id, name, address, phone, email, rt, rw, blok, "houseNumber", "paymentIndex", ownership,
      "isActive", "createdAt", "updatedAt", "createdById", "rtId"
    ` as any[]

    // Get the created resident
    const createdResident = resident[0]
    
    // Get the creator info
    const createdBy = {
      id: systemUser.id,
      name: systemUser.name,
      email: systemUser.email
    }

    return NextResponse.json({
      ...createdResident,
      createdBy
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating resident:', error)
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return NextResponse.json(
          { error: 'Data sudah terdaftar', details: 'Terdapat data unik yang sudah terdaftar dalam sistem' },
          { status: 409 }
        )
      }
      
      if (error.message.includes('FOREIGN KEY constraint failed')) {
        return NextResponse.json(
          { error: 'Data referensi tidak valid', details: 'Pastikan semua data referensi sudah terdaftar' },
          { status: 400 }
        )
      }
      
      if (error.message.includes('database') || error.message.includes('prisma')) {
        return NextResponse.json(
          { error: 'Kesalahan database', details: error.message },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Gagal menambahkan warga', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
