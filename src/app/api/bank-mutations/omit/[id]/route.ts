import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { BankVerificationAction } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[DEBUG] Starting omit operation for mutation ID: ${params.id}`)
    const body = await request.json()
    const { omitReason } = body

    if (!omitReason) {
      console.log(`[DEBUG] Omit operation failed: omitReason is missing`)
      return NextResponse.json({ error: 'Omit reason is required' }, { status: 400 })
    }

    // Check if mutation exists
    const mutation = await db.bankMutation.findUnique({
      where: { id: params.id }
    })

    if (!mutation) {
      console.log(`[DEBUG] Omit operation failed: Mutation not found for ID: ${params.id}`)
      return NextResponse.json({ error: 'Bank mutation not found' }, { status: 404 })
    }

    console.log(`[DEBUG] Found mutation with current state:`, {
      id: mutation.id,
      isOmitted: (mutation as any).isOmitted,
      isVerified: mutation.isVerified,
      verifiedBy: mutation.verifiedBy,
      matchedPaymentId: mutation.matchedPaymentId,
      matchedResidentId: mutation.matchedResidentId
    })

    // Update the mutation to mark it as omitted and create verification history record in a transaction
    console.log(`[DEBUG] Starting transaction to omit mutation`)
    const result = await db.$transaction(async (tx) => {
      // Update the mutation to mark it as omitted
      console.log(`[DEBUG] Updating mutation to omitted state`)
      const updatedMutation = await tx.bankMutation.update({
        where: { id: params.id },
        data: {
          isOmitted: true,
          omitReason: omitReason,
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: 'OMITTED'
        } as any
      })

      console.log(`[DEBUG] Mutation updated successfully, creating verification history record`)

      // Create verification history record
      await tx.bankMutationVerification.create({
        data: {
          mutationId: params.id,
          action: 'MANUAL_OMIT' as any,
          notes: omitReason,
          verifiedBy: 'USER',
          confidence: 1.0
        }
      })

      return updatedMutation
    })

    console.log(`[DEBUG] Transaction completed successfully`)
    const updatedMutation = result

    console.log(`[DEBUG] Omit operation completed successfully for mutation ID: ${params.id}`)

    return NextResponse.json({ 
      success: true, 
      mutation: updatedMutation,
      message: 'Transaction omitted successfully' 
    })
  } catch (error) {
    console.error('Error omitting bank mutation:', error)
    return NextResponse.json({ error: 'Failed to omit transaction' }, { status: 500 })
  }
}