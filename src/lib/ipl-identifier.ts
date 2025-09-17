/**
 * Enhanced IPL Transaction Identifier
 * Identifies IPL-related transactions and extracts payment month information
 */

export interface IPLTransactionInfo {
  isIPLTransaction: boolean
  confidence: number
  keywords: string[]
  paymentMonth?: string
  paymentYear?: number
  paymentType?: 'MONTHLY' | 'SPECIAL' | 'DONATION' | 'THR'
  rt?: number
  rw?: number
  amountCategory?: 'STANDARD' | 'MULTI_MONTH' | 'PARTIAL' | 'EXTRA'
}

export interface MonthYearInfo {
  month?: string
  year?: number
  confidence: number
  source: string
}

export class IPLIdentifier {
  private iplKeywords: Array<{
    keyword: string
    weight: number
    category: 'PRIMARY' | 'SECONDARY' | 'CONTEXTUAL'
  }> = []

  private monthNames: Array<{
    name: string
    number: number
    variations: string[]
  }> = []

  private specialPaymentTypes: Array<{
    pattern: RegExp
    type: 'MONTHLY' | 'SPECIAL' | 'DONATION' | 'THR'
    confidence: number
  }> = []

  constructor() {
    this.initializeKeywords()
    this.initializeMonthNames()
    this.initializeSpecialPaymentTypes()
  }

  private initializeKeywords(): void {
    this.iplKeywords = [
      // Primary keywords (strong indicators)
      { keyword: 'ipl', weight: 1.0, category: 'PRIMARY' },
      { keyword: 'kas rt', weight: 1.0, category: 'PRIMARY' },
      { keyword: 'kas rw', weight: 1.0, category: 'PRIMARY' },
      { keyword: 'iuran ipl', weight: 1.0, category: 'PRIMARY' },
      
      // Secondary keywords (good indicators)
      { keyword: 'iuran', weight: 0.8, category: 'SECONDARY' },
      { keyword: 'kas', weight: 0.7, category: 'SECONDARY' },
      { keyword: 'bulanan', weight: 0.8, category: 'SECONDARY' },
      { keyword: 'bayar', weight: 0.6, category: 'SECONDARY' },
      { keyword: 'sumbangan', weight: 0.7, category: 'SECONDARY' },
      { keyword: 'kebersihan', weight: 0.8, category: 'SECONDARY' },
      { keyword: 'keamanan', weight: 0.8, category: 'SECONDARY' },
      
      // Contextual keywords (weak indicators but supportive)
      { keyword: 'rt', weight: 0.4, category: 'CONTEXTUAL' },
      { keyword: 'rw', weight: 0.4, category: 'CONTEXTUAL' },
      { keyword: 'lingkungan', weight: 0.5, category: 'CONTEXTUAL' },
      { keyword: 'warga', weight: 0.4, category: 'CONTEXTUAL' },
      { keyword: 'pengelolaan', weight: 0.5, category: 'CONTEXTUAL' },
      
      // Special payment types
      { keyword: 'thr', weight: 0.9, category: 'PRIMARY' },
      { keyword: 'lebaran', weight: 0.8, category: 'SECONDARY' },
      { keyword: 'idul fitri', weight: 0.8, category: 'SECONDARY' },
      { keyword: 'natal', weight: 0.7, category: 'SECONDARY' },
      { keyword: 'tahun baru', weight: 0.7, category: 'SECONDARY' }
    ]
  }

  private initializeMonthNames(): void {
    this.monthNames = [
      {
        name: 'januari',
        number: 1,
        variations: ['jan', 'january']
      },
      {
        name: 'februari',
        number: 2,
        variations: ['feb', 'february', 'pebruari']
      },
      {
        name: 'maret',
        number: 3,
        variations: ['mar', 'march']
      },
      {
        name: 'april',
        number: 4,
        variations: ['apr']
      },
      {
        name: 'mei',
        number: 5,
        variations: ['may']
      },
      {
        name: 'juni',
        number: 6,
        variations: ['jun', 'june']
      },
      {
        name: 'juli',
        number: 7,
        variations: ['jul', 'july']
      },
      {
        name: 'agustus',
        number: 8,
        variations: ['aug', 'august']
      },
      {
        name: 'september',
        number: 9,
        variations: ['sep', 'sept']
      },
      {
        name: 'oktober',
        number: 10,
        variations: ['oct', 'october']
      },
      {
        name: 'november',
        number: 11,
        variations: ['nov']
      },
      {
        name: 'desember',
        number: 12,
        variations: ['dec', 'december']
      }
    ]
  }

