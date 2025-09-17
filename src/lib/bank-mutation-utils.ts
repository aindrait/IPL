/**
 * Bank Mutation Verification Utilities
 * Handles parsing, matching, and verification of bank transaction data
 */

export interface BankTransaction {
  date: string
  description: string
  amount: number | null
  balance?: number | null
  reference?: string
  transactionType?: 'CR' | 'DB' | null // Credit/Debit transaction type
  category?: string // Transaction category
}

export interface MatchResult {
  residentId: string
  paymentId?: string
  confidence: number // 0-1 score
  matchFactors: string[] // Which criteria matched
  strategy: string // Matching strategy used
}

export interface MatchingCriteria {
  paymentIndex?: number // 4-digit suffix match
  amount: number // Exact amount match
  dateRange: number // Days tolerance (±3 days)
  nameMatch?: string // Fuzzy name matching
  description: string // Description parsing
}

/**
 * Extract payment index from bank transaction amount
 * Example: 250087 -> 87 (assuming base IPL is 250000)
 */
export function extractPaymentIndexFromAmount(amount: number, baseAmount: number = 250000): number | null {
  if (amount <= 0 || baseAmount <= 0) return null
  
  // Calculate how many months worth of payments
  const months = Math.floor(amount / baseAmount)
  if (months === 0) return null
  
  // Extract the payment index (remainder)
  const remainder = amount - (months * baseAmount)
  
  // Valid payment index should be 2-4 digits
  if (remainder >= 10 && remainder <= 9999) {
    return remainder
  }
  
  return null
}

/**
 * Parse common bank description patterns
 */
export function parseDescription(description: string): {
  names: string[]
  numbers: string[]
  keywords: string[]
  rtRw?: { rt: number; rw: number }
} {
  const names: string[] = []
  const numbers: string[] = []
  const keywords: string[] = []
  let rtRw: { rt: number; rw: number } | undefined
  
  // Common IPL-related keywords
  const iplKeywords = ['ipl', 'kas', 'rt', 'rw', 'bulanan', 'bayar', 'sumbangan', 'thr']
  
  // Non-IPL transaction keywords
  const nonIplKeywords = {
    DEPOSIT_RENOVASI: ['deposit', 'renovasi', 'dp', 'uang muka'],
    BIAYA_ADMIN: ['admin', 'biaya', 'fee', 'charge', 'administrasi']
  }
  
  // Extract full names using improved patterns
  // Pattern 1: Indonesian full names in ALL CAPS (e.g., "DONNY PUTRA", "AGUSTINUS ERWIN")
  const indonesianFullNameMatches = description.match(/\b[A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)+\b/g) || []
  names.push(...indonesianFullNameMatches)
  
  // Pattern 2: Standard full names (e.g., "John Doe")
  const standardFullNameMatches = description.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || []
  names.push(...standardFullNameMatches)
  
  // Pattern 3: Names with initials (e.g., "H M NUHLODI")
  const initialNameMatches = description.match(/\b(?:[A-Z]\.?\s*)+[A-Z][A-Z]+\b/g) || []
  names.push(...initialNameMatches)
  
  // Pattern 4: Individual words that might be names (fallback)
  const individualWordMatches = description.match(/\b[a-zA-Z]{3,}\b/g) || []
  const filteredIndividualWords = individualWordMatches.filter(word =>
    !iplKeywords.includes(word.toLowerCase()) &&
    !names.some(name => name.includes(word)) // Don't include words already in full names
  )
  names.push(...filteredIndividualWords)
  
  // Extract numbers
  const numberMatches = description.match(/\b\d+\b/g) || []
  numbers.push(...numberMatches)
  
  // Extract RT/RW pattern
  const rtRwMatch = description.match(/rt\s*(\d+)(?:\s*\/?\s*rw\s*(\d+))?/i)
  if (rtRwMatch) {
    rtRw = {
      rt: parseInt(rtRwMatch[1], 10),
      rw: rtRwMatch[2] ? parseInt(rtRwMatch[2], 10) : 1
    }
  }
  
  // Find keywords
  keywords.push(...iplKeywords.filter(keyword => 
    description.toLowerCase().includes(keyword)
  ))
  
  return { names, numbers, keywords, rtRw }
}

