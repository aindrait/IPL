import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { action } = body

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    // Check if mutation exists
    const mutation = await db.bankMutation.findUnique({
      where: { id: params.id }
    })

    if (!mutation) {
      return NextResponse.json({ error: 'Bank mutation not found' }, { status: 404 })
    }

    let updatedMutation
    let verificationNotes = ''

    if (action === 'unverify') {
      // Store previous match data for verification history
      const previous_matched_payment_id = mutation.matched_payment_id
      const previousMatchedResidentId = mutation.matched_resident_id

      // Update the mutation to unverify it
      updatedMutation = await db.bankMutation.update({
        where: { id: params.id },
        data: {
          is_verified: false,
          verified_at: null,
          verified_by: null
        }
      })

      verificationNotes = 'Unverified transaction for editing'

      // Create verification history record
      await db.bankMutationVerification.create({
        data: {
          mutation_id: params.id,
          action: 'MANUAL_OVERRIDE',
          notes: verificationNotes,
          verified_by: 'USER',
          confidence: 0,
          previous_matched_payment_id,
          new_matched_payment_id: null
        }
      })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      mutation: updatedMutation,
      message: 'Transaction updated successfully' 
    })
  } catch (error) {
    console.error('Error editing bank mutation:', error)
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}