  private initializeSpecialPaymentTypes(): void {
    this.specialPaymentTypes = [
      {
        pattern: /thr|lebaran|idul fitri/i,
        type: 'THR',
        confidence: 0.9
      },
      {
        pattern: /natal|tahun baru/i,
        type: 'SPECIAL',
        confidence: 0.8
      },
      {
        pattern: /sumbangan|donasi/i,
        type: 'DONATION',
        confidence: 0.7
      },
      {
        pattern: /bulanan|monthly/i,
        type: 'MONTHLY',
        confidence: 0.8
      }
    ]
  }

  /**
   * Identify if a transaction is IPL-related and extract relevant information
   */
  identifyIPLTransaction(description: string, amount?: number): IPLTransactionInfo {
    const lowerDesc = description.toLowerCase()
    
    // Find all matching keywords
    const matchedKeywords = this.findMatchingKeywords(lowerDesc)
    
    if (matchedKeywords.length === 0) {
      return {
        isIPLTransaction: false,
        confidence: 0,
        keywords: []
      }
    }

    // Calculate base confidence from keywords
    const keywordConfidence = this.calculateKeywordConfidence(matchedKeywords)
    
    // Extract payment month and year
    const monthYearInfo = this.extractMonthYear(description)
    
    // Determine payment type
    const paymentType = this.determinePaymentType(description)
    
    // Extract RT/RW information
    const rtRwInfo = this.extractRtRw(description)
    
    // Categorize amount if provided
    const amountCategory = amount ? this.categorizeAmount(amount) : undefined
    
    // Calculate final confidence
    let finalConfidence = keywordConfidence
    
    // Boost confidence if we found month/year info
    if (monthYearInfo.month) {
      finalConfidence += 0.1
    }
    
    // Boost confidence if payment type is clear
    if (paymentType) {
      finalConfidence += 0.1
    }
    
    // Boost confidence if RT/RW info is present
    if (rtRwInfo.rt || rtRwInfo.rw) {
      finalConfidence += 0.05
    }
    
    // Cap confidence at 1.0
    finalConfidence = Math.min(1.0, finalConfidence)
    
    return {
      isIPLTransaction: finalConfidence >= 0.5,
      confidence: finalConfidence,
      keywords: matchedKeywords.map(k => k.keyword),
      paymentMonth: monthYearInfo.month,
      paymentYear: monthYearInfo.year,
      paymentType,
      rt: rtRwInfo.rt,
      rw: rtRwInfo.rw,
      amountCategory
    }
  }

  /**
   * Find all matching keywords in the description
   */
  private findMatchingKeywords(description: string): Array<{
    keyword: string
    weight: number
    category: string
  }> {
    const matches: Array<{
      keyword: string
      weight: number
      category: string
    }> = []

    for (const keywordInfo of this.iplKeywords) {
      if (description.includes(keywordInfo.keyword)) {
        matches.push(keywordInfo)
      }
    }

    return matches
  }

  /**
   * Calculate confidence score based on matched keywords
   */
  private calculateKeywordConfidence(matchedKeywords: Array<{
    keyword: string
    weight: number
    category: string
  }>): number {
    if (matchedKeywords.length === 0) return 0

    let totalWeight = 0
    let maxWeight = 0

    for (const keyword of matchedKeywords) {
      totalWeight += keyword.weight
      maxWeight = Math.max(maxWeight, keyword.weight)
    }

    // Primary keywords give high confidence
    const hasPrimaryKeyword = matchedKeywords.some(k => k.category === 'PRIMARY')
    
    // Multiple keywords boost confidence
    const keywordCount = matchedKeywords.length
    
    let confidence = 0
    
    if (hasPrimaryKeyword) {
      confidence = Math.min(0.7, maxWeight * 0.8)
    } else {
      confidence = Math.min(0.5, maxWeight * 0.6)
    }
    
    // Boost for multiple keywords
    if (keywordCount >= 2) {
      confidence += 0.1
    }
    
    if (keywordCount >= 3) {
      confidence += 0.1
    }

    return Math.min(1.0, confidence)
  }

