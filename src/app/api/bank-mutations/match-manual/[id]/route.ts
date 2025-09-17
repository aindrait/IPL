import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { residentId, paymentId, verified } = body

    if (!residentId) {
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
      where: { id: residentId }
    })

    if (!resident) {
      return NextResponse.json({ error: 'Resident not found' }, { status: 404 })
    }

    // If paymentId is provided, check if payment exists
    let payment: any = null
    if (paymentId) {
      payment = await db.payment.findUnique({
        where: { id: paymentId }
      })

      if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
      }

      // Verify payment belongs to the resident
      if (payment.residentId !== residentId) {
        return NextResponse.json({
          error: 'Payment does not belong to the specified resident'
        }, { status: 400 })
      }
    }

    // Store previous match data for verification history
    const previousMatchedPaymentId = mutation.matchedPaymentId
    const previousMatchedResidentId = mutation.matchedResidentId

    // Update the mutation with manual match
    const updatedMutation = await db.bankMutation.update({
      where: { id: params.id },
      data: {
        matchedResidentId: residentId,
        matchedPaymentId: paymentId,
        matchScore: 1.0, // Manual match gets perfect score
        matchingStrategy: 'MANUAL_MATCH',
        isVerified: Boolean(verified),
        verifiedAt: verified ? new Date() : null,
        verifiedBy: verified ? 'USER' : null
      }
    })

    // Create verification history record
    await db.bankMutationVerification.create({
      data: {
        mutationId: params.id,
        action: verified ? 'MANUAL_CONFIRM' : 'MANUAL_OVERRIDE',
        notes: `Manual match to resident ${resident.name}${payment ? ` and payment ${paymentId}` : ''}`,
        verifiedBy: 'USER',
        confidence: 1.0,
        previousMatchedPaymentId,
        newMatchedPaymentId: paymentId
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
