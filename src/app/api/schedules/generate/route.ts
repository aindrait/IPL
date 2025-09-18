import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'
import { PaymentScheduleItemStatus } from '@prisma/client'

const generateSchema = z.object({
  name: z.string().min(1, 'Nama jadwal harus diisi'),
  description: z.string().optional(),
  startMonth: z.number().min(1).max(12),
  startYear: z.number().min(2000),
  months: z.number().min(1).max(24),
  amount: z.number().min(0), // Allow 0 for voluntary donations
  includeAllResidents: z.boolean().default(true).optional(),
  residentIds: z.array(z.string()).optional(),
  scheduleType: z.enum(['IPL', 'THR', 'Sumbangan']).default('IPL'),
  isMandatory: z.boolean().default(true),
  customDueDate: z.string().optional(), // Custom due date for THR and Sumbangan
  specialItems: z
    .array(
      z.object({
        label: z.string().min(1),
        amount: z.number().min(1),
        dueDate: z.string().min(1), // ISO date
      })
    )
    .optional(),
})

function getMonthName(id: number, year: number) {
  return new Date(year, id - 1).toLocaleDateString('id-ID', { month: 'long' })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = generateSchema.parse(body)
    
    // Additional validation for voluntary donations
    if (input.scheduleType === 'Sumbangan' && !input.isMandatory && input.amount > 0) {
      // For voluntary donations, force amount to 0
      input.amount = 0
    }
    
    // Validate required fields for THR and Sumbangan
    if ((input.scheduleType === 'THR' || input.scheduleType === 'Sumbangan') && !input.customDueDate) {
      return NextResponse.json({ 
        error: `Tanggal jatuh tempo harus diisi untuk ${input.scheduleType}` 
      }, { status: 400 })
    }

    // Get default payment settings
    let defaultAmount = 250000
    let dueDay = 5
    try {
      const settingsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/settings`)
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json()
        if (settingsData.paymentSettings) {
          defaultAmount = settingsData.paymentSettings.defaultAmount || 250000
          dueDay = settingsData.paymentSettings.dueDate || 5
        }
      }
    } catch (error) {
      console.log('Using default payment settings')
    }

    // Ensure system user exists
    let systemUser = await db.user.findFirst({ where: { email: 'system@localhost' } })
    if (!systemUser) {
      systemUser = await db.user.create({
        data: { email: 'system@localhost', name: 'System User', role: 'ADMIN', password: 'system-password' },
      })
    }

    // Fetch residents
    let residents: { id: string }[] = []
    if (input.includeAllResidents !== false) {
      residents = await db.resident.findMany({ where: { isActive: true }, select: { id: true } })
    } else if (input.residentIds && input.residentIds.length > 0) {
      residents = await db.resident.findMany({ where: { id: { in: input.residentIds } }, select: { id: true } })
    } else {
      return NextResponse.json({ error: 'Tidak ada warga yang dipilih' }, { status: 400 })
    }

    const schedulesCreated: any[] = []
    const itemsCreated: number[] = []

    // Handle different schedule types
    if (input.scheduleType === 'THR') {
      // THR is a special single item per year, not monthly
      const year = input.startYear
      
      // Use custom due date if provided, otherwise use the selected month
      let thrDueDate: Date
      if (input.customDueDate) {
        thrDueDate = new Date(input.customDueDate)
      } else {
        // Use the selected start month for THR due date
        thrDueDate = new Date(year, input.startMonth - 1, dueDay)
      }
      
      const thrMonth = thrDueDate.getMonth() + 1
      
      // Create or find THR period for the year
      let period = await db.paymentPeriod.findFirst({ 
        where: { 
          month: thrMonth, 
          year,
          name: { contains: 'THR' }
        } 
      })
      
      if (!period) {
        period = await db.paymentPeriod.create({
          data: {
            name: `THR ${year}`,
            month: thrMonth,
            year,
            amount: input.amount,
            dueDate: thrDueDate,
            isActive: true,
          },
        })
      } else if (period.amount !== input.amount || period.dueDate.getTime() !== thrDueDate.getTime()) {
        period = await db.paymentPeriod.update({
          where: { id: period.id },
          data: { 
            amount: input.amount,
            dueDate: thrDueDate
          }
        })
      }

      // Create THR schedule
      const schedule = await db.paymentSchedule.create({
        data: {
          name: `${input.name} - THR ${year}`,
          description: input.description,
          startDate: new Date(year, thrMonth - 1, 1),
          endDate: new Date(year, thrMonth - 1, 31),
          periodId: period.id,
          createdById: systemUser.id,
        },
      })
      schedulesCreated.push(schedule)

      // Check for existing THR items
      const existingItems = await db.paymentScheduleItem.findMany({
        where: {
          periodId: period.id,
          type: 'SPECIAL',
          residentId: { in: residents.map(r => r.id) }
        },
        select: { residentId: true }
      })
      
      const existingResidentIds = new Set(existingItems.map(item => item.residentId))
      const newResidents = residents.filter(r => !existingResidentIds.has(r.id))
      
      if (newResidents.length > 0) {
        const nowIso = new Date().toISOString()
        let inserted = 0
        for (const r of newResidents) {
          await db.$executeRaw`
            INSERT INTO payment_schedule_items (
              id, type, label, status, amount, dueDate, paidDate, notes, createdAt, updatedAt,
              scheduleId, periodId, residentId, paymentId
            ) VALUES (
              gen_random_uuid(),
              ${'SPECIAL'}, ${'THR ' + year}, ${'PLANNED'}, ${input.amount}, ${thrDueDate}, ${null}, ${'THR - Pembayaran wajib'}, ${nowIso}, ${nowIso},
              ${schedule.id}, ${period.id}, ${r.id}, ${null}
            )
          `
          inserted += 1
        }
        itemsCreated.push(inserted)
      }
      
    } else if (input.scheduleType === 'Sumbangan') {
      console.log('Generating Sumbangan with input:', { 
        amount: input.amount, 
        isMandatory: input.isMandatory, 
        customDueDate: input.customDueDate 
      })
      // Donations need specific due dates
      const year = input.startYear
      const month = input.startMonth
      
      // Use custom due date if provided, otherwise use the selected month
      let dueDate: Date
      if (input.customDueDate) {
        dueDate = new Date(input.customDueDate)
      } else {
        dueDate = new Date(year, month - 1, dueDay)
      }
      
      // Create donation period
      let period = await db.paymentPeriod.findFirst({ 
        where: { 
          month, 
          year,
          name: { contains: 'Sumbangan' }
        } 
      })
      
      if (!period) {
        period = await db.paymentPeriod.create({
          data: {
            name: `Sumbangan ${getMonthName(month, year)} ${year}`,
            month,
            year,
            amount: input.amount || 0, // Allow 0 for voluntary donations
            dueDate: dueDate,
            isActive: true,
          },
        })
      }

      // Create donation schedule
      const schedule = await db.paymentSchedule.create({
        data: {
          name: `${input.name} - ${getMonthName(month, year)} ${year}`,
          description: input.description,
          startDate: new Date(year, month - 1, 1),
          endDate: dueDate,
          periodId: period.id,
          createdById: systemUser.id,
        },
      })
      schedulesCreated.push(schedule)

      // Check for existing donation items
      const existingItems = await db.paymentScheduleItem.findMany({
        where: {
          periodId: period.id,
          type: 'DONATION',
          residentId: { in: residents.map(r => r.id) }
        },
        select: { residentId: true }
      })
      
      const existingResidentIds = new Set(existingItems.map(item => item.residentId))
      const newResidents = residents.filter(r => !existingResidentIds.has(r.id))
      
      if (newResidents.length > 0) {
        console.log(`Creating donation items for ${newResidents.length} residents`)
        
        // Use Prisma createMany for better error handling
        const donationItems = newResidents.map(r => {
          const status: PaymentScheduleItemStatus = input.isMandatory ? 'PLANNED' : 'OPTIONAL'
          const notes = input.isMandatory
            ? `Sumbangan wajib - jatuh tempo ${dueDate.toLocaleDateString('id-ID')}`
            : `Sumbangan sukarela - berlaku sampai ${dueDate.toLocaleDateString('id-ID')}`
          
          // For voluntary donations (sukarela), amount should be 0 or null to indicate it's voluntary
          const donationAmount = input.isMandatory ? input.amount : 0
          
          return {
            type: 'DONATION' as const,
            label: input.name,
            status: status,
            amount: donationAmount,
            dueDate: dueDate,
            paidDate: null,
            notes: notes,
            scheduleId: schedule.id,
            periodId: period.id,
            residentId: r.id,
            paymentId: null
          }
        })
        
        const result = await db.paymentScheduleItem.createMany({
          data: donationItems
        })
        
        console.log(`Created ${result.count} donation items`)
        itemsCreated.push(result.count)
      }
      
    } else {
      // Regular IPL monthly schedules
    for (let i = 0; i < input.months; i++) {
      const targetMonth = input.startMonth + i
      const year = input.startYear + Math.floor((targetMonth - 1) / 12)
      const month = ((targetMonth - 1) % 12) + 1

      // Upsert PaymentPeriod for this month
      let period = await db.paymentPeriod.findFirst({ where: { month, year } })
      if (!period) {
        period = await db.paymentPeriod.create({
          data: {
            name: `${input.scheduleType} Bulan ${getMonthName(month, year)} ${year}`,
            month,
            year,
            amount: input.amount,
            dueDate: new Date(year, month - 1, dueDay), // Set due date to configured day of each month
            isActive: true,
          },
        })
      } else if (period.amount !== input.amount) {
        // Keep PaymentPeriod amount in-sync with requested amount
        period = await db.paymentPeriod.update({
          where: { id: period.id },
          data: { amount: input.amount }
        })
      }

      // Create schedule for this period
      const schedule = await db.paymentSchedule.create({
        data: {
          name: `${input.name} - ${getMonthName(month, year)} ${year}`,
          description: input.description,
          startDate: new Date(year, month - 1, 1),
          endDate: new Date(year, month, 0),
          periodId: period.id,
          createdById: systemUser.id,
        },
      })
      schedulesCreated.push(schedule)

      // Check for existing schedule items for these residents in this period
      const existingItems = await db.paymentScheduleItem.findMany({
        where: {
          periodId: period.id,
          residentId: { in: residents.map(r => r.id) }
        },
        select: { residentId: true }
      })
      
      const existingResidentIds = new Set(existingItems.map(item => item.residentId))
      
      // Only create items for residents who don't already have a schedule for this period
      const newResidents = residents.filter(r => !existingResidentIds.has(r.id))
      
      if (newResidents.length === 0) {
        console.log(`All residents already have schedules for period ${period.name}`)
      }
      
        // Create items per new resident - IPL is always mandatory
        const values = newResidents.map((r) => ({
          id: undefined,
          type: 'MONTHLY',
          label: `${input.scheduleType} Bulan ${getMonthName(month, year)} ${year}`,
          status: 'PLANNED', // IPL is always mandatory
          amount: input.amount,
          dueDate: period!.dueDate,
          paidDate: null,
          notes: 'IPL - Pembayaran wajib',
          scheduleId: schedule.id,
          periodId: period!.id,
          residentId: r.id,
          paymentId: null,
        }))

      // Insert items within a single transaction for performance and atomicity
      const nowIso = new Date().toISOString()
      const inserted = await db.$transaction(async (tx) => {
        let count = 0
        for (const v of values) {
          // eslint-disable-next-line no-await-in-loop
          await tx.$executeRaw`
            INSERT INTO payment_schedule_items (
              id, type, label, status, amount, dueDate, paidDate, notes, createdAt, updatedAt,
              scheduleId, periodId, residentId, paymentId
            ) VALUES (
              gen_random_uuid(),
              ${v.type}, ${v.label}, ${v.status}, ${v.amount}, ${v.dueDate}, ${v.paidDate}, ${v.notes}, ${nowIso}, ${nowIso},
              ${v.scheduleId}, ${v.periodId}, ${v.residentId}, ${v.paymentId}
            )
          `
          count += 1
        }
        return count
      })
      itemsCreated.push(inserted)
      }
    }

    // Generate special items if provided
    if (input.specialItems && input.specialItems.length > 0) {
      for (const spec of input.specialItems) {
        const d = new Date(spec.dueDate)
        const year = d.getFullYear()
        const month = d.getMonth() + 1

        // Create or find a period for the special item
        const period = await db.paymentPeriod.create({
          data: {
            name: `${spec.label} ${year}`,
            month,
            year,
            amount: spec.amount,
            dueDate: d,
            isActive: true,
          },
        })

        const schedule = await db.paymentSchedule.create({
          data: {
            name: `${input.name} - ${spec.label} ${year}`,
            description: input.description,
            startDate: new Date(year, month - 1, 1),
            endDate: new Date(year, month, 0),
            periodId: period.id,
            createdById: systemUser.id,
          },
        })

        // Check for existing special items for these residents
        const existingSpecialItems = await db.paymentScheduleItem.findMany({
          where: {
            periodId: period.id,
            residentId: { in: residents.map(r => r.id) },
            type: 'SPECIAL'
          },
          select: { residentId: true }
        })
        
        const existingSpecialResidentIds = new Set(existingSpecialItems.map(item => item.residentId))
        
        // Only create special items for residents who don't already have this special item
        const newSpecialResidents = residents.filter(r => !existingSpecialResidentIds.has(r.id))
        
        if (newSpecialResidents.length === 0) {
          console.log(`All residents already have special items for ${spec.label}`)
        }
        
        const nowIso = new Date().toISOString()
        let inserted = 0
        for (const r of newSpecialResidents) {
          // eslint-disable-next-line no-await-in-loop
          await db.$executeRaw`
            INSERT INTO payment_schedule_items (
              id, type, label, status, amount, dueDate, paidDate, notes, createdAt, updatedAt,
              scheduleId, periodId, residentId, paymentId
            ) VALUES (
              gen_random_uuid(),
              ${'SPECIAL'}, ${spec.label}, ${'PLANNED'}, ${period.amount}, ${period.dueDate}, ${null}, ${null}, ${nowIso}, ${nowIso},
              ${schedule.id}, ${period.id}, ${r.id}, ${null}
            )
          `
          inserted += 1
        }
        itemsCreated.push(inserted)
        schedulesCreated.push(schedule)
      }
    }

    return NextResponse.json({
      message: 'Jadwal dan item berhasil dibuat',
      schedules: schedulesCreated,
      itemsCounts: itemsCreated,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validasi gagal', details: error.issues }, { status: 400 })
    }
    console.error('Error generating schedules:', error)
    return NextResponse.json({ error: 'Gagal membuat jadwal' }, { status: 500 })
  }
}


