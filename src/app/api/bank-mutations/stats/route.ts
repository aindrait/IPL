import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Get overall statistics using proper BankMutation model
    const [
      totalUploaded,
      totalMatched,
      totalVerified,
      totalAmountResult,
      lastUploadResult
    ] = await Promise.all([
      (db as any).bankMutation.count(),
      (db as any).bankMutation.count({ where: { matched_resident_id: { not: null } } }),
      (db as any).bankMutation.count({ where: { is_verified: true } }),
      (db as any).bankMutation.aggregate({
        _sum: {
          amount: true
        }
      }),
      (db as any).bankMutation.findFirst({
        orderBy: { created_at: 'desc' },
        select: { created_at: true }
      })
    ])

    const stats = {
      totalUploaded,
      totalMatched,
      totalVerified,
      totalAmount: totalAmountResult._sum.amount || 0,
      lastUpload: lastUploadResult?.created_at?.toISOString()
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching bank mutation stats:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch statistics' 
    }, { status: 500 })
  }
}
