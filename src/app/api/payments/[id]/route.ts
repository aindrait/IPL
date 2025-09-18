import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { promises as fs } from 'fs'
import path from 'path'

const updatePaymentSchema = z.object({
  amount: z.number().min(1, 'Jumlah pembayaran harus lebih dari 0').optional(),
  payment_date: z.string().min(1, 'Tanggal pembayaran harus diisi').optional(),
  status: z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional().nullable(),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        resident: {
          select: { id: true, name: true, address: true, phone: true, rt: true, rw: true }
        },
        schedule_items: {
          include: {
            period: {
              select: { id: true, name: true, month: true, year: true, amount: true, due_date: true }
            }
          }
        },
        created_by: {
          select: { id: true, name: true, email: true }
        },
        proofs: true
      }
    })

    if (!payment) {
      return NextResponse.json(
        { error: 'Pembayaran tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error('Error fetching payment:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data pembayaran' },
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
    console.log('PUT request received for payment ID:', id)
    console.log('Request headers:', Object.fromEntries(request.headers.entries()))
    
    // Check if payment exists
    const existingPayment = await db.payment.findUnique({
      where: { id },
      include: {
        proofs: true
      }
    })

    if (!existingPayment) {
      console.log('Payment not found:', id)
      return NextResponse.json(
        { error: 'Pembayaran tidak ditemukan' },
        { status: 404 }
      )
    }

    console.log('Existing payment found:', existingPayment)

    // Handle both FormData and JSON requests
    let validatedData: any
    let files: File[] = []

    const contentType = request.headers.get('content-type')
    console.log('Content-Type:', contentType)
    
    if (contentType && contentType.includes('multipart/form-data')) {
      console.log('Processing FormData request')
      // Handle FormData
      const formData = await request.formData()
      
      // Extract payment data
      const amountValue = formData.get('amount')
      let parsedAmount: number | undefined = undefined
      
      if (amountValue && amountValue !== '') {
        const num = parseFloat(amountValue as string)
        if (!isNaN(num) && num > 0) {
          parsedAmount = num
        }
      }
      
      const paymentData = {
        amount: parsedAmount,
        payment_date: formData.get('payment_date') as string,
        status: formData.get('status') as string,
        payment_method: formData.get('payment_method') as string,
        notes: formData.get('notes') as string,
      }

      console.log('Extracted payment data:', paymentData)
      console.log('Files count:', formData.getAll('files').length)

      // Remove undefined values
      Object.keys(paymentData).forEach(key => {
        if (paymentData[key] === undefined || paymentData[key] === '') {
          delete paymentData[key]
        }
      })

      validatedData = paymentData
      files = formData.getAll('files') as File[]
    } else {
      console.log('Processing JSON request')
      // Handle JSON
      const body = await request.json()
      validatedData = body
      console.log('JSON body:', validatedData)
    }

    // Validate the data
    console.log('Validating data:', validatedData)
    const parsedData = updatePaymentSchema.parse(validatedData)
    console.log('Validated data:', parsedData)

    // Update payment - filter out null values
    const updateData: any = {
      ...(parsedData.amount !== undefined && { amount: parsedData.amount }),
      ...(parsedData.payment_date && { payment_date: new Date(parsedData.payment_date) }),
      ...(parsedData.status !== null && parsedData.status !== undefined && { status: parsedData.status }),
      ...(parsedData.payment_method !== undefined && { payment_method: parsedData.payment_method }),
      ...(parsedData.notes !== undefined && { notes: parsedData.notes }),
    }
    
    console.log('Updating payment with filtered data:', updateData)
    
    const payment = await db.payment.update({
      where: { id },
      data: updateData,
      include: {
        resident: {
          select: { id: true, name: true, address: true, phone: true, rt: true, rw: true }
        },
        schedule_items: {
          include: {
            period: {
              select: { id: true, name: true, month: true, year: true, amount: true, due_date: true }
            }
          }
        },
        created_by: {
          select: { id: true, name: true, email: true }
        },
        proofs: true
      }
    })
    
    console.log('Payment updated successfully:', payment)

    // Handle file uploads if any
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      
      try {
        // Ensure upload directory exists
        try {
          await fs.access(uploadDir)
        } catch {
          await fs.mkdir(uploadDir, { recursive: true, mode: 0o755 })
        }

        for (const file of files) {
          if (file.size > 0) {
            try {
              // Generate a unique filename
              const filename = `${Date.now()}-${file.name}`
              const file_path = `/uploads/${filename}`
              
              const buffer = Buffer.from(await file.arrayBuffer())
              await fs.writeFile(path.join(uploadDir, filename), buffer)

              // Create payment proof record
              await db.paymentProof.create({
                data: {
                  filename: file.name,
                  file_path,
                  file_size: file.size,
                  mime_type: file.type,
                  payment_id: payment.id,
                }
              })
            } catch (fileError) {
              console.error('Error processing file upload:', fileError)
            }
          }
        }
      } catch (uploadError) {
        console.error('Error in file upload process:', uploadError)
      }
    }

    return NextResponse.json(payment)
  } catch (error) {
    console.error('Error updating payment:', error)
    
    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', error.issues)
      return NextResponse.json(
        { error: 'Validasi gagal', details: error.issues },
        { status: 400 }
      )
    }

    // Check for specific database errors
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
      
      if (error.message.includes('UNIQUE constraint failed')) {
        console.error('Unique constraint violation')
        return NextResponse.json(
          { error: 'Pembayaran sudah tercatat di sistem' },
          { status: 400 }
        )
      } else if (error.message.includes('FOREIGN KEY constraint failed')) {
        console.error('Foreign key constraint violation')
        return NextResponse.json(
          { error: 'Data referensi tidak valid' },
          { status: 400 }
        )
      } else if (error.message.includes('database') || error.message.includes('Database')) {
        console.error('Database error')
        return NextResponse.json(
          { error: 'Kesalahan database' },
          { status: 500 }
        )
      }
    }

    console.error('Unknown error updating payment:', error)
    return NextResponse.json(
      { error: 'Gagal mengupdate pembayaran' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('DELETE request for payment ID:', id)
    
    // Check if payment exists
    const existingPayment = await db.payment.findUnique({
      where: { id },
      include: {
        proofs: true
      }
    })

    if (!existingPayment) {
      console.log('Payment not found:', id)
      return NextResponse.json(
        { error: 'Pembayaran tidak ditemukan' },
        { status: 404 }
      )
    }

    console.log('Found payment with proofs:', existingPayment.proofs.length)

    // Delete associated proof files
    for (const proof of existingPayment.proofs) {
      try {
        const file_path = path.join(process.cwd(), 'public', proof.file_path)
        try {
          await fs.access(file_path)
          await fs.unlink(file_path)
          console.log('Successfully deleted file:', file_path)
        } catch (fileError) {
          console.log('File not found or already deleted:', file_path, fileError)
          // Continue with deletion even if file doesn't exist
        }
      } catch (error) {
        console.error('Error deleting file:', error)
        // Continue with payment deletion even if file deletion fails
      }
    }

    // Delete payment and proofs in a transaction
    console.log('Deleting payment from database...')
    
    await db.$transaction(async (tx) => {
      // Reset all schedule items linked to this payment
      console.log('Resetting schedule items linked to this payment...')
      await tx.paymentScheduleItem.updateMany({
        where: { payment_id: id },
        data: {
          payment_id: null,
          status: 'PLANNED',
          paid_date: null
        }
      })
      console.log('Schedule items reset successfully')
      
      // Delete payment proofs
      await tx.paymentProof.deleteMany({
        where: { payment_id: id }
      })
      console.log('Payment proofs deleted successfully')
      
      // Then delete the payment
      await tx.payment.delete({
        where: { id }
      })
      console.log('Payment deleted successfully')
    })

    console.log('Payment deleted successfully')
    return NextResponse.json({ message: 'Pembayaran berhasil dihapus' })
  } catch (error) {
    console.error('Error deleting payment:', error)
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    
    // Return more specific error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Gagal menghapus pembayaran: ${errorMessage}` },
      { status: 500 }
    )
  }
}
