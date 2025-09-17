import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { promises as fs } from 'fs'
import path from 'path'
import { validatePaymentAmount } from '@/lib/payment-utils'

const createPaymentSchema = z.object({
  residentId: z.string().min(1, 'ID warga harus diisi'),
  periodId: z.string().optional(),
  amount: z.number().min(1, 'Jumlah pembayaran harus lebih dari 0'),
  paymentDate: z.string().min(1, 'Tanggal pembayaran harus diisi'),
  paymentMethod: z.string().optional(),
  notes: z.string().nullable().optional(),
  scheduleItemId: z.string().optional(),
}).refine(data => data.periodId || data.scheduleItemId, {
  message: 'Periode atau item jadwal harus dipilih',
  path: ['periodId'],
}).refine(data => {
  // If both periodId and scheduleItemId are provided, we need to validate they match
  if (data.periodId && data.scheduleItemId) {
    console.log('Both periodId and scheduleItemId provided - this is allowed but needs validation')
    return true // Allow both to be provided, we'll validate the relationship later
  }
  return true
}, {
  message: 'Validasi kombinasi periode dan item jadwal',
  path: ['scheduleItemId'],
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '10')))
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status')
    const residentId = searchParams.get('residentId')
    const periodId = searchParams.get('periodId')
    const rtFilter = searchParams.get('rt')
    const yearFilter = searchParams.get('year')

    const skip = (page - 1) * limit

    console.log('Fetching payments with params:', { page, limit, search, status, residentId, periodId })

    // Build where clause safely
    const where: any = {}

    if (search && search.trim()) {
      where.OR = [
        { resident: { name: { contains: search.trim(), mode: 'insensitive' } } },
        { notes: { contains: search.trim(), mode: 'insensitive' } },
      ]
    }

    if (status && status.trim()) {
      where.status = status.trim()
    }

    if (residentId && residentId.trim()) {
      where.residentId = residentId.trim()
    }

    if (periodId && periodId.trim()) {
      where.periodId = periodId.trim()
    }

    console.log('Where clause:', JSON.stringify(where, null, 2))

    try {
      // Build WHERE conditions for the raw SQL query
      let whereConditions: string[] = [];
      let whereParams: any[] = [];
      
      if (status && status.trim()) {
        whereConditions.push('p.status = ?');
        whereParams.push(status.trim());
      }
      
      if (search && search.trim()) {
        whereConditions.push('(r.name LIKE ? OR p.notes LIKE ?)');
        const searchTerm = `%${search.trim()}%`;
        whereParams.push(searchTerm, searchTerm);
      }
      
      if (residentId && residentId.trim()) {
        whereConditions.push('p.residentId = ?');
        whereParams.push(residentId.trim());
      }
      
      // Note: periodId filter removed since payments no longer have direct period relationship

      if (rtFilter && rtFilter.trim() && rtFilter.trim() !== 'all') {
        whereConditions.push('r.rt = ?');
        whereParams.push(parseInt(rtFilter.trim(), 10));
      }
      
      if (yearFilter && yearFilter.trim() && yearFilter.trim() !== 'all') {
        // Robust year extraction: works for TEXT ISO, unix epoch seconds, or milliseconds
        whereConditions.push(`COALESCE(
          strftime('%Y', p.paymentDate),
          strftime('%Y', datetime(p.paymentDate, 'unixepoch')),
          strftime('%Y', datetime(p.paymentDate/1000, 'unixepoch'))
        ) = ?`);
        whereParams.push(yearFilter.trim());
      }
      
      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';
      
      // Build the complete SQL query with parameters
      const offsetValue = (page - 1) * limit;
      const baseQuery = `
        SELECT
          p.id,
          p.amount,
          p.paymentDate,
          p.status,
          p.notes,
          p.createdAt,
          r.id as residentId,
          r.name as residentName,
          r.address as residentAddress,
          r.phone as residentPhone,
          r.blok as residentBlok,
          r.houseNumber as residentHouseNumber,
          r.rt as residentRt,
          r.rw as residentRw,
          (
            SELECT JSON_GROUP_ARRAY(
              JSON_OBJECT(
                'id', psi.id,
                'type', psi.type,
                'label', psi.label,
                'status', psi.status,
                'amount', psi.amount,
                'dueDate', psi.dueDate,
                'paidDate', psi.paidDate,
                'period', JSON_OBJECT(
                  'id', pp.id,
                  'name', pp.name,
                  'month', pp.month,
                  'year', pp.year,
                  'amount', pp.amount,
                  'dueDate', pp.dueDate
                )
              )
            )
            FROM payment_schedule_items psi
            LEFT JOIN payment_periods pp ON psi.periodId = pp.id
            WHERE psi.paymentId = p.id
          ) as scheduleItems,
          (
            SELECT JSON_GROUP_ARRAY(
              JSON_OBJECT(
                'id', pr.id,
                'filename', pr.filename,
                'filePath', pr.filePath,
                'fileSize', pr.fileSize,
                'mimeType', pr.mimeType,
                'analyzed', pr.analyzed,
                'analysisResult', pr.analysisResult,
                'createdAt', pr.createdAt
              )
            )
            FROM payment_proofs pr
            WHERE pr.paymentId = p.id
          ) as proofs
        FROM payments p
        LEFT JOIN residents r ON p.residentId = r.id
        ${whereClause}
        ORDER BY p.createdAt DESC
        LIMIT ${limit} OFFSET ${offsetValue}
      `;
      
      // Execute the query with parameters
      const payments = await db.$queryRawUnsafe(baseQuery, ...whereParams);

      // Total count with same filters for consistency
      const countQuery = `
        SELECT COUNT(*) as count
        FROM payments p
        LEFT JOIN residents r ON p.residentId = r.id
        ${whereClause}
      `;
      const totalResult = await db.$queryRawUnsafe(countQuery, ...whereParams);
      const total = Array.isArray(totalResult) && totalResult[0] ? Number(totalResult[0].count) : 0

      console.log('Found payments:', Array.isArray(payments) ? payments.length : 'not array', 'Total:', total)

      // Format the response to parse JSON fields
      const formattedPayments = Array.isArray(payments) ? payments.map((payment: any) => ({
        id: payment.id,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        status: payment.status,
        notes: payment.notes,
        createdAt: payment.createdAt,
        updatedAt: payment.createdAt, // Use createdAt as fallback
        resident: {
          id: payment.residentId,
          name: payment.residentName,
          address: payment.residentAddress,
          phone: payment.residentPhone,
          blok: payment.residentBlok,
          houseNumber: payment.residentHouseNumber,
          rt: payment.residentRt,
          rw: payment.residentRw,
        },
        scheduleItems: payment.scheduleItems ? (() => {
          try {
            return JSON.parse(payment.scheduleItems);
          } catch (e) {
            console.warn('Failed to parse scheduleItems JSON:', e);
            return [];
          }
        })() : [],
        proofs: payment.proofs ? (() => {
          try {
            return JSON.parse(payment.proofs);
          } catch (e) {
            console.warn('Failed to parse proofs JSON:', e);
            return [];
          }
        })() : [],
      })) : []

      return NextResponse.json({
        payments: formattedPayments,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (dbError) {
      console.error('Database query error:', dbError)
      return NextResponse.json(
        { error: 'Database query failed', details: dbError instanceof Error ? dbError.message : 'Unknown database error' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Gagal mengambil data pembayaran', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    // Extract payment data
    const amountValue = formData.get('amount')
    let parsedAmount: number
    
    if (!amountValue || amountValue === '') {
      return NextResponse.json(
        { error: 'Validasi gagal', details: [{ field: 'amount', message: 'Jumlah pembayaran harus diisi' }] },
        { status: 400 }
      )
    }
    
    const num = parseFloat(amountValue as string)
    if (isNaN(num) || num <= 0) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: [{ field: 'amount', message: 'Jumlah pembayaran harus lebih dari 0' }] },
        { status: 400 }
      )
    }
    
    parsedAmount = num
    
    const paymentData = {
      residentId: formData.get('residentId') as string,
      periodId: formData.get('periodId') as string || undefined,
      amount: parsedAmount,
      paymentDate: formData.get('paymentDate') as string,
      paymentMethod: formData.get('paymentMethod') as string || undefined,
      notes: formData.get('notes') as string || null,
      scheduleItemId: (formData.get('scheduleItemId') as string) || undefined,
    }

    console.log('=== VALIDATION DEBUG ===')
    console.log('Payment data before validation:', paymentData)
    
    try {
      const validatedData = createPaymentSchema.parse(paymentData)
      console.log('Validated data:', validatedData)
      console.log('Validation successful!')
    } catch (validationError) {
      console.error('=== VALIDATION ERROR ===')
      console.error('Error type:', validationError instanceof Error ? validationError.constructor.name : typeof validationError)
      console.error('Error message:', validationError instanceof Error ? validationError.message : validationError)
      if (validationError instanceof z.ZodError) {
        console.error('ZodError issues:', validationError.issues)
      }
      throw validationError
    }
    
    const validatedData = createPaymentSchema.parse(paymentData)

    // Check if resident exists
    console.log('Checking resident existence...')
    const residentResult = await db.$queryRaw`
      SELECT * FROM residents WHERE id = ${validatedData.residentId} LIMIT 1
    ` as any[]
    console.log('Resident result:', residentResult)

    if (!residentResult || residentResult.length === 0) {
      return NextResponse.json(
        { error: 'Warga tidak ditemukan', details: `ID warga ${validatedData.residentId} tidak terdaftar dalam sistem` },
        { status: 404 }
      )
    }

    const resident = residentResult[0]

    // Check if period exists only if periodId is provided
    let period: any = null
    if (validatedData.periodId) {
      period = await db.paymentPeriod.findUnique({
        where: { id: validatedData.periodId }
      })

      if (!period) {
        return NextResponse.json(
          { error: 'Periode pembayaran tidak ditemukan', details: `ID periode ${validatedData.periodId} tidak terdaftar dalam sistem` },
          { status: 404 }
        )
      }

      // Check if payment already exists for this resident and period through schedule items
      const existingPayment = await db.$queryRaw`
        SELECT p.id
        FROM payments p
        JOIN payment_schedule_items psi ON p.id = psi.paymentId
        WHERE p.residentId = ${validatedData.residentId} AND psi.periodId = ${validatedData.periodId} LIMIT 1
      ` as any[]

      if (existingPayment && existingPayment.length > 0) {
        return NextResponse.json(
          { error: 'Pembayaran untuk periode ini sudah tercatat', details: `Warga ${resident.name} sudah memiliki pembayaran untuk periode ${period.name}` },
          { status: 400 }
        )
      }
    }

    // If scheduleItemId is provided, check if it exists and is not already paid
    if (validatedData.scheduleItemId) {
      const scheduleItem = await db.paymentScheduleItem.findUnique({
        where: { id: validatedData.scheduleItemId },
        include: { period: true }
      })

      if (!scheduleItem) {
        return NextResponse.json(
          { error: 'Item jadwal tidak ditemukan', details: `ID item jadwal ${validatedData.scheduleItemId} tidak terdaftar dalam sistem` },
          { status: 404 }
        )
      }

      if (scheduleItem.paymentId) {
        return NextResponse.json(
          { error: 'Item jadwal sudah dibayar', details: `Item jadwal untuk periode ${scheduleItem.period?.name || 'tidak diketahui'} sudah memiliki pembayaran` },
          { status: 400 }
        )
      }

      // Set periodId from schedule item if not provided
      if (!validatedData.periodId && scheduleItem.periodId) {
        validatedData.periodId = scheduleItem.periodId
        period = scheduleItem.period
      }
    }

    // No payment validation needed at this point
    // Payment index will be used for OCR verification or bank statement cross-checking

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
            password: 'system_password_hash', // In a real app, this should be properly hashed
            role: 'ADMIN'
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

    // Create payment
    let payment
    try {
      console.log('=== PAYMENT CREATION DEBUG ===')
      console.log('Validated data before creation:', validatedData)
      console.log('System user ID:', systemUser.id)
      
      // Remove periodId and scheduleItemId from payment creation data as they're no longer in the payments table
      // These will be handled through the schedule item linking process
      const { periodId, scheduleItemId, ...paymentDataWithoutRelations } = validatedData
      
      const paymentCreateData = {
        ...paymentDataWithoutRelations,
        paymentDate: new Date(validatedData.paymentDate),
        createdById: systemUser.id,
      }
      
      console.log('Payment creation data (removed periodId and scheduleItemId):', paymentCreateData)
      console.log('Schedule item ID for linking:', scheduleItemId)
      console.log('Period ID for validation:', periodId)
      
      payment = await db.payment.create({
        data: paymentCreateData,
        include: {
          resident: {
            select: { id: true, name: true, address: true, phone: true }
          },
          createdBy: {
            select: { id: true, name: true, email: true }
          },
          scheduleItems: {
            include: {
              period: {
                select: { id: true, name: true, month: true, year: true, amount: true }
              }
            }
          }
        } as any
      })
      
      console.log('Payment created successfully:', payment.id)
    } catch (paymentError) {
      console.error('=== PAYMENT CREATION ERROR ===')
      console.error('Error type:', paymentError instanceof Error ? paymentError.constructor.name : typeof paymentError)
      console.error('Error message:', paymentError instanceof Error ? paymentError.message : paymentError)
      console.error('Error stack:', paymentError instanceof Error ? paymentError.stack : 'No stack trace')
      console.error('Error creating payment record:', paymentError)
      return NextResponse.json(
        { error: 'Gagal membuat catatan pembayaran', details: paymentError instanceof Error ? paymentError.message : 'Unknown error' },
        { status: 500 }
      )
    }

    // Link payment to schedule item if available
    try {
      console.log('=== SCHEDULE ITEM LINKING DEBUG ===')
      console.log('Validated data:', validatedData)
      console.log('Payment ID:', payment.id)
      
      if (validatedData.scheduleItemId) {
        console.log('Linking to specific schedule item:', validatedData.scheduleItemId)
        const item = await db.paymentScheduleItem.findUnique({ where: { id: validatedData.scheduleItemId } })
        console.log('Found schedule item:', item)
        
        if (item && !item.paymentId) {
          console.log('Updating schedule item with payment ID and PAID status')
          await db.paymentScheduleItem.update({
            where: { id: item.id },
            data: {
              paymentId: payment.id,
              status: 'PAID',
              paidDate: new Date(validatedData.paymentDate)
            }
          })
          console.log('Schedule item successfully flagged as PAID and linked to payment')
        } else if (item && item.paymentId) {
          console.warn('Schedule item already linked to payment:', item.paymentId)
        } else {
          console.warn('Schedule item not found')
        }
      } else {
        console.log('No scheduleItemId provided, trying fallback with resident + period')
        console.log('Resident ID:', validatedData.residentId)
        console.log('Period ID:', validatedData.periodId)
        
        // Fallback: link by resident + period if an item exists and not linked
        const item = await db.paymentScheduleItem.findFirst({
          where: {
            residentId: validatedData.residentId,
            periodId: validatedData.periodId,
            paymentId: null,
          },
          orderBy: { dueDate: 'asc' },
        })
        console.log('Found fallback schedule item:', item)
        
        if (item) {
          console.log('Updating fallback schedule item with payment ID and PAID status')
          await db.paymentScheduleItem.update({
            where: { id: item.id },
            data: {
              paymentId: payment.id,
              status: 'PAID',
              paidDate: new Date(validatedData.paymentDate)
            }
          })
          console.log('Fallback schedule item successfully flagged as PAID and linked to payment')
        } else {
          console.warn('No fallback schedule item found')
        }
      }
    } catch (linkErr) {
      console.error('=== SCHEDULE ITEM LINKING ERROR ===')
      console.error('Error type:', linkErr instanceof Error ? linkErr.constructor.name : typeof linkErr)
      console.error('Error message:', linkErr instanceof Error ? linkErr.message : linkErr)
      console.error('Error stack:', linkErr instanceof Error ? linkErr.stack : 'No stack trace')
      console.warn('Failed to link payment to schedule item:', linkErr)
    }

    // Handle file uploads
    const files = formData.getAll('files') as File[]
    console.log('=== FILE UPLOAD DEBUG ===')
    console.log('Number of files received:', files.length)
    console.log('FormData keys:', Array.from(formData.keys()))
    console.log('FormData entries:')
    for (let [key, value] of formData.entries()) {
      if (key === 'files') {
        console.log(`  ${key}: [File object]`)
      } else {
        console.log(`  ${key}: ${value}`)
      }
    }
    
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      console.log('Upload directory:', uploadDir)
      
      try {
        // Ensure upload directory exists with proper permissions
        try {
          await fs.access(uploadDir)
          console.log('Uploads directory exists:', uploadDir)
        } catch {
          try {
            await fs.mkdir(uploadDir, { recursive: true, mode: 0o755 })
            console.log('Created uploads directory with permissions:', uploadDir)
          } catch (dirError) {
            console.error('Error creating uploads directory:', dirError)
            return NextResponse.json(
              { error: 'Gagal membuat direktori unggahan', details: dirError instanceof Error ? dirError.message : 'Unknown error' },
              { status: 500 }
            )
          }
        }

        for (const file of files) {
          console.log(`Processing file: ${file.name}, size: ${file.size}, type: ${file.type}`)
          
          if (file.size > 0) {
            try {
              // Generate a unique filename
              const filename = `${Date.now()}-${file.name}`
              const filePath = `/uploads/${filename}`
              const fullPath = path.join(uploadDir, filename)
              
              console.log(`Saving file to: ${fullPath}`)
              const buffer = Buffer.from(await file.arrayBuffer())
              await fs.writeFile(fullPath, buffer)
              console.log(`File saved successfully: ${filename}`)

              // Create payment proof record
              console.log(`Creating payment proof record for payment: ${payment.id}`)
              const proof = await db.paymentProof.create({
                data: {
                  filename: file.name,
                  filePath,
                  fileSize: file.size,
                  mimeType: file.type,
                  paymentId: payment.id,
                }
              })
              console.log(`Payment proof created successfully: ${proof.id}`)
            } catch (fileError) {
              console.error('=== FILE UPLOAD ERROR ===')
              console.error('Error processing file upload:', fileError)
              console.error('File error details:', {
                name: file.name,
                size: file.size,
                type: file.type,
                paymentId: payment.id,
                error: fileError instanceof Error ? fileError.message : 'Unknown error',
                stack: fileError instanceof Error ? fileError.stack : 'No stack trace'
              })
              
              // Check if it's a database error
              if (fileError instanceof Error) {
                if (fileError.message.includes('FOREIGN KEY')) {
                  console.error('FOREIGN KEY constraint failed - payment might not exist')
                } else if (fileError.message.includes('UNIQUE')) {
                  console.error('UNIQUE constraint failed - duplicate proof?')
                } else if (fileError.message.includes('NOT NULL')) {
                  console.error('NOT NULL constraint failed - missing required field')
                }
              }
              
              // Continue with other files even if one fails, but log the error
              console.log(`Failed to process file ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`)
            }
          } else {
            console.log(`Skipping empty file: ${file.name}`)
          }
        }
      } catch (uploadError) {
        console.error('Error in file upload process:', uploadError)
        console.error('Upload error details:', {
          error: uploadError instanceof Error ? uploadError.message : 'Unknown error',
          stack: uploadError instanceof Error ? uploadError.stack : 'No stack trace'
        })
        // Don't return an error response here as we want to continue even if file upload fails
        // The payment was already created successfully, we just log the error
      }
    } else {
      console.log('No files to upload')
    }

    // Fetch the complete payment with proofs for response
    const completePayment = await db.payment.findUnique({
      where: { id: payment.id },
      include: {
        resident: {
          select: { id: true, name: true, address: true, phone: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        scheduleItems: {
          include: {
            period: {
              select: { id: true, name: true, month: true, year: true, amount: true }
            }
          }
        },
        proofs: true
      }
    })

    console.log('=== FINAL PAYMENT RESULT ===')
    console.log('Payment ID:', payment.id)
    console.log('Proofs count:', completePayment?.proofs.length || 0)
    if (completePayment?.proofs) {
      console.log('Proofs details:', completePayment.proofs.map(p => ({ id: p.id, filename: p.filename, filePath: p.filePath })))
    }

    return NextResponse.json(completePayment || payment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error creating payment:', error)
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Gagal menambahkan pembayaran'
    let errorDetails = error instanceof Error ? error.message : 'Unknown error'
    
    if (error instanceof Error) {
      // Check for specific database constraint errors
      if (error.message.includes('UNIQUE constraint failed')) {
        errorMessage = 'Pembayaran sudah tercatat di sistem'
        errorDetails = 'Terdapat pembayaran dengan warga dan periode yang sama'
      } else if (error.message.includes('FOREIGN KEY constraint failed')) {
        errorMessage = 'Data referensi tidak valid'
        errorDetails = 'Pastikan warga dan periode pembayaran sudah terdaftar di sistem'
      } else if (error.message.includes('database')) {
        errorMessage = 'Kesalahan database'
        errorDetails = 'Terjadi masalah saat menyimpan data ke database'
      }
    }
    
    return NextResponse.json(
      { error: errorMessage, details: errorDetails },
      { status: 500 }
    )
  }
}

// Bulk create payments from schedule items (initially marked PENDING, validation done later)
const bulkSchema = z.object({
  itemIds: z.array(z.string()).min(1),
  paymentDate: z.string(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
})

export async function PUT(request: NextRequest) {
  try {
    // Check if request has FormData (with files) or JSON
    const contentType = request.headers.get('content-type') || ''
    
    let input: any
    let files: File[] = []
    
    if (contentType.includes('multipart/form-data')) {
      // Handle FormData with files
      const formData = await request.formData()
      
      // Extract payment data from FormData
      const itemIdsValue = formData.get('itemIds')
      if (!itemIdsValue) {
        return NextResponse.json({ error: 'itemIds harus diisi' }, { status: 400 })
      }
      
      let itemIds: string[]
      try {
        itemIds = JSON.parse(itemIdsValue as string)
      } catch {
        return NextResponse.json({ error: 'itemIds format tidak valid' }, { status: 400 })
      }
      
      input = {
        itemIds,
        paymentDate: formData.get('paymentDate') as string,
        paymentMethod: formData.get('paymentMethod') as string || undefined,
        notes: formData.get('notes') as string || undefined,
      }
      
      // Get files
      files = formData.getAll('files') as File[]
      console.log('=== BULK PAYMENT FILE UPLOAD DEBUG ===')
      console.log('Number of files received:', files.length)
      console.log('FormData keys:', Array.from(formData.keys()))
    } else {
      // Handle JSON (existing logic)
      const body = await request.json()
      input = body
    }
    
    const validatedInput = bulkSchema.parse(input)

    // Ensure system user exists
    let systemUser = await db.user.findFirst({ where: { email: 'system@localhost' } })
    if (!systemUser) {
      systemUser = await db.user.create({
        data: { email: 'system@localhost', name: 'System User', role: 'ADMIN', password: 'system-password' },
      })
    }

    const items = await db.paymentScheduleItem.findMany({
      where: { id: { in: input.itemIds } },
      include: { period: true }
    })

    if (items.length === 0) {
      return NextResponse.json({ error: 'Item tidak ditemukan' }, { status: 404 })
    }

    // Validate all items belong to the same resident
    const residentIds = [...new Set(items.map(it => it.residentId))]
    if (residentIds.length > 1) {
      return NextResponse.json({ error: 'Semua item harus dari warga yang sama' }, { status: 400 })
    }

    // Check if any items are already paid
    const alreadyPaid = items.filter(it => it.paymentId)
    if (alreadyPaid.length > 0) {
      return NextResponse.json({ error: 'Beberapa item sudah dibayar' }, { status: 400 })
    }

    // Create one payment for multiple schedule items (PENDING for later OCR validation)
    const result = await db.$transaction(async (tx) => {
      // Calculate total amount
      const totalAmount = items.reduce((sum, it) => sum + it.amount, 0)
      
      // Create single payment
      const payment = await tx.payment.create({
        data: {
          amount: totalAmount,
          paymentDate: new Date(input.paymentDate),
          status: 'PENDING',
          paymentMethod: input.paymentMethod,
          notes: input.notes,
          residentId: items[0].residentId, // All items have same residentId
          createdById: systemUser!.id,
        } as any,
      })

      // Link all schedule items to this payment
      await tx.paymentScheduleItem.updateMany({
        where: { id: { in: input.itemIds } },
        data: { 
          paymentId: payment.id,
          status: 'PAID',
          paidDate: new Date(input.paymentDate)
        }
      })

      return payment
    })

    // Handle file uploads for bulk payment
    if (files.length > 0) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads')
      console.log('Bulk payment upload directory:', uploadDir)
      
      try {
        // Ensure upload directory exists
        try {
          await fs.access(uploadDir)
          console.log('Uploads directory exists:', uploadDir)
        } catch {
          try {
            await fs.mkdir(uploadDir, { recursive: true, mode: 0o755 })
            console.log('Created uploads directory with permissions:', uploadDir)
          } catch (dirError) {
            console.error('Error creating uploads directory:', dirError)
          }
        }

        for (const file of files) {
          console.log(`Processing bulk payment file: ${file.name}, size: ${file.size}, type: ${file.type}`)
          
          if (file.size > 0) {
            try {
              // Generate a unique filename
              const filename = `${Date.now()}-${file.name}`
              const filePath = `/uploads/${filename}`
              const fullPath = path.join(uploadDir, filename)
              
              console.log(`Saving bulk payment file to: ${fullPath}`)
              const buffer = Buffer.from(await file.arrayBuffer())
              await fs.writeFile(fullPath, buffer)
              console.log(`Bulk payment file saved successfully: ${filename}`)

              // Create payment proof record
              console.log(`Creating bulk payment proof record for payment: ${result.id}`)
              const proof = await db.paymentProof.create({
                data: {
                  filename: file.name,
                  filePath,
                  fileSize: file.size,
                  mimeType: file.type,
                  paymentId: result.id,
                }
              })
              console.log(`Bulk payment proof created successfully: ${proof.id}`)
            } catch (fileError) {
              console.error('=== BULK PAYMENT FILE UPLOAD ERROR ===')
              console.error('Error processing bulk payment file upload:', fileError)
              console.error('File error details:', {
                name: file.name,
                size: file.size,
                type: file.type,
                paymentId: result.id,
                error: fileError instanceof Error ? fileError.message : 'Unknown error',
                stack: fileError instanceof Error ? fileError.stack : 'No stack trace'
              })
            }
          } else {
            console.log(`Skipping empty bulk payment file: ${file.name}`)
          }
        }
      } catch (uploadError) {
        console.error('Error in bulk payment file upload process:', uploadError)
      }
    } else {
      console.log('No files to upload for bulk payment')
    }

    return NextResponse.json({ message: 'Pembayaran dibuat (PENDING)', payment: result, itemsCount: items.length })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validasi gagal', details: error.issues }, { status: 400 })
    }
    console.error('Error creating bulk payments:', error)
    return NextResponse.json({ error: 'Gagal membuat pembayaran massal' }, { status: 500 })
  }
}
