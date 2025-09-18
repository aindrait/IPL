/**
 * Enhanced Verification Learning System
 * Learns from historical verification data to improve matching accuracy
 */

import { db } from '@/lib/db'
import { FuzzyNameMatcher } from './fuzzy-name-matching'
import { AddressPatternMatcher } from './address-pattern-matching'
import { IPLIdentifier } from './ipl-identifier'

export interface LearningData {
  resident_id: string
  name_patterns: Array<{
    pattern: string
    frequency: number
    last_seen: Date
    confidence: number
  }>
  address_patterns: Array<{
    pattern: string
    frequency: number
    last_seen: Date
    confidence: number
  }>
  transaction_patterns: Array<{
    pattern: string
    frequency: number
    last_seen: Date
    confidence: number
  }>
  amountPatterns: Array<{
    amount: number
    frequency: number
    last_seen: Date
    confidence: number
  }>
  averageConfidence: number
  totalVerifications: number
  last_updated: Date
}

export interface LearningInsight {
  type: 'NAME_PATTERN' | 'ADDRESS_PATTERN' | 'TRANSACTION_PATTERN' | 'AMOUNT_PATTERN'
  pattern: string
  confidence: number
  frequency: number
  last_seen: Date
  applicableResidentIds: string[]
}

export class VerificationLearningSystem {
  private learningData: Map<string, LearningData> = new Map()
  private insights: LearningInsight[] = []
  private isInitialized = false
  private fuzzyNameMatcher: FuzzyNameMatcher | null = null
  private addressPatternMatcher: AddressPatternMatcher | null = null
  private iplIdentifier: IPLIdentifier | null = null

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Initialize helper components
    this.addressPatternMatcher = new AddressPatternMatcher()
    this.iplIdentifier = new IPLIdentifier()

    // Load residents for fuzzy name matching
    const residents = await db.resident.findMany({
      where: { is_active: true },
      include: {
        bankAliases: {
          where: { is_verified: true },
          orderBy: { frequency: 'desc' }
        }
      }
    })

    this.fuzzyNameMatcher = new FuzzyNameMatcher(residents)

    // Load learning data from database
    await this.loadLearningData()

    // Load historical verification patterns
    await this.loadHistoricalPatterns()

    // Generate insights from learning data
    this.generateInsights()

