import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { verifiedBy } = body

    if (!verifiedBy) {
      return NextResponse.json({ error: 'Verified by is required' }, { status: 400 })
    }

    // Check if mutation exists
    const mutation = await db.bankMutation.findUnique({
      where: { id: params.id }
    })

    if (!mutation) {
      return NextResponse.json({ error: 'Bank mutation not found' }, { status: 404 })
    }

    // Check if house number is filled (for UI validation)
    if (!mutation.matchedResidentId) {
      return NextResponse.json({ 
        error: 'Resident must be matched before verification' 
      }, { status: 400 })
    }

    // Get resident details to check house number
    const resident = await db.resident.findUnique({
      where: { id: mutation.matchedResidentId }
    })

    if (!resident || !resident.houseNumber) {
      return NextResponse.json({ 
        error: 'Resident house number is required before verification' 
      }, { status: 400 })
    }

    // Update the mutation to mark it as verified
    const updatedMutation = await db.bankMutation.update({
      where: { id: params.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy
      }
    })

    // Create verification history record
    await db.bankMutationVerification.create({
      data: {
        mutationId: params.id,
        action: 'MANUAL_CONFIRM',
        notes: `Verified by ${verifiedBy}`,
        verifiedBy,
        confidence: mutation.matchScore || 1.0
      }
    })

    return NextResponse.json({ 
      success: true, 
      mutation: updatedMutation,
      message: 'Transaction verified successfully' 
    })
  } catch (error) {
    console.error('Error verifying bank mutation:', error)
    return NextResponse.json({ error: 'Failed to verify transaction' }, { status: 500 })
  }
}
