import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateRTSchema = z.object({
  number: z.number().min(1, 'Nomor RT harus diisi').optional(),
  rw: z.number().min(1, 'Nomor RW harus diisi').optional(),
  chairman: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rt = await db.rT.findUnique({
      where: { id: params.id },
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
    })

    if (!rt) {
      return NextResponse.json(
        { error: 'RT tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json(rt)
  } catch (error) {
    console.error('Error fetching RT:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data RT' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const validatedData = updateRTSchema.parse(body)

    // Check if RT exists
    const existingRT = await db.rT.findUnique({
      where: { id: params.id }
    })

    if (!existingRT) {
      return NextResponse.json(
        { error: 'RT tidak ditemukan' },
        { status: 404 }
      )
    }

    // If updating number or RW, check for duplicates
    if (validatedData.number || validatedData.rw) {
      const number = validatedData.number || existingRT.number
      const rw = validatedData.rw || existingRT.rw
      
      const duplicateRT = await db.rT.findFirst({
        where: {
          number,
          rw,
          id: { not: params.id }
        }
      })

      if (duplicateRT) {
        return NextResponse.json(
          { error: 'RT dengan nomor dan RW tersebut sudah ada' },
          { status: 400 }
        )
      }
    }

    const rt = await db.rT.update({
      where: { id: params.id },
      data: validatedData
    })

    return NextResponse.json(rt)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating RT:', error)
    return NextResponse.json(
      { error: 'Gagal memperbarui RT' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check if RT exists
    const existingRT = await db.rT.findUnique({
      where: { id: params.id }
    })

    if (!existingRT) {
      return NextResponse.json(
        { error: 'RT tidak ditemukan' },
        { status: 404 }
      )
    }

    // Check if RT has residents
    const residentsCount = await db.resident.count({
      where: { rtId: params.id }
    })

    if (residentsCount > 0) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus RT yang masih memiliki warga' },
        { status: 400 }
      )
    }

    await db.rT.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ 
      message: 'RT berhasil dihapus' 
    })
  } catch (error) {
    console.error('Error deleting RT:', error)
    return NextResponse.json(
      { error: 'Gagal menghapus RT' },
      { status: 500 }
    )
  }
}