/**
 * Enhanced Bank Mutation Matching Engine
 * Uses historical verification data to improve matching accuracy
 */

import { db } from '@/lib/db'
import { 
  extractPaymentIndexFromAmount, 
  parseDescription, 
  findBestNameMatch,
  calculateDateDifference,
  type BankTransaction,
  type MatchResult
} from './bank-mutation-utils'

export interface EnhancedMatchResult extends MatchResult {
  historicalConfidence: number
  aliasMatches: string[]
  descriptionPatterns: string[]
}

export class EnhancedBankMatcher {
  private residents: any[] = []
  private bankAliases: Map<string, string[]> = new Map() // resident_id -> bank names
  private verificationPatterns: Map<string, any[]> = new Map() // pattern -> historical matches

  async initialize() {
    // Load residents with their bank aliases
    this.residents = await db.resident.findMany({
      where: { is_active: true },
      include: {
        bankAliases: {
          where: { is_verified: true },
          orderBy: { frequency: 'desc' }
        }
      }
    })

    // Build alias lookup map
    for (const resident of this.residents) {
      const aliases = resident.bankAliases.map((alias: any) => alias.bank_name)
      this.bankAliases.set(resident.id, aliases)
    }

    // Load historical verification patterns
    await this.loadVerificationPatterns()
  }

  private async loadVerificationPatterns() {
    const historicalVerifications = await db.bankMutationVerification.findMany({
      where: {
        action: 'MANUAL_CONFIRM',
        verified_by: 'HISTORICAL_IMPORT'
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
        
        if (!this.verificationPatterns.has(resident_id)) {
          this.verificationPatterns.set(resident_id, [])
        }
        
        this.verificationPatterns.get(resident_id)!.push({
          description,
          amount: verification.mutation.amount,
          confidence: verification.confidence,
          notes: verification.notes
        })
      }
    }
  }

  async findBestMatch(transaction: BankTransaction): Promise<EnhancedMatchResult | null> {
    const results: EnhancedMatchResult[] = []

    // Strategy 1: Payment Index Matching
    const payment_index = extractPaymentIndexFromAmount(transaction.amount)
    if (payment_index) {
      const resident = this.residents.find(r => r.payment_index === payment_index)
      if (resident) {
        const result = await this.createMatchResult(
          resident,
          transaction,
          'PAYMENT_INDEX',
          0.95,
          ['Payment index exact match']
        )
        results.push(result)
      }
    }

    // Strategy 2: Historical Pattern Matching
    for (const [resident_id, patterns] of this.verificationPatterns) {
      const similarity = this.calculatePatternSimilarity(transaction, patterns)
      if (similarity > 0.7) {
        const resident = this.residents.find(r => r.id === resident_id)
        if (resident) {
          const result = await this.createMatchResult(
            resident,
            transaction,
            'HISTORICAL_PATTERN',
            similarity * 0.8, // Historical patterns get 80% max confidence
            [`Historical pattern match: ${similarity.toFixed(2)}`]
          )
          results.push(result)
        }
      }
    }

    // Strategy 3: Enhanced Bank Alias Matching
    const descriptionData = parseDescription(transaction.description)
    for (const name of descriptionData.names) {
      for (const [resident_id, aliases] of this.bankAliases) {
        const aliasMatch = aliases.find(alias => 
          this.calculateNameSimilarity(name, alias) > 0.8
        )
        
        if (aliasMatch) {
          const resident = this.residents.find(r => r.id === resident_id)
          if (resident) {
            const similarity = this.calculateNameSimilarity(name, aliasMatch)
            const result = await this.createMatchResult(
              resident,
              transaction,
              'BANK_ALIAS',
              similarity * 0.7, // Bank alias matches get 70% max confidence
              [`Bank alias match: ${name} → ${aliasMatch}`]
            )
            results.push(result)
          }
        }
      }
    }

    // Strategy 4: House Number Pattern Matching
    const housePattern = this.extractHousePattern(transaction.description)
    if (housePattern) {
      const resident = this.residents.find(r => 
        r.blok && r.house_number && 
        `${r.blok} / ${r.house_number}` === housePattern
      )
      
      if (resident) {
        const result = await this.createMatchResult(
          resident,
          transaction,
          'HOUSE_PATTERN',
          0.85,
          [`House pattern match: ${housePattern}`]
        )
        results.push(result)
      }
    }

    // Return best match
    if (results.length === 0) return null
    
    // Sort by confidence and return the best
    results.sort((a, b) => b.confidence - a.confidence)
    return results[0]
  }

  private async createMatchResult(
    resident: any,
    transaction: BankTransaction,
    strategy: string,
    baseConfidence: number,
    matchFactors: string[]
  ): Promise<EnhancedMatchResult> {
    // Check for matching payment within date range
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

    // Boost confidence if exact payment match found
    let finalConfidence = baseConfidence
    if (matchingPayment) {
      const dateDiff = calculateDateDifference(transaction_date, matchingPayment.payment_date)
      const dateBoost = Math.max(0, 0.1 - (dateDiff * 0.02)) // Up to 10% boost for close dates
      finalConfidence = Math.min(0.98, baseConfidence + dateBoost)
      matchFactors.push(`Payment found within ${dateDiff} days`)
    }

    // Calculate historical confidence
    const historicalPatterns = this.verificationPatterns.get(resident.id) || []
    const historicalConfidence = this.calculatePatternSimilarity(transaction, historicalPatterns)

    // Get bank aliases for this resident
    const aliasMatches = this.bankAliases.get(resident.id) || []

    // Extract description patterns
    const descriptionData = parseDescription(transaction.description)
    const descriptionPatterns = [
      ...descriptionData.names,
      ...descriptionData.keywords,
      descriptionData.rtRw ? `RT${descriptionData.rtRw.rt}/RW${descriptionData.rtRw.rw}` : ''
    ].filter(Boolean)

    return {
      resident_id: resident.id,
      payment_id: matchingPayment?.id,
      confidence: finalConfidence,
      matchFactors,
      strategy,
      historicalConfidence,
      aliasMatches,
      descriptionPatterns
    }
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
      } else if (Math.abs(pattern.amount - transaction.amount) < 50000) { // Within 50k
        similarity += 0.2
      }
      
      maxSimilarity = Math.max(maxSimilarity, similarity)
    }
    
