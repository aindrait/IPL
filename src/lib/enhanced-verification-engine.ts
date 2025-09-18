/**
 * Enhanced Verification Engine with Tiered Matching Approach
 * Implements rule-based matching, AI-powered matching, and manual verification
 */

import { db } from '@/lib/db'
import {
  extractPaymentIndexFromAmount,
  parseDescription,
  calculateDateDifference,
  categorizeTransaction,
  type BankTransaction,
  type MatchResult
} from './bank-mutation-utils'

export interface EnhancedVerificationResult {
  resident_id?: string
  payment_id?: string
  confidence: number
  strategy: string
  factors: string[]
  requiresAIVerification: boolean
  requiresManualVerification: boolean
  aiSuggestions?: string[]
  reasoning?: string
  multipleMatches?: boolean
  matchedMutations?: string[]
}

export interface VerificationContext {
  residents: any[]
  bankAliases: Map<string, string[]>
  historicalPatterns: Map<string, any[]>
  learningData: Map<string, any>
}

export class EnhancedVerificationEngine {
  private context: VerificationContext | null = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Load residents with their data
    const residents = await db.resident.findMany({
      where: { is_active: true },
      include: {
        bankAliases: {
          where: { is_verified: true },
          orderBy: { frequency: 'desc' }
        }
      }
    })

    // Build alias lookup map
    const bankAliases = new Map<string, string[]>()
    for (const resident of residents) {
      const aliases = resident.bankAliases.map((alias: any) => alias.bank_name)
      bankAliases.set(resident.id, aliases)
    }

    // Load historical verification patterns
    const historicalPatterns = await this.loadHistoricalPatterns()

    // Load learning data
    const learningData = await this.loadLearningData()

    this.context = {
      residents,
      bankAliases,
      historicalPatterns,
      learningData
    }