/**
 * Categorize bank transaction based on description AND transaction type
 */
export function categorizeTransaction(description: string, transactionType?: 'CR' | 'DB' | null): {
  category: string
  confidence: number
  shouldOmit: boolean
  omitReason?: string
} {
  const desc = description.toLowerCase()
  
  // First, check transaction type - DB transactions should be omitted (money out from account holder perspective)
  if (transactionType === 'DB') {
    return {
      category: 'LAINNYA',
      confidence: 0.9,
      shouldOmit: true,
      omitReason: 'DB transaction - money out from account holder perspective'
    }
  }
  
  // Check for non-IPL transactions first
  if (desc.includes('deposit') || desc.includes('renovasi') || desc.includes('dp') || desc.includes('uang muka')) {
    return {
      category: 'DEPOSIT_RENOVASI',
      confidence: 0.9,
      shouldOmit: true,
      omitReason: 'Renovation deposit - not related to IPL payments'
    }
  }
  
  if (desc.includes('admin') || desc.includes('biaya') || desc.includes('fee') || desc.includes('charge') || desc.includes('administrasi')) {
    return {
      category: 'BIAYA_ADMIN',
      confidence: 0.9,
      shouldOmit: true,
      omitReason: 'Administrative fee - not related to IPL payments'
    }
  }
  
  // Check for IPL-related transactions (only for CR transactions - money in)
  if (desc.includes('ipl') || desc.includes('kas') || desc.includes('bulanan') || desc.includes('bayar')) {
    return {
      category: 'IPL',
      confidence: 0.8,
      shouldOmit: false
    }
  }
  
  // Check for THR (holiday allowance)
  if (desc.includes('thr') || desc.includes('lebaran') || desc.includes('hari raya')) {
    return {
      category: 'THR',
      confidence: 0.8,
      shouldOmit: false
    }
  }
  
  // Check for donations
  if (desc.includes('sumbangan') || desc.includes('donasi') || desc.includes('infak')) {
    return {
      category: 'SUMBANGAN',
      confidence: 0.7,
      shouldOmit: false
    }
  }
  
  // For CR transactions with no specific keywords, default to including them
  if (transactionType === 'CR') {
    return {
      category: 'LAINNYA',
      confidence: 0.6,
      shouldOmit: false
    }
  }
  
  // Default to LAINNYA (other) if no pattern matches
  return {
    category: 'LAINNYA',
    confidence: 0.5,
    shouldOmit: false
  }
}

/**
 * Calculate fuzzy string similarity (Levenshtein distance based)
 */
export function calculateNameSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0
  
  const matrix: number[][] = []
  
  // Initialize matrix
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j
  }
  
  // Calculate distances
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  const maxLength = Math.max(s1.length, s2.length)
  return 1 - (matrix[s2.length][s1.length] / maxLength)
}

/**
 * Find best name match from resident list
 */
export function findBestNameMatch(
  bankName: string, 
  residentNames: { id: string; name: string; aliases?: string[] }[]
): { residentId: string; similarity: number; matchedName: string } | null {
  let bestMatch: { residentId: string; similarity: number; matchedName: string } | null = null
  
  for (const resident of residentNames) {
    // Check primary name
    const primarySimilarity = calculateNameSimilarity(bankName, resident.name)
    if (primarySimilarity > (bestMatch?.similarity || 0)) {
      bestMatch = {
        residentId: resident.id,
        similarity: primarySimilarity,
        matchedName: resident.name
      }
    }
    
    // Check aliases if available
    if (resident.aliases) {
      for (const alias of resident.aliases) {
        const aliasSimilarity = calculateNameSimilarity(bankName, alias)
        if (aliasSimilarity > (bestMatch?.similarity || 0)) {
          bestMatch = {
            residentId: resident.id,
            similarity: aliasSimilarity,
            matchedName: alias
          }
        }
      }
    }
  }
  
  return bestMatch && bestMatch.similarity >= 0.7 ? bestMatch : null
}

/**
 * Calculate date difference in days
 */
