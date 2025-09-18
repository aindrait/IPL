import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { resident_id, payment_id, verified } = body

    if (!resident_id) {
      return NextResponse.json({ error: 'Resident ID is required' }, { status: 400 })
    }

    // Check if mutation exists
    const mutation = await db.bankMutation.findUnique({
      where: { id: params.id }
    })

    if (!mutation) {
      return NextResponse.json({ error: 'Bank mutation not found' }, { status: 404 })
    }

    // Check if resident exists
    const resident = await db.resident.findUnique({
      where: { id: resident_id }
    })

    if (!resident) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 })
    }

    // If payment_id is provided, check if payment exists
    let payment: any = null
    if (payment_id) {
      payment = await db.payment.findUnique({
        where: { id: payment_id }
      })

      if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }

      // Verify payment belongs to the resident
      if (payment.resident_id !== resident_id) {
        return NextResponse.json({
          error: 'Payment does not belong to the specified resident'
        }, { status: 400 })
      }
    }

    // Store previous match data for verification history
    const previous_matched_payment_id = mutation.matched_payment_id
    const previousMatchedResidentId = mutation.matched_resident_id

    // Update the mutation with manual match
    const updatedMutation = await db.bankMutation.update({
      where: { id: params.id },
      data: {
        matched_resident_id: resident_id,
        matched_payment_id: payment_id,
        match_score: 1.0, // Manual match gets perfect score
        matching_strategy: 'MANUAL_MATCH',
        is_verified: Boolean(verified),
        verified_at: verified ? new Date() : null,
        verified_by: verified ? 'USER' : null
      }
    })

    // Create verification history record
    await db.bankMutationVerification.create({
      data: {
        mutation_id: params.id,
        action: verified ? 'MANUAL_CONFIRM' : 'MANUAL_OVERRIDE',
        notes: `Manual match to resident ${resident.name}${payment ? ` and payment ${payment_id}` : ''}`,
        verified_by: 'USER',
        confidence: 1.0,
        previous_matched_payment_id,
        new_matched_payment_id: payment_id
      }
    })

    return NextResponse.json({ 
      success: true, 
      mutation: updatedMutation,
      message: verified ? 'Transaction manually matched and verified' : 'Transaction manually matched'
    })
  } catch (error) {
    console.error('Error manual matching bank mutation:', error)
    return NextResponse.json({ error: 'Failed to manually match transaction' }, { status: 500 })
  }
}