  /**
   * Extract month and year information from description
   */
  private extractMonthYear(description: string): MonthYearInfo {
    const lowerDesc = description.toLowerCase()
    
    // Try to find month name
    let monthInfo: { name: string; number: number; confidence: number } | null = null
    
    for (const monthData of this.monthNames) {
      // Check main name
      if (lowerDesc.includes(monthData.name)) {
        monthInfo = {
          name: monthData.name,
          number: monthData.number,
          confidence: 0.9
        }
        break
      }
      
      // Check variations
      for (const variation of monthData.variations) {
        if (lowerDesc.includes(variation)) {
          monthInfo = {
            name: monthData.name,
            number: monthData.number,
            confidence: 0.7
          }
          break
        }
      }
      
      if (monthInfo) break
    }

    // Try to find year
    let year: number | undefined
    const yearMatches = description.match(/\b(20\d{2})\b/g)
    
    if (yearMatches && yearMatches.length > 0) {
      // Use the most recent year (last match)
      year = parseInt(yearMatches[yearMatches.length - 1], 10)
      
      // Validate year (should be reasonable)
      const currentYear = new Date().getFullYear()
      if (year < 2000 || year > currentYear + 1) {
        year = undefined
      }
    }

    // Try to find month number (e.g., "bln 01", "bulan 1")
    if (!monthInfo) {
      const monthNumberMatches = lowerDesc.match(/(?:bln|bulan)\s*(\d{1,2})/i)
      if (monthNumberMatches) {
        const monthNum = parseInt(monthNumberMatches[1], 10)
        if (monthNum >= 1 && monthNum <= 12) {
          const monthData = this.monthNames.find(m => m.number === monthNum)
          if (monthData) {
            monthInfo = {
              name: monthData.name,
              number: monthNum,
              confidence: 0.6
            }
          }
        }
      }
    }

    return {
      month: monthInfo?.name,
      year,
      confidence: monthInfo?.confidence || 0,
      source: monthInfo ? 'text_match' : 'none'
    }
  }

  /**
   * Determine payment type based on description
   */
  private determinePaymentType(description: string): 'MONTHLY' | 'SPECIAL' | 'DONATION' | 'THR' | undefined {
    const lowerDesc = description.toLowerCase()
    
    for (const paymentType of this.specialPaymentTypes) {
      if (paymentType.pattern.test(lowerDesc)) {
        return paymentType.type
      }
    }
    
    return undefined
  }

  /**
   * Extract RT/RW information from description
   */
  private extractRtRw(description: string): { rt?: number; rw?: number } {
    const result: { rt?: number; rw?: number } = {}
    
    // RT/RW pattern matching
    const rtRwPatterns = [
      {
        regex: /RT\s*(\d+)(?:\s*\/?\s*RW\s*(\d+))?/i,
        extractor: (match: RegExpMatchArray) => ({
          rt: parseInt(match[1], 10),
          rw: match[2] ? parseInt(match[2], 10) : undefined
        })
      },
      {
        regex: /RUKUN\s*TETANGGA\s*(\d+)(?:\s*[\/\s]?\s*RUKUN\s*WARGA\s*(\d+))?/i,
        extractor: (match: RegExpMatchArray) => ({
          rt: parseInt(match[1], 10),
          rw: match[2] ? parseInt(match[2], 10) : undefined
        })
      }
    ]

    for (const pattern of rtRwPatterns) {
      const match = description.match(pattern.regex)
      if (match) {
        const extracted = pattern.extractor(match)
        result.rt = extracted.rt
        result.rw = extracted.rw
        break
      }
    }

    return result
  }

