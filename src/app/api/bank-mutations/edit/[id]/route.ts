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
      const previousMatchedPaymentId = mutation.matchedPaymentId
      const previousMatchedResidentId = mutation.matchedResidentId

      // Update the mutation to unverify it
      updatedMutation = await db.bankMutation.update({
        where: { id: params.id },
        data: {
          isVerified: false,
          verifiedAt: null,
          verifiedBy: null
        }
      })

      verificationNotes = 'Unverified transaction for editing'

      // Create verification history record
      await db.bankMutationVerification.create({
        data: {
          mutationId: params.id,
          action: 'MANUAL_OVERRIDE',
          notes: verificationNotes,
          verifiedBy: 'USER',
          confidence: 0,
          previousMatchedPaymentId,
          newMatchedPaymentId: null
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