    this.isInitialized = true
  }

  private async loadLearningData(): Promise<void> {
    try {
      // Try to load from verification learning data table if it exists
      const learningRecords = await (db as any).verificationLearningData.findMany()
      
      for (const record of learningRecords) {
        const resident_id = record.resident_id
        
        this.learningData.set(resident_id, {
          resident_id,
          name_patterns: JSON.parse(record.name_patterns || '[]'),
          address_patterns: JSON.parse(record.address_patterns || '[]'),
          transaction_patterns: JSON.parse(record.transaction_patterns || '[]'),
          amountPatterns: JSON.parse(record.amountPatterns || '[]'),
          averageConfidence: parseFloat(record.averageConfidence || '0'),
          totalVerifications: parseInt(record.totalVerifications || '0'),
          last_updated: new Date(record.last_updated)
        })
      }
    } catch (error) {
      console.log('Learning data table not available, starting with empty learning data')
    }
  }

  private async loadHistoricalPatterns(): Promise<void> {
    // Load historical verification data to build learning patterns
    const historicalVerifications = await db.bankMutationVerification.findMany({
      where: {
        action: {
          in: ['MANUAL_CONFIRM', 'AUTO_MATCH']
        }
      },
      include: {
        mutation: {
          include: {
            matchedResident: true
          }
        }
      },
      orderBy: { created_at: 'desc' }
    })

    // Process each historical verification
    for (const verification of historicalVerifications) {
      if (verification.mutation?.matchedResident) {
        await this.processHistoricalVerification(verification)
      }
    }
  }

  private async processHistoricalVerification(verification: any): Promise<void> {
    const { mutation, confidence, action } = verification
    const resident_id = mutation.matchedResident.id
    const description = mutation.description
    const amount = mutation.amount
    const created_at = verification.created_at

    // Get or create learning data for this resident
    let learningData = this.learningData.get(resident_id) || {
      resident_id,
      name_patterns: [],
      address_patterns: [],
      transaction_patterns: [],
      amountPatterns: [],
      averageConfidence: 0,
      totalVerifications: 0,
      last_updated: new Date()
    }

    // Extract and update name patterns
    const name_patterns = this.extractNamePatterns(description)
    for (const pattern of name_patterns) {
      this.updatePattern(learningData.name_patterns, pattern, confidence, created_at)
    }

    // Extract and update address patterns
    if (this.addressPatternMatcher) {
      const addressPattern = this.addressPatternMatcher.extractAddressPattern(description)
      if (addressPattern) {
        const formattedAddress = `${addressPattern.blok} / ${addressPattern.house_number}`
        this.updatePattern(learningData.address_patterns, formattedAddress, confidence, created_at)
      }
    }

    // Extract and update transaction patterns
    const transaction_patterns = this.extractTransactionPatterns(description)
    for (const pattern of transaction_patterns) {
      this.updatePattern(learningData.transaction_patterns, pattern, confidence, created_at)
    }

    // Update amount patterns
    this.updateAmountPattern(learningData.amountPatterns, amount, confidence, created_at)

    // Update statistics
    learningData.totalVerifications += 1
    learningData.averageConfidence = this.calculateAverageConfidence(learningData)
    learningData.last_updated = new Date()

    // Store updated learning data
    this.learningData.set(resident_id, learningData)

    // Persist to database
    await this.persistLearningData(resident_id, learningData)
  }

  private updatePattern(
    patterns: Array<{
      pattern: string
      frequency: number
      last_seen: Date
      confidence: number
    }>,
    newPattern: string,
    confidence: number,
    timestamp: Date
  ): void {
    const existingPattern = patterns.find(p => p.pattern === newPattern)
    
    if (existingPattern) {
      existingPattern.frequency += 1
      existingPattern.last_seen = timestamp
      // Update confidence as weighted average
      existingPattern.confidence = (existingPattern.confidence * 0.7) + (confidence * 0.3)
    } else {
      patterns.push({
        pattern: newPattern,
        frequency: 1,
        last_seen: timestamp,
        confidence
      })
    }
  }

  private updateAmountPattern(
    patterns: Array<{
      amount: number
      frequency: number
      last_seen: Date
      confidence: number
    }>,
    amount: number,
    confidence: number,
    timestamp: Date
  ): void {
    // Group amounts into ranges (e.g., 200000-210000)
    const amountRange = this.getAmountRange(amount)
    
    const existingPattern = patterns.find(p => p.amount === amountRange)
    
    if (existingPattern) {
      existingPattern.frequency += 1
      existingPattern.last_seen = timestamp
      existingPattern.confidence = (existingPattern.confidence * 0.7) + (confidence * 0.3)
    } else {
      patterns.push({
        amount: amountRange,
        frequency: 1,
        last_seen: timestamp,
        confidence
      })
    }
  }

  private getAmountRange(amount: number): number {
    // Round to nearest 10000 for grouping
    return Math.round(amount / 10000) * 10000
  }

  private calculateAverageConfidence(data: LearningData): number {
    const allConfidences = [
      ...data.name_patterns.map(p => p.confidence),
      ...data.address_patterns.map(p => p.confidence),
      ...data.transaction_patterns.map(p => p.confidence),
      ...data.amountPatterns.map(p => p.confidence)
    ]
    
    if (allConfidences.length === 0) return 0
    
    const sum = allConfidences.reduce((acc, val) => acc + val, 0)
    return sum / allConfidences.length
  }

  private extractNamePatterns(description: string): string[] {
    const patterns: string[] = []
    
    // Full name patterns
    const fullNameMatches = description.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g)
    if (fullNameMatches) {
      patterns.push(...fullNameMatches)
    }
    
    // Indonesian name patterns
    const indonesianNameMatches = description.match(/\b[A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)?\b/g)
    if (indonesianNameMatches) {
      patterns.push(...indonesianNameMatches)
    }
    
    return patterns.filter(pattern => pattern.length > 2)
  }

  private extractTransactionPatterns(description: string): string[] {
    const patterns: string[] = []
    
    // Extract keywords longer than 3 characters
    const words = description.toLowerCase().split(/\s+/)
    for (const word of words) {
      if (word.length > 3 && !/^\d+$/.test(word)) {
        patterns.push(word)
      }
    }
    
    return patterns
  }

  private async persistLearningData(resident_id: string, data: LearningData): Promise<void> {
    try {
      await (db as any).verificationLearningData.upsert({
        where: { resident_id },
        update: {
          name_patterns: JSON.stringify(data.name_patterns),
          address_patterns: JSON.stringify(data.address_patterns),
          transaction_patterns: JSON.stringify(data.transaction_patterns),
          amountPatterns: JSON.stringify(data.amountPatterns),
          averageConfidence: data.averageConfidence,
          totalVerifications: data.totalVerifications,
          last_updated: data.last_updated
        },
        create: {
          resident_id,
          name_patterns: JSON.stringify(data.name_patterns),
          address_patterns: JSON.stringify(data.address_patterns),
          transaction_patterns: JSON.stringify(data.transaction_patterns),
          amountPatterns: JSON.stringify(data.amountPatterns),
          averageConfidence: data.averageConfidence,
          totalVerifications: data.totalVerifications,
          last_updated: data.last_updated
        }
      })
    } catch (error) {
      console.log('Unable to persist learning data, table may not exist yet')
    }
  }

  private generateInsights(): void {
    this.insights = []
    
    // Generate insights from all learning data
    for (const [resident_id, data] of this.learningData) {
      // Name pattern insights
      for (const pattern of data.name_patterns) {
        if (pattern.frequency >= 3 && pattern.confidence >= 0.7) {
          this.addInsight({
            type: 'NAME_PATTERN',
            pattern: pattern.pattern,
            confidence: pattern.confidence,
            frequency: pattern.frequency,
            last_seen: pattern.last_seen,
            applicableResidentIds: [resident_id]
          })
        }
      }
      
      // Address pattern insights
      for (const pattern of data.address_patterns) {
        if (pattern.frequency >= 2 && pattern.confidence >= 0.8) {
          this.addInsight({
            type: 'ADDRESS_PATTERN',
            pattern: pattern.pattern,
            confidence: pattern.confidence,
            frequency: pattern.frequency,
            last_seen: pattern.last_seen,
            applicableResidentIds: [resident_id]
          })
        }
      }
      
      // Transaction pattern insights
      for (const pattern of data.transaction_patterns) {
        if (pattern.frequency >= 5 && pattern.confidence >= 0.6) {
          this.addInsight({
            type: 'TRANSACTION_PATTERN',
            pattern: pattern.pattern,
            confidence: pattern.confidence,
            frequency: pattern.frequency,
            last_seen: pattern.last_seen,
            applicableResidentIds: [resident_id]
          })
        }
      }
      
      // Amount pattern insights
      for (const pattern of data.amountPatterns) {
        if (pattern.frequency >= 3 && pattern.confidence >= 0.7) {
          this.addInsight({
            type: 'AMOUNT_PATTERN',
            pattern: pattern.amount.toString(),
            confidence: pattern.confidence,
            frequency: pattern.frequency,
            last_seen: pattern.last_seen,
            applicableResidentIds: [resident_id]
          })
        }
      }
    }
    
    // Sort insights by confidence and frequency
    this.insights.sort((a, b) => {
      const aScore = a.confidence * a.frequency
      const bScore = b.confidence * b.frequency
      return bScore - aScore
    })
  }

  private addInsight(insight: LearningInsight): void {
    // Check if similar insight already exists
    const existingInsight = this.insights.find(i => 
      i.type === insight.type && 
      i.pattern === insight.pattern
    )
    
    if (existingInsight) {
      // Merge with existing insight
      existingInsight.confidence = Math.max(existingInsight.confidence, insight.confidence)
      existingInsight.frequency += insight.frequency
      existingInsight.last_seen = insight.last_seen > existingInsight.last_seen ? insight.last_seen : existingInsight.last_seen
      existingInsight.applicableResidentIds = [
        ...new Set([...existingInsight.applicableResidentIds, ...insight.applicableResidentIds])
      ]
    } else {
      this.insights.push(insight)
    }
  }

  /**
   * Learn from a new verification result
   */
  async learnFromVerification(verification: any): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const { mutation, action, confidence } = verification
    
    if (action === 'MANUAL_CONFIRM' && mutation.matched_resident_id) {
      await this.processHistoricalVerification(verification)
      
      // Regenerate insights after learning
      this.generateInsights()
    }
  }

  /**
   * Get learning data for a specific resident
   */
  getLearningData(resident_id: string): LearningData | null {
    return this.learningData.get(resident_id) || null
  }

  /**
   * Get all insights
   */
  getInsights(type?: LearningInsight['type']): LearningInsight[] {
    if (type) {
      return this.insights.filter(insight => insight.type === type)
    }
    return this.insights
  }

  /**
   * Get top insights by confidence and frequency
   */
  getTopInsights(limit: number = 10, type?: LearningInsight['type']): LearningInsight[] {
    const insights = type ? this.getInsights(type) : this.insights
    return insights.slice(0, limit)
  }

  /**
   * Find similar residents based on learning patterns
   */
  findSimilarResidents(resident_id: string, limit: number = 5): Array<{
    resident_id: string
    similarity: number
    commonPatterns: string[]
  }> {
    const targetData = this.learningData.get(resident_id)
    if (!targetData) return []

    const similarities: Array<{
      resident_id: string
      similarity: number
      commonPatterns: string[]
    }> = []

    for (const [otherResidentId, otherData] of this.learningData) {
      if (otherResidentId === resident_id) continue

      const similarity = this.calculateSimilarity(targetData, otherData)
      if (similarity > 0.3) { // Only include meaningful similarities
        const commonPatterns = this.findCommonPatterns(targetData, otherData)
        
        similarities.push({
          resident_id: otherResidentId,
          similarity,
          commonPatterns
        })
      }
    }

    // Sort by similarity and return top results
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  private calculateSimilarity(data1: LearningData, data2: LearningData): number {
    let similarity = 0
    let totalFactors = 0

    // Name pattern similarity
    const nameSimilarity = this.calculatePatternSimilarity(
      data1.name_patterns.map(p => p.pattern),
      data2.name_patterns.map(p => p.pattern)
    )
    similarity += nameSimilarity
    totalFactors += 1

    // Address pattern similarity
    const addressSimilarity = this.calculatePatternSimilarity(
      data1.address_patterns.map(p => p.pattern),
      data2.address_patterns.map(p => p.pattern)
    )
    similarity += addressSimilarity
    totalFactors += 1

    // Transaction pattern similarity
    const transactionSimilarity = this.calculatePatternSimilarity(
      data1.transaction_patterns.map(p => p.pattern),
      data2.transaction_patterns.map(p => p.pattern)
    )
    similarity += transactionSimilarity
    totalFactors += 1

    // Amount pattern similarity
    const amountSimilarity = this.calculatePatternSimilarity(
      data1.amountPatterns.map(p => p.amount.toString()),
      data2.amountPatterns.map(p => p.amount.toString())
    )
    similarity += amountSimilarity
    totalFactors += 1

    return totalFactors > 0 ? similarity / totalFactors : 0
  }

  private calculatePatternSimilarity(patterns1: string[], patterns2: string[]): number {
    if (patterns1.length === 0 || patterns2.length === 0) return 0

    const intersection = patterns1.filter(p => patterns2.includes(p))
    const union = [...new Set([...patterns1, ...patterns2])]

    return intersection.length / union.length
  }

  private findCommonPatterns(data1: LearningData, data2: LearningData): string[] {
    const commonPatterns: string[] = []

    // Common name patterns
    const namePatterns1 = data1.name_patterns.map(p => p.pattern)
    const namePatterns2 = data2.name_patterns.map(p => p.pattern)
    commonPatterns.push(...namePatterns1.filter(p => namePatterns2.includes(p)))

    // Common address patterns
    const addressPatterns1 = data1.address_patterns.map(p => p.pattern)
    const addressPatterns2 = data2.address_patterns.map(p => p.pattern)
    commonPatterns.push(...addressPatterns1.filter(p => addressPatterns2.includes(p)))

    // Common transaction patterns
    const transactionPatterns1 = data1.transaction_patterns.map(p => p.pattern)
    const transactionPatterns2 = data2.transaction_patterns.map(p => p.pattern)
    commonPatterns.push(...transactionPatterns1.filter(p => transactionPatterns2.includes(p)))

    return [...new Set(commonPatterns)]
  }

  /**
   * Get statistics about the learning system
   */
  getStatistics(): {
    totalResidents: number
    totalPatterns: number
    averageConfidence: number
    topInsights: LearningInsight[]
    learningCoverage: number
  } {
    const totalResidents = this.learningData.size
    const totalPatterns = Array.from(this.learningData.values()).reduce(
      (sum, data) => sum + 
        data.name_patterns.length + 
        data.address_patterns.length + 
        data.transaction_patterns.length + 
        data.amountPatterns.length,
      0
    )
    
    const averageConfidence = Array.from(this.learningData.values()).reduce(
      (sum, data) => sum + data.averageConfidence,
      0
    ) / (totalResidents || 1)
    
    const topInsights = this.getTopInsights(5)
    
    // Calculate learning coverage (percentage of residents with meaningful learning data)
    const residentsWithData = Array.from(this.learningData.values()).filter(
      data => data.totalVerifications >= 3
    ).length
    const learningCoverage = totalResidents > 0 ? residentsWithData / totalResidents : 0

    return {
      totalResidents,
      totalPatterns,
      averageConfidence,
      topInsights,
      learningCoverage
    }
  }
}

/**
 * Utility function to create a verification learning system
 */
export function createVerificationLearningSystem(): VerificationLearningSystem {
  return new VerificationLearningSystem()
}