  /**
   * Categorize payment amount
   */
  private categorizeAmount(amount: number): 'STANDARD' | 'MULTI_MONTH' | 'PARTIAL' | 'EXTRA' {
    // Standard IPL amount (typical monthly payment)
    if (amount >= 200000 && amount <= 250000) {
      return 'STANDARD'
    }
    
    // Multi-month payment
    if (amount >= 400000 && amount <= 750000) {
      return 'MULTI_MONTH'
    }
    
    // Partial payment
    if (amount >= 50000 && amount < 200000) {
      return 'PARTIAL'
    }
    
    // Extra payment (donations, special fees, etc.)
    if (amount > 750000) {
      return 'EXTRA'
    }
    
    // Unknown category
    return 'STANDARD'
  }

  /**
   * Validate if the extracted information makes sense
   */
  validateIPLInfo(info: IPLTransactionInfo): boolean {
    // Basic validation
    if (!info.isIPLTransaction) return true
    
    // If we have a month, it should be valid
    if (info.paymentMonth) {
      const validMonth = this.monthNames.some(m => m.name === info.paymentMonth)
      if (!validMonth) return false
    }
    
    // If we have a year, it should be reasonable
    if (info.paymentYear) {
      const currentYear = new Date().getFullYear()
      if (info.paymentYear < 2000 || info.paymentYear > currentYear + 1) {
        return false
      }
    }
    
    // RT/RW should be reasonable numbers
    if (info.rt && (info.rt < 1 || info.rt > 20)) {
      return false
    }
    
    if (info.rw && (info.rw < 1 || info.rw > 20)) {
      return false
    }
    
    return true
  }

  /**
   * Get detailed analysis of why a transaction was identified as IPL
   */
  getAnalysisDetails(info: IPLTransactionInfo): {
    isIPLTransaction: boolean
    confidenceFactors: string[]
    confidenceBreakdown: {
      keywords: number
      monthYear: number
      paymentType: number
      rtRw: number
      total: number
    }
  } {
    const factors: string[] = []
    const breakdown = {
      keywords: 0,
      monthYear: 0,
      paymentType: 0,
      rtRw: 0,
      total: info.confidence
    }

    // Analyze keyword contribution
    if (info.keywords.length > 0) {
      const primaryKeywords = info.keywords.filter(k => 
        this.iplKeywords.some(ik => ik.keyword === k && ik.category === 'PRIMARY')
      )
      
      if (primaryKeywords.length > 0) {
        factors.push(`Strong IPL keywords: ${primaryKeywords.join(', ')}`)
        breakdown.keywords = 0.6
      } else {
        factors.push(`Supporting keywords: ${info.keywords.join(', ')}`)
        breakdown.keywords = 0.4
      }
    }

    // Analyze month/year contribution
    if (info.paymentMonth) {
      factors.push(`Payment month identified: ${info.paymentMonth}`)
      breakdown.monthYear = 0.1
    }

    if (info.paymentYear) {
      factors.push(`Payment year identified: ${info.paymentYear}`)
      breakdown.monthYear += 0.05
    }

    // Analyze payment type contribution
    if (info.paymentType) {
      factors.push(`Payment type identified: ${info.paymentType}`)
      breakdown.paymentType = 0.1
    }

    // Analyze RT/RW contribution
    if (info.rt || info.rw) {
      factors.push(`RT/RW information found`)
      breakdown.rtRw = 0.05
    }

    return {
      isIPLTransaction: info.isIPLTransaction,
      confidenceFactors: factors,
      confidenceBreakdown: breakdown
    }
  }
}

/**
 * Utility function to create an IPL identifier with Indonesian language support
 */
export function createIndonesianIPLIdentifier(): IPLIdentifier {
  return new IPLIdentifier()
}

/**
 * Utility function to check if an amount is typical for IPL payments
 */
export function isTypicalIPLAmount(amount: number): boolean {
  return amount >= 200000 && amount <= 250000
}

/**
 * Utility function to estimate number of months covered by payment amount
 */
export function estimatePaymentMonths(amount: number, standardAmount: number = 200000): number {
  if (amount < standardAmount * 0.5) return 0 // Too small to be a valid payment
  if (amount < standardAmount * 1.5) return 1
  if (amount < standardAmount * 2.5) return 2
  if (amount < standardAmount * 3.5) return 3
  if (amount < standardAmount * 4.5) return 4
  if (amount < standardAmount * 5.5) return 5
  if (amount < standardAmount * 6.5) return 6
  
  return Math.floor(amount / standardAmount)
}