    return maxSimilarity
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

  private extractHousePattern(description: string): string | null {
    // Look for house patterns like "C7 no.31", "C 11 / 16", etc.
    const patterns = [
      /C\s*(\d+)\s*[\/\s]\s*(\d+)/i,
      /C(\d+)\s*no\.?\s*(\d+)/i,
      /blok\s*C\s*(\d+)\s*no\.?\s*(\d+)/i,
      /C\s*(\d+)\s*\/\s*(\d+)/i
    ]

    for (const pattern of patterns) {
      const match = description.match(pattern)
      if (match) {
        const blok = `C ${match[1]}`
        const number = match[2]
        return `${blok} / ${number}`
      }
    }

    return null
  }

  async updateLearning(mutation: any, verificationResult: any) {
    // Update bank aliases based on successful verifications
    if (verificationResult.action === 'MANUAL_CONFIRM' && mutation.matched_resident_id) {
      const descriptionData = parseDescription(mutation.description)
      
      for (const name of descriptionData.names) {
        if (name.length > 2) {
          await db.residentBankAlias.upsert({
            where: {
              residentId_bankName: {
                resident_id: mutation.matched_resident_id,
                bank_name: name
              }
            },
            update: {
              frequency: { increment: 1 },
              last_seen: new Date(),
              is_verified: true
            },
            create: {
              resident_id: mutation.matched_resident_id,
              bank_name: name,
              frequency: 1,
              is_verified: true
            }
          })
        }
      }
      
      // Reload aliases
      await this.initialize()
    }
  }
}
