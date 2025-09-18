import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { generatePaymentIndex } from '@/lib/payment-utils'

const updateResidentSchema = z.object({
  name: z.string().min(1, 'Nama warga harus diisi').optional(),
  address: z.string().min(1, 'Alamat harus diisi').optional(),
  phone: z.string().min(10, 'Nomor telepon minimal 10 digit').optional(),
  email: z.string().email('Email tidak valid').optional().nullable(),
  rt: z.number().min(1, 'RT harus diisi').max(20, 'RT maksimal 20').optional(),
  rw: z.number().min(1, 'RW harus diisi').max(20, 'RW maksimal 20').optional(),
  blok: z.string().min(1, 'BLOK harus diisi').optional(),
  house_number: z.string().min(1, 'Nomor rumah harus diisi').optional(),
  payment_index: z.number().min(1, 'Index pembayaran harus lebih dari 0').optional(),
  ownership: z.enum(['MILIK', 'SEWA']).optional().nullable(),
  is_active: z.boolean().optional(),
  rt_id: z.string().optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const resident = await db.resident.findUnique({
      where: { id: params.id },
      include: {
        created_by: {
          select: { id: true, name: true, email: true }
        },
        payments: {
          include: {
            proofs: true
          },
          orderBy: { created_at: 'desc' }
        }
      }
    })

    if (!resident) {
      return NextResponse.json(
        { error: 'Warga tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json(resident)
  } catch (error) {
    console.error('Error fetching resident:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data warga' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const validatedData = updateResidentSchema.parse(body)

    // Check if resident exists
    const existingResident = await db.$queryRaw`
      SELECT * FROM residents WHERE id = ${id} LIMIT 1
    ` as any[]

    if (!existingResident || existingResident.length === 0) {
      return NextResponse.json(
        { error: 'Warga tidak ditemukan' },
        { status: 404 }
      )
    }

    const resident = existingResident[0]

    // Check if phone already exists (if phone is being updated)
    if (validatedData.phone && validatedData.phone !== resident.phone) {
      const phoneExists = await db.$queryRaw`
        SELECT id FROM residents WHERE phone = ${validatedData.phone} AND id != ${id} LIMIT 1
      ` as any[]

      if (phoneExists && phoneExists.length > 0) {
        return NextResponse.json(
          { error: 'Nomor telepon sudah terdaftar' },
          { status: 400 }
        )
      }
    }

    // Handle payment index
    let payment_index = resident.payment_index
    
    // If payment index is explicitly provided, use it
    if (validatedData.payment_index !== undefined) {
      payment_index = validatedData.payment_index
      
      // Check if payment index already exists (excluding current resident)
      const existingPaymentIndex = await db.$queryRaw`
        SELECT id FROM residents WHERE "payment_index" = ${payment_index} AND id != ${id} LIMIT 1
      ` as any[]

      if (existingPaymentIndex && existingPaymentIndex.length > 0) {
        return NextResponse.json(
          { error: 'Index pembayaran sudah terdaftar', details: `Index pembayaran ${payment_index} sudah digunakan oleh warga lain` },
          { status: 400 }
        )
      }
    }
    // Only generate payment index if not explicitly provided and BLOK and house number are available
    else if (validatedData.blok || validatedData.house_number) {
      const blok = validatedData.blok || resident.blok
      const house_number = validatedData.house_number || resident.house_number
      
      if (blok && house_number && !resident.payment_index) {
        try {
          payment_index = generatePaymentIndex(blok, house_number)
          
          // Check if payment index already exists (excluding current resident)
          const existingPaymentIndex = await db.$queryRaw`
            SELECT id FROM residents WHERE "payment_index" = ${payment_index} AND id != ${id} LIMIT 1
          ` as any[]

          if (existingPaymentIndex && existingPaymentIndex.length > 0) {
            return NextResponse.json(
              { error: 'Index pembayaran sudah terdaftar', details: `Kombinasi BLOK ${blok} dan nomor rumah ${house_number} sudah terdaftar` },
              { status: 400 }
            )
          }
        } catch (error) {
          return NextResponse.json(
            { error: 'Gagal generate index pembayaran', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 400 }
          )
        }
      }
    }

    // Update resident using raw SQL
    const updateFields: string[] = []
    const updateValues: any[] = []

    if (validatedData.name) {
      updateFields.push('name = $' + (updateValues.length + 1))
      updateValues.push(validatedData.name)
    }
    if (validatedData.address) {
      updateFields.push('address = $' + (updateValues.length + 1))
      updateValues.push(validatedData.address)
    }
    if (validatedData.phone) {
      updateFields.push('phone = $' + (updateValues.length + 1))
      updateValues.push(validatedData.phone)
    }
    if (validatedData.email !== undefined) {
      updateFields.push('email = $' + (updateValues.length + 1))
      updateValues.push(validatedData.email === '' ? null : validatedData.email)
    }
    // Handle RT/RW updates - prioritize rt_id over individual rt/rw
    if (validatedData.rt_id !== undefined) {
      // If rt_id provided, sync rt & rw from RT table
      if (validatedData.rt_id) {
        const rt = await db.rT.findUnique({ where: { id: validatedData.rt_id } })
        if (!rt) {
          return NextResponse.json(
            { error: 'RT tidak ditemukan' },
            { status: 400 }
          )
        }
        updateFields.push('rt_id = $' + (updateValues.length + 1))
        updateValues.push(validatedData.rt_id)
        updateFields.push('rt = $' + (updateValues.length + 1))
        updateValues.push(rt.number)
        updateFields.push('rw = $' + (updateValues.length + 1))
        updateValues.push(rt.rw)
      } else {
        updateFields.push('rt_id = NULL')
        // If rt_id is null, also clear rt and rw
        updateFields.push('rt = NULL')
        updateFields.push('rw = NULL')
      }
    } else {
      // Only update individual rt/rw if rt_id is not provided
      if (validatedData.rt !== undefined) {
        updateFields.push('rt = $' + (updateValues.length + 1))
        updateValues.push(validatedData.rt)
      }
      if (validatedData.rw !== undefined) {
        updateFields.push('rw = $' + (updateValues.length + 1))
        updateValues.push(validatedData.rw)
      }
    }
    if (validatedData.blok !== undefined) {
      updateFields.push('blok = $' + (updateValues.length + 1))
      updateValues.push(validatedData.blok)
    }
    if (validatedData.house_number !== undefined) {
      updateFields.push('"house_number" = $' + (updateValues.length + 1))
      updateValues.push(validatedData.house_number)
    }
    if (payment_index !== resident.payment_index) {
      updateFields.push('"payment_index" = $' + (updateValues.length + 1))
      updateValues.push(payment_index)
    }
    if (validatedData.ownership !== undefined) {
      updateFields.push('ownership = ' + (validatedData.ownership ? `'${validatedData.ownership}'::"HouseOwnership"` : 'NULL'))
      // Don't push to updateValues since we're using direct SQL injection
    }
    if (validatedData.is_active !== undefined) {
      updateFields.push('is_active = ' + (validatedData.is_active ? 'true' : 'false'))
      // Don't push to updateValues since we're using direct SQL injection
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada data yang diupdate' },
        { status: 400 }
      )
    }

    updateFields.push('updated_at = NOW()')
    updateValues.push(id)

    // Build the dynamic SQL query
    const setClause = updateFields.join(', ')
    const updatedResident = await db.$queryRawUnsafe(
      `UPDATE residents
       SET ${setClause}
       WHERE id = $${updateValues.length}
       RETURNING id, name, address, phone, email, rt, rw, blok, "house_number", "payment_index", ownership, "is_active", "created_at", "updated_at", "created_by_id", "rt_id"`,
      ...updateValues
    ) as any[]

    // Get the creator info
    const created_by = await db.$queryRaw`
      SELECT id, name, email FROM users WHERE id = ${updatedResident[0].created_by_id} LIMIT 1
    ` as any[]

    return NextResponse.json({
      ...updatedResident[0],
      created_by: created_by[0]
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error updating resident:', error)
    return NextResponse.json(
      { error: 'Gagal mengupdate data warga' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if resident exists
    const existingResident = await db.resident.findUnique({
      where: { id: params.id }
    })

    if (!existingResident) {
      return NextResponse.json(
        { error: 'Warga tidak ditemukan' },
        { status: 404 }
      )
    }

    // Soft delete - set is_active to false
    await db.resident.update({
      where: { id: params.id },
      data: { is_active: false }
    })

    return NextResponse.json({ message: 'Warga berhasil dihapus' })
  } catch (error) {
    console.error('Error deleting resident:', error)
    return NextResponse.json(
      { error: 'Gagal menghapus warga' },
      { status: 500 }
    )
  }
}
