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

    // Build WHERE clauses with robust PostgreSQL datetime handling
    const whereClauses: string[] = []
    const params: any[] = []

    if (year) {
      whereClauses.push(`EXTRACT(YEAR FROM bm.transaction_date) = $` + (params.length + 1))
      params.push(parseInt(year, 10))
    }

    if (month) {
      whereClauses.push(`EXTRACT(MONTH FROM bm.transaction_date) = $` + (params.length + 1))
      params.push(parseInt(month, 10))
    }

    if (verified === 'true') {
      whereClauses.push(`bm.is_verified = true`)
    } else if (verified === 'false') {
      whereClauses.push(`bm.is_verified = false`)
    }

    if (matched === 'true') {
      whereClauses.push(`bm.matched_resident_id IS NOT NULL`)
    } else if (matched === 'false') {
      whereClauses.push(`bm.matched_resident_id IS NULL`)
    }

    if (omitted === 'true') {
      whereClauses.push(`bm.is_omitted = true`)
    } else if (omitted === 'false') {
      whereClauses.push(`bm.is_omitted = false`)
    }

    if (search) {
      whereClauses.push(`(bm.description LIKE $` + (params.length + 1) + ` OR bm.reference_number LIKE $` + (params.length + 2) + ` OR bm.upload_batch LIKE $` + (params.length + 3) + `)`)
      const s = `%${search}%`
      params.push(s, s, s)
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

    const selectSQL = `
      SELECT
        bm.id,
        bm.transaction_date,
        bm.description,
        bm.amount,
        bm.balance,
        bm.reference_number,
        bm.transaction_type,
        bm.category,
        bm.is_omitted,
        bm.omit_reason,
        bm.is_verified,
        bm.verified_at,
        bm.verified_by,
        bm.matched_payment_id,
        bm.matched_resident_id,
        bm.match_score,
        bm.matching_strategy,
        bm.upload_batch,
        bm.file_name,
        bm.created_at,
        r.name AS resident_name,
        r.blok AS resident_blok,
        r.house_number AS resident_house_number
      FROM bank_mutations bm
      LEFT JOIN residents r ON r.id = bm.matched_resident_id
      ${whereSQL}
      ORDER BY bm.transaction_date DESC, bm.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `

    const countSQL = `
      SELECT COUNT(*) as cnt
      FROM bank_mutations bm
      LEFT JOIN residents r ON r.id = bm.matched_resident_id
      ${whereSQL}
    `

    const itemsParams = [...params, limit, offset]

    // Use raw query to avoid PostgreSQL datetime quirks
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
        transaction_date: {
          gte: new Date(yearNum, monthNum - 1, 1),
          lt: new Date(yearNum, monthNum, 1)
        }
      }
    })

    return NextResponse.json({
      year: yearNum,
      month: monthNum,
      existingCount: countResult,
      hasData: countResult > 0
    })
  } catch (error) {
    console.error('Failed to check period:', error)
    return NextResponse.json({ error: 'Failed to check period' }, { status: 500 })
  }
}
