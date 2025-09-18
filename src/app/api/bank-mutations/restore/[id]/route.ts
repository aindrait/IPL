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
      is_omitted: (mutation as any).is_omitted,
      is_verified: mutation.is_verified,
      verified_by: mutation.verified_by,
      matched_payment_id: mutation.matched_payment_id,
      matched_resident_id: mutation.matched_resident_id
    })

    if (mutation.verified_by !== 'OMITTED') {
      console.log(`[DEBUG] Restore operation failed: Mutation is not omitted (verified_by: ${mutation.verified_by})`)
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
          is_omitted: false,
          omit_reason: null,
          is_verified: false,
          verified_at: null,
          verified_by: null,
          matched_payment_id: null,
          matched_resident_id: null,
          match_score: null,
          matching_strategy: null
        } as any
      })

      console.log(`[DEBUG] Mutation updated successfully, creating verification history record`)

      // Create verification history record
      await tx.bankMutationVerification.create({
        data: {
          mutation_id: params.id,
          action: BankVerificationAction.SYSTEM_UNMATCH,
          notes: 'Restored omitted mutation to verification pool',
          verified_by: 'SYSTEM',
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