export function calculateDateDifference(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date1.getTime() - date2.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Validate bank transaction data
 */
export function validateBankTransaction(transaction: BankTransaction): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!transaction.date) {
    errors.push('Transaction date is required')
  } else {
    const date = new Date(transaction.date)
    if (isNaN(date.getTime())) {
      errors.push('Invalid transaction date format')
    }
  }
  
  if (!transaction.description || transaction.description.trim().length === 0) {
    errors.push('Transaction description is required')
  }
  
  if (transaction.amount === null) {
    errors.push('Transaction amount is required')
  } else if (typeof transaction.amount !== 'number' || transaction.amount <= 0) {
    errors.push('Transaction amount must be a positive number')
  }
  
  if (transaction.balance !== undefined && typeof transaction.balance !== 'number') {
    errors.push('Balance must be a number if provided')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Parse Indonesian date format from bank mutation
 * Handles formats like '02/01, '03/01 (day/month with apostrophe)
 */
export function parseIndonesianDate(dateStr: string, year: number = new Date().getFullYear(), forceMonth?: number): Date | null {
  if (!dateStr) return null
  
  // Remove apostrophe and trim
  const cleanDate = dateStr.replace(/'/g, '').trim()

  // Handle Excel serial date numbers (e.g., 45658 -> days since 1899-12-30)
  if (/^\d+$/.test(cleanDate)) {
    const serial = parseInt(cleanDate, 10)
    // Typical Excel serial ranges roughly between 20000 (1954) and 60000 (2064)
    if (serial > 20000 && serial < 70000) {
      const base = Date.UTC(1899, 11, 30) // 1899-12-30 accounts for Excel's leap year bug
      const ms = base + serial * 24 * 60 * 60 * 1000
      return new Date(ms)
    }
  }
  
  // Handle MM/DD or DD/MM format
  const parts = cleanDate.split('/')
  if (parts.length >= 2) {
    const day = parseInt(parts[0], 10)
    const month = forceMonth ?? parseInt(parts[1], 10)
    
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return new Date(year, month - 1, day) // month is 0-based in JS Date
    }
  }
  
  // Try standard date parsing as fallback
  const standardDate = new Date(cleanDate)
  if (!isNaN(standardDate.getTime())) {
    return standardDate
  }
  
  return null
}

/**
 * Parse CSV bank mutation data with Indonesian format
 * Expected format: Tanggal,Keterangan,Cabang,Jumlah,,Saldo,BAGI 200RB,RUJUKAN,NoRumahIndex,TIPE,NO RUMAH,BULAN,TAHUN,RT,OK
 */
export function parseCSVBankData(csvContent: string, opts?: { hintYear?: number; forceMonth?: number }): {
  transactions: BankTransaction[]
  verificationHistory: VerificationHistoryItem[]
  errors: string[]
} {
  const lines = csvContent.split('\n').filter(line => line.trim())
  const transactions: BankTransaction[] = []
  const verificationHistory: VerificationHistoryItem[] = []
  const errors: string[] = []
  
  // Skip header if present
  const startIndex = lines[0]?.toLowerCase().includes('tanggal') ? 1 : 0
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    
    // Split CSV properly handling quoted values
    const columns = parseCSVLine(line)
    
    if (columns.length < 6) {
      errors.push(`Line ${i + 1}: Insufficient columns (minimum 6 required)`)
      continue
    }
    
    try {
      // Columns A-F: Bank mutation data
      const tanggal = columns[0] || ''
      const keterangan = columns[1] || ''
      const cabang = columns[2] || ''
      const jumlah = columns[3] || ''
      const columnE = columns[4] || ''  // This should contain CR/DB
      const saldo = columns[5] || ''
      
      
      // Parse amount
      let amount: number | null = null
      if (jumlah && jumlah.trim() !== '') {
        const parsedAmount = parseFloat(jumlah.replace(/[^\d.-]/g, ''))
        if (!isNaN(parsedAmount)) {
          amount = parsedAmount
        }
      }
      
      const balance = saldo && saldo.trim() !== '' ? parseFloat(saldo.replace(/[^\d.-]/g, '')) : undefined
      
      // Determine transaction type (CR/DB) - FIRST try to read from column E
      let transactionType: 'CR' | 'DB' | null = null
      if (columnE && columnE.trim() !== '') {
        const normalizedColumnE = columnE.trim().toUpperCase()
        if (normalizedColumnE === 'CR' || normalizedColumnE === 'DB') {
          transactionType = normalizedColumnE as 'CR' | 'DB'
        }
      }
      
      // Fallback: Determine transaction type based on amount sign if column E is not valid
      if (transactionType === null && amount !== null) {
        // Positive amounts are typically Credits (CR)
        // Negative amounts are typically Debits (DB)
        transactionType = amount >= 0 ? 'CR' : 'DB'
      }
      
      // Parse date
      const currentYear = new Date().getFullYear()
      const yearToUse = opts?.hintYear && opts.hintYear > 1900 ? opts.hintYear : currentYear
      const forceMonth = opts?.forceMonth && opts.forceMonth >= 1 && opts.forceMonth <= 12 ? opts.forceMonth : undefined
      const parsedDate = parseIndonesianDate(tanggal, yearToUse, forceMonth)
      
      if (!parsedDate) {
        errors.push(`Line ${i + 1}: Invalid date format: ${tanggal}`)
        continue
      }
      
      const transaction: BankTransaction = {
        date: parsedDate.toISOString().split('T')[0],
        description: keterangan,
        amount: amount,
        balance: balance,
        reference: cabang,
        transactionType: transactionType
      }
      
      const validation = validateBankTransaction(transaction)
      if (validation.isValid) {
        transactions.push(transaction)
      } else {
        errors.push(`Line ${i + 1}: ${validation.errors.join(', ')}`)
        continue
      }
      
      // Columns G-O: Manual verification data (if present)
      if (columns.length >= 15) {
        const bagiAmount = columns[6] || ''     // BAGI 200RB
        const rujukan = columns[7] || ''        // RUJUKAN
        const noRumahIndex = columns[8] || ''   // NoRumahIndex
        const tipe = columns[9] || ''           // TIPE
        const noRumah = columns[10] || ''       // NO RUMAH
        const bulan = columns[11] || ''         // BULAN
        const tahun = columns[12] || ''         // TAHUN
        const rt = columns[13] || ''            // RT
        const ok = columns[14] || ''            // OK
        
        // Only create verification history if manual verification exists
        if (noRumah && (ok === '1' || ok.toLowerCase() === 'ok')) {
          const historyItem: VerificationHistoryItem = {
            originalTransaction: transaction,
            manualVerification: {
              bagiAmount: parseFloat(bagiAmount) || 0,
              rujukan: rujukan,
              noRumahIndex: noRumahIndex,
              tipe: tipe,
              noRumah: noRumah,
              bulan: bulan || (forceMonth ? String(forceMonth).padStart(2, '0') : ''),
              tahun: tahun ? parseInt(tahun) : yearToUse,
              rt: rt,
              isVerified: ok === '1' || ok.toLowerCase() === 'ok'
            }
          }
          verificationHistory.push(historyItem)
        }
      }
      
    } catch (error) {
      errors.push(`Line ${i + 1}: Failed to parse transaction data - ${error}`)
    }
  }
  
  return { transactions, verificationHistory, errors }
}

