import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { BankVerificationAction } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[DEBUG] Starting restore operation for mutation ID: ${params.id}`)
    
    // Check if mutation exists and is omitted
    const mutation = await db.bankMutation.findUnique({
      where: { id: params.id }
    })

    if (!mutation) {
      console.log(`[DEBUG] Restore operation failed: Mutation not found for ID: ${params.id}`)
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

    if (mutation.verifiedBy !== 'OMITTED') {
      console.log(`[DEBUG] Restore operation failed: Mutation is not omitted (verifiedBy: ${mutation.verifiedBy})`)
      return NextResponse.json({ error: 'Bank mutation is not omitted' }, { status: 400 })
    }

    // Update the mutation to restore it to verification pool and create verification history record in a transaction
    console.log(`[DEBUG] Starting transaction to restore mutation`)
    const result = await db.$transaction(async (tx) => {
      // Update the mutation to restore it to verification pool
      console.log(`[DEBUG] Updating mutation to restore state`)
      const updatedMutation = await tx.bankMutation.update({
        where: { id: params.id },
        data: {
          isOmitted: false,
          omitReason: null,
          isVerified: false,
          verifiedAt: null,
          verifiedBy: null,
          matchedPaymentId: null,
          matchedResidentId: null,
          matchScore: null,
          matchingStrategy: null
        } as any
      })

      console.log(`[DEBUG] Mutation updated successfully, creating verification history record`)

      // Create verification history record
      await tx.bankMutationVerification.create({
        data: {
          mutationId: params.id,
          action: BankVerificationAction.SYSTEM_UNMATCH,
          notes: 'Restored omitted mutation to verification pool',
          verifiedBy: 'SYSTEM',
          confidence: 0
        }
      })

      return updatedMutation
    })

    console.log(`[DEBUG] Transaction completed successfully`)
    const updatedMutation = result

    console.log(`[DEBUG] Restore operation completed successfully for mutation ID: ${params.id}`)

    return NextResponse.json({ 
      success: true, 
      mutation: updatedMutation,
      message: 'Transaction restored successfully' 
    })
  } catch (error) {
    console.error('Error restoring bank mutation:', error)
    return NextResponse.json({ error: 'Failed to restore transaction' }, { status: 500 })
  }
}