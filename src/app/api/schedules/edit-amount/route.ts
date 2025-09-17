import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { z } from 'zod'

const editAmountSchema = z.object({
  itemIds: z.array(z.string()).min(1, 'Pilih minimal satu item untuk diedit'),
  newAmount: z.number().min(0, 'Nominal harus positif'),
  reason: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const input = editAmountSchema.parse(body)

    // Get items to edit
    const items = await db.paymentScheduleItem.findMany({
      where: { 
        id: { in: input.itemIds },
        // Only allow editing items that are not paid or skipped
        status: { notIn: ['PAID', 'SKIPPED'] }
      },
      select: { 
        id: true, 
        status: true, 
        amount: true,
        label: true,
        resident: {
          select: { name: true }
        }
      },
    })

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada item yang dapat diedit. Item mungkin sudah dibayar atau dilewati.' }, 
        { status: 404 }
      )
    }

    // Check if some items couldn't be edited
    const editableItems = items.filter(item => 
      item.status !== 'PAID' && item.status !== 'SKIPPED'
    )

    if (editableItems.length !== input.itemIds.length) {
      return NextResponse.json(
        { error: 'Beberapa item tidak dapat diedit karena sudah dibayar atau dilewati' },
        { status: 400 }
      )
    }

    // Update amounts
    const results: any[] = []
    const now = new Date()
    
    for (const item of editableItems) {
      const oldAmount = item.amount
      const newNotes = `${input.reason || 'Edit nominal'} - Dari Rp ${oldAmount.toLocaleString('id-ID')} ke Rp ${input.newAmount.toLocaleString('id-ID')}`
      
      await db.paymentScheduleItem.update({
        where: { id: item.id },
        data: {
          amount: input.newAmount,
          notes: newNotes,
          updatedAt: now,
        },
      })

      results.push({ 
        itemId: item.id, 
        status: 'updated',
        oldAmount,
        newAmount: input.newAmount,
        residentName: item.resident?.name,
        label: item.label
      })
    }

    return NextResponse.json({ 
      message: `Berhasil mengubah nominal ${results.length} item`,
      results 
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validasi gagal', details: error.issues }, 
        { status: 400 }
      )
    }
    
    console.error('Error editing amount:', error)
    return NextResponse.json(
      { error: 'Gagal mengubah nominal item' }, 
      { status: 500 }
    )
  }
}