/**
 * Parse CSV line properly handling quoted values and commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

/**
 * Interface for verification history from manual verification
 */
export interface VerificationHistoryItem {
  originalTransaction: BankTransaction
  manualVerification: {
    bagiAmount: number
    rujukan: string
    noRumahIndex: string
    tipe: string
    noRumah: string
    bulan: string
    tahun: number
    rt: string
    isVerified: boolean
  }
}

/**
 * Generate upload batch ID
 */
export function generateUploadBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Calculate overall match confidence based on multiple factors
 */
export function calculateMatchConfidence(factors: {
  paymentIndexMatch: boolean
  amountMatch: boolean
  dateProximity: number // days difference
  nameMatch: number // 0-1 similarity
  descriptionMatch: number // 0-1 relevance
}): number {
  let confidence = 0
  
  // Payment index match is highly reliable
  if (factors.paymentIndexMatch) {
    confidence += 0.4
  }
  
  // Exact amount match is also highly reliable
  if (factors.amountMatch) {
    confidence += 0.3
  }
  
  // Date proximity (closer = better)
  const dateScore = Math.max(0, 1 - (factors.dateProximity / 7)) // 7 days max
  confidence += dateScore * 0.15
  
  // Name similarity
  confidence += factors.nameMatch * 0.1
  
  // Description relevance
  confidence += factors.descriptionMatch * 0.05
  
  return Math.min(1, confidence)
}
