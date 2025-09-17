import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/bank-mutations?year=2025&month=1&page=1&limit=20&verified=true&matched=true&omitted=false&search=keyword
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const limit = Math.max(parseInt(searchParams.get('limit') || '20', 10), 1)
    const offset = (page - 1) * limit

    const year = searchParams.get('year')?.trim() || null
    const monthRaw = searchParams.get('month')?.trim() || null
    const month = monthRaw ? monthRaw.padStart(2, '0') : null
    const verified = searchParams.get('verified')
    const matched = searchParams.get('matched')
    const omitted = searchParams.get('omitted')
    const search = searchParams.get('search')?.trim() || ''

    // Build WHERE clauses with robust SQLite datetime handling
    const whereClauses: string[] = []
    const params: any[] = []

    if (year) {
      whereClauses.push(`COALESCE(strftime('%Y', bm.transactionDate), strftime('%Y', datetime(bm.transactionDate, 'unixepoch')), strftime('%Y', datetime(bm.transactionDate/1000, 'unixepoch'))) = ?`)
      params.push(year)
    }

    if (month) {
      whereClauses.push(`COALESCE(strftime('%m', bm.transactionDate), strftime('%m', datetime(bm.transactionDate, 'unixepoch')), strftime('%m', datetime(bm.transactionDate/1000, 'unixepoch'))) = ?`)
      params.push(month)
    }

    if (verified === 'true') {
      whereClauses.push(`bm.isVerified = 1`)
    } else if (verified === 'false') {
      whereClauses.push(`bm.isVerified = 0`)
    }

    if (matched === 'true') {
      whereClauses.push(`bm.matchedResidentId IS NOT NULL`)
    } else if (matched === 'false') {
      whereClauses.push(`bm.matchedResidentId IS NULL`)
    }

    if (omitted === 'true') {
      whereClauses.push(`bm.isOmitted = 1`)
    } else if (omitted === 'false') {
      whereClauses.push(`bm.isOmitted = 0`)
    }

    if (search) {
      whereClauses.push(`(bm.description LIKE ? OR bm.referenceNumber LIKE ? OR bm.uploadBatch LIKE ?)`)
      const s = `%${search}%`
      params.push(s, s, s)
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const selectSQL = `
      SELECT
        bm.id,
        bm.transactionDate,
        bm.description,
        bm.amount,
        bm.balance,
        bm.referenceNumber,
        bm.transactionType,
        bm.category,
        bm.isOmitted,
        bm.omitReason,
        bm.isVerified,
        bm.verifiedAt,
        bm.verifiedBy,
        bm.matchedPaymentId,
        bm.matchedResidentId,
        bm.matchScore,
        bm.matchingStrategy,
        bm.uploadBatch,
        bm.fileName,
        bm.createdAt,
        r.name AS residentName,
        r.blok AS residentBlok,
        r.houseNumber AS residentHouseNumber
      FROM bank_mutations bm
      LEFT JOIN residents r ON r.id = bm.matchedResidentId
      ${whereSQL}
      ORDER BY bm.transactionDate DESC, bm.createdAt DESC
      LIMIT ? OFFSET ?
    `

    const countSQL = `
      SELECT COUNT(*) as cnt
      FROM bank_mutations bm
      LEFT JOIN residents r ON r.id = bm.matchedResidentId
      ${whereSQL}
    `

    const itemsParams = [...params, limit, offset]

    // Use raw query to avoid SQLite datetime quirks
    const items = await (db as any).$queryRawUnsafe(selectSQL, ...itemsParams)
    
    const countRows = await (db as any).$queryRawUnsafe(countSQL, ...params)
    let total: number = 0
    if (Array.isArray(countRows) && countRows.length > 0) {
      const rawCnt = (countRows[0] as any).cnt
      if (typeof rawCnt === 'bigint') {
        total = Number(rawCnt)
      } else if (typeof rawCnt === 'string') {
        total = parseInt(rawCnt, 10) || 0
      } else if (typeof rawCnt === 'number') {
        total = rawCnt
      } else {
        total = Number(rawCnt) || 0
      }
    }

    return NextResponse.json({
      page,
      limit,
      total,
      items
    })
  } catch (error) {
    console.error('Failed to list bank mutations:', error)
    return NextResponse.json({ error: 'Failed to fetch bank mutations' }, { status: 500 })
  }
}

// GET /api/bank-mutations/check-period?year=2025&month=1
export async function CHECK_PERIOD(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')?.trim()
    const month = searchParams.get('month')?.trim()

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month parameters are required' }, { status: 400 })
    }

    const yearNum = parseInt(year, 10)
    const monthNum = parseInt(month, 10)

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 })
    }

    // Count existing transactions for the period
    const countResult = await (db as any).bankMutation.count({
      where: {
        AND: [
          {
            transactionDate: {
              gte: new Date(yearNum, monthNum - 1, 1),
              lt: new Date(yearNum, monthNum, 1)
            }
          }
        ]
      }
    })

    return NextResponse.json({
      hasData: countResult > 0,
      count: countResult,
      year: yearNum,
      month: monthNum
    })
  } catch (error) {
    console.error('Failed to check period data:', error)
    return NextResponse.json({ error: 'Failed to check period data' }, { status: 500 })
  }
}
// DELETE /api/bank-mutations - clear data
export async function DELETE() {
  try {
    // Use Prisma to delete all to respect FKs and cascade
    await (db as any).bankMutationVerification.deleteMany({})
    await (db as any).bankMutation.deleteMany({})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Failed to reset bank mutations:', error)
    return NextResponse.json({ error: 'Failed to reset bank mutations' }, { status: 500 })
  }
}