    this.isInitialized = true
  }

  private async loadHistoricalPatterns(): Promise<Map<string, any[]>> {
    const patterns = new Map<string, any[]>()

    const historicalVerifications = await db.bankMutationVerification.findMany({
      where: {
        action: 'MANUAL_CONFIRM',
        OR: [
          { verified_by: 'HISTORICAL_IMPORT' },
          { verified_by: 'SYSTEM' }
        ]
      },
      include: {
        mutation: {
          include: {
            matchedResident: true
          }
        }
      }
    })

    // Group by resident and build patterns
    for (const verification of historicalVerifications) {
      if (verification.mutation?.matchedResident) {
        const resident_id = verification.mutation.matchedResident.id
        const description = verification.mutation.description
        
        if (!patterns.has(resident_id)) {
          patterns.set(resident_id, [])
        }
        
        patterns.get(resident_id)!.push({
          description,
          amount: verification.mutation.amount,
          confidence: verification.confidence,
          notes: verification.notes
        })
      }
    }

    return patterns
  }

  private async loadLearningData(): Promise<Map<string, any>> {
    const learningData = new Map<string, any>()

    // Load learning data from database if the table exists
    try {
      // Use type assertion to bypass TypeScript checking for now
      const learningRecords = await (db as any).verificationLearningData.findMany()
      
      for (const record of learningRecords) {
        learningData.set(record.resident_id, {
          name_patterns: JSON.parse(record.name_patterns || '[]'),
          address_patterns: JSON.parse(record.address_patterns || '[]'),
          transaction_patterns: JSON.parse(record.transaction_patterns || '[]'),
          confidence_scores: JSON.parse(record.confidence_scores || '[]'),
          last_updated: record.last_updated
        })
      }
    } catch (error) {
      console.log('Learning data table not available, starting with empty learning data')
    }

    return learningData
  }

  async verifyTransaction(transaction: BankTransaction): Promise<EnhancedVerificationResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.context) {
      throw new Error('Verification engine not initialized')
    }

    // First, categorize the transaction to determine if it should be omitted
    const categorization = categorizeTransaction(transaction.description)
    
    // If transaction should be omitted, return early with appropriate result
    if (categorization.shouldOmit) {
      return {
        confidence: 0,
        strategy: 'OMITTED',
        factors: [categorization.omit_reason || 'Transaction omitted from verification'],
        requiresAIVerification: false,
        requiresManualVerification: false,
        reasoning: `Transaction categorized as ${categorization.category} and omitted from verification`
      }
    }

    // Phase 1: Rule-based matching
    const ruleBasedResult = await this.performRuleBasedMatching(transaction, categorization.category)
    
    if (ruleBasedResult.confidence >= 0.8) {
      return {
        ...ruleBasedResult,
        requiresAIVerification: false,
        requiresManualVerification: false
      }
    }

    // Phase 2: AI-powered matching (for medium confidence results)
    if (ruleBasedResult.confidence >= 0.5 && ruleBasedResult.confidence < 0.8) {
      return {
        ...ruleBasedResult,
        requiresAIVerification: true,
        requiresManualVerification: false,
        aiSuggestions: ['Consider AI verification for improved accuracy']
      }
    }

    // Phase 3: Manual verification (for low confidence results)
    return {
      confidence: 0,
      strategy: 'NO_MATCH',
      factors: ['No automatic match found'],
      requiresAIVerification: false,
      requiresManualVerification: true,
      aiSuggestions: ['Manual verification required']
    }
  }

  private async performRuleBasedMatching(transaction: BankTransaction, category?: string): Promise<EnhancedVerificationResult> {
    const results: EnhancedVerificationResult[] = []

    // Strategy 1: Payment Index Matching (Highest Priority)
    const paymentIndexResult = await this.matchByPaymentIndex(transaction)
    if (paymentIndexResult) {
      results.push(paymentIndexResult)
    }

    // Strategy 2: Enhanced Name Matching
    const nameMatchResult = await this.matchByName(transaction)
    if (nameMatchResult) {
      results.push(nameMatchResult)
    }

    // Strategy 3: Address Pattern Matching
    const addressMatchResult = await this.matchByAddressPattern(transaction)
    if (addressMatchResult) {
      results.push(addressMatchResult)
    }

    // Strategy 4: Historical Pattern Matching
    const historicalMatchResult = await this.matchByHistoricalPattern(transaction)
    if (historicalMatchResult) {
      results.push(historicalMatchResult)
    }

    // Strategy 5: IPL Transaction Matching
    const iplMatchResult = await this.matchByIPLPattern(transaction)
    if (iplMatchResult) {
      results.push(iplMatchResult)
    }

    // Return the best match
    if (results.length === 0) {
      return {
        confidence: 0,
        strategy: 'NO_MATCH',
        factors: ['No matching strategy found'],
        requiresAIVerification: false,
        requiresManualVerification: false
      }
    }

    // Sort by confidence and return the best
    results.sort((a, b) => b.confidence - a.confidence)
    return results[0]
  }

  private async matchByPaymentIndex(transaction: BankTransaction): Promise<EnhancedVerificationResult | null> {
    if (!transaction.amount) return null
    const payment_index = extractPaymentIndexFromAmount(transaction.amount)
    if (!payment_index) return null

    const resident = this.context!.residents.find(r => r.payment_index === payment_index)
    if (!resident) return null

    // Try to find matching payment within date range
    const transaction_date = new Date(transaction.date)
    const matchingPayment = await db.payment.findFirst({
      where: {
        resident_id: resident.id,
        amount: transaction.amount,
        payment_date: {
          gte: new Date(transaction_date.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(transaction_date.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { payment_date: 'desc' }
    })

    const confidence = matchingPayment ? 0.95 : 0.9
    const factors = [`Payment index match: ${payment_index}`]
    
    if (matchingPayment) {
      const dateDiff = calculateDateDifference(transaction_date, matchingPayment.payment_date)
      factors.push(`Payment found within ${dateDiff} days`)
    }

    return {
      resident_id: resident.id,
      payment_id: matchingPayment?.id,
      confidence,
      strategy: 'PAYMENT_INDEX',
      factors,
      requiresAIVerification: false,
      requiresManualVerification: false
    }
  }

  private async matchByName(transaction: BankTransaction): Promise<EnhancedVerificationResult | null> {
    const descriptionData = parseDescription(transaction.description)
    if (descriptionData.names.length === 0) return null

    let bestMatch: { resident_id: string; similarity: number; matchedName: string } | null = null

    // Check against resident names and aliases
    for (const name of descriptionData.names) {
      for (const resident of this.context!.residents) {
        // Check primary name
        const primarySimilarity = this.calculateNameSimilarity(name, resident.name)
        if (primarySimilarity > 0.7 && primarySimilarity > (bestMatch?.similarity || 0)) {
          bestMatch = {
            resident_id: resident.id,
            similarity: primarySimilarity,
            matchedName: resident.name
          }
        }

        // Check aliases
        const aliases = this.context!.bankAliases.get(resident.id) || []
        for (const alias of aliases) {
          const aliasSimilarity = this.calculateNameSimilarity(name, alias)
          if (aliasSimilarity > 0.7 && aliasSimilarity > (bestMatch?.similarity || 0)) {
            bestMatch = {
              resident_id: resident.id,
              similarity: aliasSimilarity,
              matchedName: alias
            }
          }
        }
      }
    }

    if (!bestMatch) return null

    // Try to find matching payment
    if (!transaction.amount) return null
    const transaction_date = new Date(transaction.date)
    const matchingPayment = await db.payment.findFirst({
      where: {
        resident_id: bestMatch.resident_id,
        amount: transaction.amount,
        payment_date: {
          gte: new Date(transaction_date.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(transaction_date.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { payment_date: 'desc' }
    })

    const confidence = matchingPayment ? bestMatch.similarity * 0.9 : bestMatch.similarity * 0.7
    const factors = [`Name match: ${bestMatch.matchedName} (${Math.round(bestMatch.similarity * 100)}%)`]
    
    if (matchingPayment) {
      const dateDiff = calculateDateDifference(transaction_date, matchingPayment.payment_date)
      factors.push(`Payment found within ${dateDiff} days`)
    }

    return {
      resident_id: bestMatch.resident_id,
      payment_id: matchingPayment?.id,
      confidence,
      strategy: 'NAME_MATCH',
      factors,
      requiresAIVerification: false,
      requiresManualVerification: false
    }
  }

  private async matchByAddressPattern(transaction: BankTransaction): Promise<EnhancedVerificationResult | null> {
    const addressPattern = this.extractAddressPattern(transaction.description)
    if (!addressPattern) return null

    // Try exact match first
    let resident = this.context!.residents.find(r =>
      r.blok && r.house_number &&
      `${r.blok} / ${r.house_number}` === addressPattern
    )

    // If no exact match, try fuzzy address matching
    if (!resident) {
      resident = this.findResidentByFuzzyAddress(addressPattern)
    }

    if (!resident) return null

    // Try to find matching payment
    if (!transaction.amount) return null
    const transaction_date = new Date(transaction.date)
    const matchingPayment = await db.payment.findFirst({
      where: {
        resident_id: resident.id,
        amount: transaction.amount,
        payment_date: {
          gte: new Date(transaction_date.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(transaction_date.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { payment_date: 'desc' }
    })

    // Calculate confidence based on match type and payment
    let confidence = matchingPayment ? 0.9 : 0.85
    const factors = [`Address pattern match: ${addressPattern}`]
    
    // Reduce confidence for fuzzy matches
    if (!this.context!.residents.find(r =>
      r.blok && r.house_number &&
      `${r.blok} / ${r.house_number}` === addressPattern
    )) {
      confidence -= 0.1 // Reduce confidence for fuzzy address match
      factors.push('Fuzzy address match')
    }
    
    if (matchingPayment) {
      const dateDiff = calculateDateDifference(transaction_date, matchingPayment.payment_date)
      factors.push(`Payment found within ${dateDiff} days`)
    }

    return {
      resident_id: resident.id,
      payment_id: matchingPayment?.id,
      confidence,
      strategy: 'ADDRESS_PATTERN',
      factors,
      requiresAIVerification: false,
      requiresManualVerification: false
    }
  }

  /**
   * Find resident by fuzzy address matching
   */
  private findResidentByFuzzyAddress(addressPattern: string) {
    // Normalize address pattern for comparison (remove extra spaces)
    const normalizedPattern = addressPattern.replace(/\s+/g, ' ').trim()
    
    let bestMatch: { resident: any; score: number } | null = null
    
    for (const resident of this.context!.residents) {
      if (!resident.blok || !resident.house_number) continue
      
      // Normalize resident address for comparison
      const residentAddress = `${resident.blok} / ${resident.house_number}`.replace(/\s+/g, ' ').trim()
      
      // Check for exact match first
      if (residentAddress === normalizedPattern) {
        return resident
      }
      
      // Check for partial match (e.g., if one has "C10" and other has "C 10")
      const patternParts = normalizedPattern.split(' / ')
      const residentParts = residentAddress.split(' / ')
      
      if (patternParts.length === 2 && residentParts.length === 2) {
        // Check blok part (remove spaces for comparison)
        const patternBlok = patternParts[0].replace(/\s+/g, '')
        const residentBlok = residentParts[0].replace(/\s+/g, '')
        
        // Check house number part
        const patternNumber = patternParts[1]
        const residentNumber = residentParts[1]
        
        // Calculate match score
        let score = 0
        if (patternBlok === residentBlok) score += 0.5
        if (patternNumber === residentNumber) score += 0.5
        
        // Fuzzy matching for house number (if they're close)
        if (patternNumber !== residentNumber) {
          const patternNum = parseInt(patternNumber)
          const residentNum = parseInt(residentNumber)
          if (!isNaN(patternNum) && !isNaN(residentNum) && Math.abs(patternNum - residentNum) <= 1) {
            score += 0.3 // Partial match for close numbers
          }
        }
        
        // Only consider it a match if score is at least 0.5
        if (score >= 0.5 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { resident, score }
        }
      }
    }
    
    return bestMatch ? bestMatch.resident : null
  }

  private async matchByHistoricalPattern(transaction: BankTransaction): Promise<EnhancedVerificationResult | null> {
    let bestMatch: { resident_id: string; similarity: number } | null = null

    for (const [resident_id, patterns] of this.context!.historicalPatterns) {
      const similarity = this.calculatePatternSimilarity(transaction, patterns)
      if (similarity > 0.7 && similarity > (bestMatch?.similarity || 0)) {
        bestMatch = { resident_id, similarity }
      }
    }

    if (!bestMatch) return null

    const resident = this.context!.residents.find(r => r.id === bestMatch!.resident_id)
    if (!resident) return null

    // Try to find matching payment
    if (!transaction.amount) return null
    const transaction_date = new Date(transaction.date)
    const matchingPayment = await db.payment.findFirst({
      where: {
        resident_id: resident.id,
        amount: transaction.amount,
        payment_date: {
          gte: new Date(transaction_date.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(transaction_date.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { payment_date: 'desc' }
    })

    const confidence = matchingPayment ? bestMatch.similarity * 0.85 : bestMatch.similarity * 0.75
    const factors = [`Historical pattern match: ${Math.round(bestMatch.similarity * 100)}%`]
    
    if (matchingPayment) {
      const dateDiff = calculateDateDifference(transaction_date, matchingPayment.payment_date)
      factors.push(`Payment found within ${dateDiff} days`)
    }

    return {
      resident_id: resident.id,
      payment_id: matchingPayment?.id,
      confidence,
      strategy: 'HISTORICAL_PATTERN',
      factors,
      requiresAIVerification: false,
      requiresManualVerification: false
    }
  }

  private async matchByIPLPattern(transaction: BankTransaction): Promise<EnhancedVerificationResult | null> {
    const iplInfo = this.identifyIPLTransaction(transaction.description)
    if (!iplInfo.isIPLTransaction) return null

    // Find residents with payment schedules for the identified period
    const matchingResidents = this.context!.residents.filter(resident => {
      // This would need to be enhanced to check against payment schedules
      // For now, we'll use a simple amount-based check
      return transaction.amount && transaction.amount >= 200000 && transaction.amount <= 500000
    })

    if (matchingResidents.length !== 1) return null

    const resident = matchingResidents[0]

    // Try to find matching payment
    if (!transaction.amount) return null
    const transaction_date = new Date(transaction.date)
    const matchingPayment = await db.payment.findFirst({
      where: {
        resident_id: resident.id,
        amount: transaction.amount,
        payment_date: {
          gte: new Date(transaction_date.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(transaction_date.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { payment_date: 'desc' }
    })

    const confidence = matchingPayment ? 0.8 : 0.7
    const factors = [`IPL transaction: ${iplInfo.keywords.join(', ')}`]
    
    if (matchingPayment) {
      const dateDiff = calculateDateDifference(transaction_date, matchingPayment.payment_date)
      factors.push(`Payment found within ${dateDiff} days`)
    }

    return {
      resident_id: resident.id,
      payment_id: matchingPayment?.id,
      confidence,
      strategy: 'IPL_PATTERN',
      factors,
      requiresAIVerification: false,
      requiresManualVerification: false
    }
  }

  private extractAddressPattern(description: string): string | null {
    // Look for house patterns like "C7 no.31", "C 11 / 16", "c11 no 10", etc.
    const patterns = [
      /C\s*(\d+)\s*[\/\s]\s*(\d+)/i,      // C # / #
      /C(\d+)\s*no\.?\s*(\d+)/i,         // C# no #
      /blok\s*C\s*(\d+)\s*no\.?\s*(\d+)/i, // Blok C# no #
      /C\s*(\d+)\s*\/\s*(\d+)/i,         // C # / #
      /c(\d+)\s*no\s*(\d+)/i,            // c# no # (lowercase)
      /C(\d+)\s*no\s*(\d+)/i,            // C# no # (no period)
    ]

    for (const pattern of patterns) {
      const match = description.match(pattern)
      if (match) {
        const blok = `C ${match[1]}`.replace(/\s+/g, ' ').trim() // Normalize spacing
        const number = match[2]
        return `${blok} / ${number}`
      }
    }

    return null
  }

  private calculateNameSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()
    
    if (s1 === s2) return 1.0
    if (s1.length === 0 || s2.length === 0) return 0.0
    
    // Simple substring matching for Indonesian names
    if (s1.includes(s2) || s2.includes(s1)) return 0.8
    
    // Word-based matching
    const words1 = s1.split(/\s+/)
    const words2 = s2.split(/\s+/)
    
    let matchCount = 0
    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1.length >= 3 && word2.length >= 3) {
          if (word1.includes(word2) || word2.includes(word1)) {
            matchCount++
            break
          }
        }
      }
    }
    
    return matchCount / Math.max(words1.length, words2.length)
  }

  private calculatePatternSimilarity(transaction: BankTransaction, patterns: any[]): number {
    if (patterns.length === 0) return 0

    let maxSimilarity = 0
    
    for (const pattern of patterns) {
      let similarity = 0
      
      // Description similarity
      const descSimilarity = this.calculateNameSimilarity(
        transaction.description, 
        pattern.description
      )
      similarity += descSimilarity * 0.6
      
      // Amount similarity
      if (pattern.amount === transaction.amount) {
        similarity += 0.4
      } else if (transaction.amount && Math.abs(pattern.amount - transaction.amount) < 50000) { // Within 50k
        similarity += 0.2
      }
      
      maxSimilarity = Math.max(maxSimilarity, similarity)
    }
    
    return maxSimilarity
  }

  private identifyIPLTransaction(description: string): {
    isIPLTransaction: boolean
    keywords: string[]
    paymentMonth?: string
    paymentYear?: number
  } {
    const lowerDesc = description.toLowerCase()
    const iplKeywords = ['ipl', 'kas', 'iuran', 'rt', 'rw', 'bulanan', 'bayar', 'sumbangan', 'thr']
    
    const foundKeywords = iplKeywords.filter(keyword => 
      lowerDesc.includes(keyword)
    )

    if (foundKeywords.length === 0) {
      return {
        isIPLTransaction: false,
        keywords: []
      }
    }

    // Extract payment month
    const monthKeywords = [
      'januari', 'februari', 'maret', 'april', 'mei', 'juni',
      'juli', 'agustus', 'september', 'oktober', 'november', 'desember'
    ]
    
    let paymentMonth: string | undefined
    for (const month of monthKeywords) {
      if (lowerDesc.includes(month)) {
        paymentMonth = month
        break
      }
    }

    // Extract year if present
    let paymentYear: number | undefined
    const yearMatch = description.match(/\b(20\d{2})\b/)
    if (yearMatch) {
      paymentYear = parseInt(yearMatch[1], 10)
    }

    return {
      isIPLTransaction: true,
      keywords: foundKeywords,
      paymentMonth,
      paymentYear
    }
  }

  async updateLearning(mutation: any, verificationResult: any): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    // Update learning data based on verification results
    if (verificationResult.action === 'MANUAL_CONFIRM' && mutation.matched_resident_id) {
      const resident_id = mutation.matched_resident_id
      const description = mutation.description
      
      // Extract patterns from successful verification
      const name_patterns = this.extractNamePatterns(description)
      const address_patterns = this.extractAddressPatterns(description)
      const transaction_patterns = this.extractTransactionPatterns(description)
      
      // Get or create learning data for this resident
      let learningData = this.context!.learningData.get(resident_id) || {
        name_patterns: [],
        address_patterns: [],
        transaction_patterns: [],
        confidence_scores: [],
        last_updated: new Date()
      }
      
      // Merge new patterns
      learningData.name_patterns = [...new Set([...learningData.name_patterns, ...name_patterns])]
      learningData.address_patterns = [...new Set([...learningData.address_patterns, ...address_patterns])]
      learningData.transaction_patterns = [...new Set([...learningData.transaction_patterns, ...transaction_patterns])]
      learningData.confidence_scores.push(verificationResult.confidence || 0.5)
      learningData.last_updated = new Date()
      
      this.context!.learningData.set(resident_id, learningData)
      
      // Persist to database
      await this.persistLearningData(resident_id, learningData)
    }
  }

  private extractNamePatterns(description: string): string[] {
    const nameMatches = description.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) || []
    return nameMatches
  }

  private extractAddressPatterns(description: string): string[] {
    const address_patterns: string[] = []
    const addressMatch = description.match(/C\s*\d+\s*[\/\s]?\s*\d+/i)
    if (addressMatch) {
      address_patterns.push(addressMatch[0])
    }
    return address_patterns
  }

  private extractTransactionPatterns(description: string): string[] {
    return description.split(/\s+/).filter(word => word.length > 3)
  }

  private async persistLearningData(resident_id: string, data: any): Promise<void> {
    try {
      // Use type assertion to bypass TypeScript checking for now
      await (db as any).verificationLearningData.upsert({
        where: { resident_id },
        update: {
          name_patterns: JSON.stringify(data.name_patterns),
          address_patterns: JSON.stringify(data.address_patterns),
          transaction_patterns: JSON.stringify(data.transaction_patterns),
          confidence_scores: JSON.stringify(data.confidence_scores),
          last_updated: data.last_updated
        },
        create: {
          resident_id,
          name_patterns: JSON.stringify(data.name_patterns),
          address_patterns: JSON.stringify(data.address_patterns),
          transaction_patterns: JSON.stringify(data.transaction_patterns),
          confidence_scores: JSON.stringify(data.confidence_scores),
          last_updated: data.last_updated
        }
      })
    } catch (error) {
      console.log('Unable to persist learning data, table may not exist yet')
    }
  }

  /**
   * Find all bank mutations that match a specific payment
   * This allows for one payment to match multiple bank entries
   */
  async findMatchingMutationsForPayment(payment_id: string): Promise<{
    payment: any
    mutations: Array<{
      mutation: any
      confidence: number
      strategy: string
      factors: string[]
    }>
  }> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    // Get the payment details
    const payment = await db.payment.findUnique({
      where: { id: payment_id },
      include: {
        resident: true
      }
    })

    if (!payment) {
      throw new Error('Payment not found')
    }

    // Find all potential matching bank mutations
    const mutations = await db.bankMutation.findMany({
      where: {
        OR: [
          { matched_payment_id: payment_id }, // Already matched
          {
            matched_payment_id: null, // Not matched yet
            is_verified: false // Not verified
          }
        ],
        amount: payment.amount, // Exact amount match
        transaction_date: {
          gte: new Date(new Date(payment.payment_date).getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(new Date(payment.payment_date).getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { transaction_date: 'desc' }
    })

    // Calculate match confidence for each mutation
    const matchingMutations: Array<{
      mutation: any
      confidence: number
      strategy: string
      factors: string[]
    }> = []
    for (const mutation of mutations) {
      const transaction: BankTransaction = {
        date: mutation.transaction_date.toISOString().split('T')[0],
        description: mutation.description,
        amount: mutation.amount,
        transaction_type: mutation.reference_number as 'CR' | 'DB' | null
      }

      const result = await this.performRuleBasedMatching(transaction)
      
      // Only include if it matches the payment's resident
      if (result.resident_id === payment.resident_id) {
        matchingMutations.push({
          mutation,
          confidence: result.confidence,
          strategy: result.strategy,
          factors: result.factors
        })
      }
    }

    return {
      payment,
      mutations: matchingMutations
    }
  }

  /**
   * Automatically categorize and flag transactions that should be omitted
   * This method processes a batch of transactions and updates their categorization
   */
  async categorizeAndFlagTransactions(transactions: BankTransaction[]): Promise<{
    processed: Array<{
      transaction: BankTransaction
      categorization: {
        category: string
        confidence: number
        shouldOmit: boolean
        omit_reason?: string
      }
    }>
    omitted: number
    needsVerification: number
  }> {
    const processed: Array<{
      transaction: BankTransaction
      categorization: {
        category: string
        confidence: number
        shouldOmit: boolean
        omit_reason?: string
      }
    }> = []
    let omitted = 0
    let needsVerification = 0

    for (const transaction of transactions) {
      const categorization = categorizeTransaction(transaction.description)
      processed.push({ transaction, categorization })

      if (categorization.shouldOmit) {
        omitted++
      } else {
        needsVerification++
      }
    }

    return {
      processed,
      omitted,
      needsVerification
    }
  }

  /**
   * Process a batch of bank mutations to categorize and omit non-IPL transactions
   */
  async processBankMutationBatch(batchId: string): Promise<{
    total: number
    omitted: number
    categorized: number
    errors: string[]
  }> {
    try {
      // Get all mutations in the batch
      const mutations = await db.bankMutation.findMany({
        where: { upload_batch: batchId }
      })

      const errors: string[] = []
      let omitted = 0
      let categorized = 0

      for (const mutation of mutations) {
        try {
          // Create a BankTransaction object for categorization
          const transaction: BankTransaction = {
            date: mutation.transaction_date.toISOString().split('T')[0],
            description: mutation.description,
            amount: mutation.amount,
            transaction_type: mutation.reference_number as 'CR' | 'DB' | null
          }

          // Categorize the transaction
          const categorization = categorizeTransaction(transaction.description)

          // For now, we'll just store the categorization information in the verification results
          // In a real implementation, you would add these fields to the BankMutation model
          console.log(`Categorized mutation ${mutation.id}:`, categorization)

          if (categorization.shouldOmit) {
            omitted++
          } else {
            categorized++
          }
        } catch (error) {
          errors.push(`Error processing mutation ${mutation.id}: ${error}`)
        }
      }

      return {
        total: mutations.length,
        omitted,
        categorized,
        errors
      }
    } catch (error) {
      return {
        total: 0,
        omitted: 0,
        categorized: 0,
        errors: [`Failed to process batch: ${error}`]
      }
    }
  }

  /**
   * Match multiple bank mutations to a single payment
   */
  async matchMultipleMutationsToPayment(payment_id: string, mutationIds: string[]): Promise<boolean> {
    try {
      // Verify all mutations exist and are not already matched to other payments
      const mutations = await db.bankMutation.findMany({
        where: {
          id: { in: mutationIds },
          matched_payment_id: null, // Not already matched
          is_verified: false // Not verified
        }
      })

      if (mutations.length !== mutationIds.length) {
        throw new Error('Some mutations are not available for matching')
      }

      // Get payment details
      const payment = await db.payment.findUnique({
        where: { id: payment_id }
      })

      if (!payment) {
        throw new Error('Payment not found')
      }

      // Match all mutations to the payment
      await db.bankMutation.updateMany({
        where: { id: { in: mutationIds } },
        data: {
          matched_payment_id: payment_id,
          matched_resident_id: payment.resident_id,
          is_verified: true,
          verified_at: new Date(),
          verified_by: 'MULTIPLE_MATCH'
        }
      })

      return true
    } catch (error) {
      console.error('Error matching multiple mutations to payment:', error)
      return false
    }
  
  }

  /**
   * Omit a bank mutation from verification process
   * This will prevent the mutation from appearing in verification lists
   */
  async omitBankMutation(mutation_id: string, omit_reason: string): Promise<boolean> {
    try {
      // Check if mutation exists
      const mutation = await db.bankMutation.findUnique({
        where: { id: mutation_id }
      })

      if (!mutation) {
        throw new Error('Bank mutation not found')
      }

      // Update the mutation to mark it as omitted
      await db.bankMutation.update({
        where: { id: mutation_id },
        data: {
          is_verified: true,
          verified_at: new Date(),
          verified_by: 'OMITTED',
          // Store omit reason in verification history
        }
      })

      // Create verification history record
      await (db as any).bankMutationVerification.create({
        data: {
          mutation_id,
          action: 'MANUAL_OMIT',
          notes: omit_reason,
          verified_by: 'USER',
          confidence: 1.0
        }
      })

      return true
    } catch (error) {
      console.error('Error omitting bank mutation:', error)
      return false
    }
  }

  /**
   * Edit a verified or omitted bank mutation
   * This allows for corrections to previously verified mutations
   */
  async editBankMutationVerification(
    mutation_id: string,
    newResidentId?: string,
    newPaymentId?: string,
    newNotes?: string,
    newMatchScore?: number
  ): Promise<boolean> {
    try {
      // Check if mutation exists
      const mutation = await db.bankMutation.findUnique({
        where: { id: mutation_id }
      })

      if (!mutation) {
        throw new Error('Bank mutation not found')
      }

      // Store previous match data for verification history
      const previous_matched_payment_id = mutation.matched_payment_id
      const previousMatchedResidentId = mutation.matched_resident_id

      // Update the mutation with new verification data
      await db.bankMutation.update({
        where: { id: mutation_id },
        data: {
          matched_payment_id: newPaymentId,
          matched_resident_id: newResidentId,
          match_score: newMatchScore,
          is_verified: true,
          verified_at: new Date(),
          verified_by: 'MANUAL_EDIT'
        }
      })

      // Create verification history record
      await (db as any).bankMutationVerification.create({
        data: {
          mutation_id,
          action: 'MANUAL_OVERRIDE',
          notes: newNotes || 'Manual edit of verification',
          verified_by: 'USER',
          confidence: newMatchScore || 1.0,
          previous_matched_payment_id,
          new_matched_payment_id: newPaymentId
        }
      })

      return true
    } catch (error) {
      console.error('Error editing bank mutation verification:', error)
      return false
    }
  }

  /**
   * Get all omitted bank mutations
   * This allows for review of omitted transactions
   */
  async getOmittedBankMutations(): Promise<any[]> {
    try {
      const omittedMutations = await db.bankMutation.findMany({
        where: {
          verified_by: 'OMITTED'
        },
        include: {
          verificationHistory: {
            orderBy: { created_at: 'desc' },
            take: 1
          }
        },
        orderBy: { verified_at: 'desc' }
      })

      return omittedMutations
    } catch (error) {
      console.error('Error getting omitted bank mutations:', error)
      return []
    }
  }

  /**
   * Restore an omitted bank mutation to verification pool
   */
  async restoreOmittedBankMutation(mutation_id: string): Promise<boolean> {
    try {
      // Check if mutation exists and is omitted
      const mutation = await db.bankMutation.findUnique({
        where: { id: mutation_id }
      })

      if (!mutation || mutation.verified_by !== 'OMITTED') {
        throw new Error('Bank mutation not found or not omitted')
      }

      // Update the mutation to restore it to verification pool
      await db.bankMutation.update({
        where: { id: mutation_id },
        data: {
          is_verified: false,
          verified_at: null,
          verified_by: null,
          matched_payment_id: null,
          matched_resident_id: null,
          match_score: null
        }
      })

      // Create verification history record
      await (db as any).bankMutationVerification.create({
        data: {
          mutation_id,
          action: 'SYSTEM_UNMATCH',
          notes: 'Restored omitted mutation to verification pool',
          verified_by: 'SYSTEM',
          confidence: 0
        }
      })

      return true
    } catch (error) {
      console.error('Error restoring omitted bank mutation:', error)
      return false
    }
  }
}