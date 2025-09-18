/**
 * Manual Verification Service for Unmatched Transactions
 * Provides interface and tools for manual verification of bank mutations
 */

import { db } from '@/lib/db'
import { FuzzyNameMatcher } from './fuzzy-name-matching'
import { AddressPatternMatcher } from './address-pattern-matching'
import { IPLIdentifier } from './ipl-identifier'
import { VerificationLearningSystem } from './verification-learning-system'
import { RuleBasedMatchingEngine } from './rule-based-matching-engine'
import { AIVerificationService } from './ai-verification-service'

export interface ManualVerificationCandidate {
  id: string
  transaction: {
    id: string
    date: string
    description: string
    amount: number
    balance?: number
    reference?: string
  }
  suggestedMatches: Array<{
    resident_id: string
    confidence: number
    strategy: string
    factors: string[]
    source: 'RULE_BASED' | 'AI' | 'LEARNING' | 'HISTORICAL'
  }>
  requiresReview: boolean
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  created_at: Date
}

export interface ManualVerificationOptions {
  maxSuggestions?: number
  includeAI?: boolean
  includeHistorical?: boolean
  includeLearning?: boolean
  autoRefresh?: boolean
}

export interface VerificationAction {
  type: 'MATCH' | 'UNMATCH' | 'SKIP' | 'FLAG' | 'BULK_MATCH' | 'BULK_UNMATCH'
  mutation_id: string
  resident_id?: string
  payment_id?: string
  confidence?: number
  notes?: string
  tags?: string[]
}

export interface VerificationSession {
  id: string
  userId: string
  startTime: Date
  endTime?: Date
  totalProcessed: number
  matched: number
  unmatched: number
  skipped: number
  flagged: number
  averageTimePerTransaction: number
}

export class ManualVerificationService {
  private fuzzyNameMatcher: FuzzyNameMatcher | null = null
  private addressPatternMatcher: AddressPatternMatcher | null = null
  private iplIdentifier: IPLIdentifier | null = null
  private learningSystem: VerificationLearningSystem | null = null
  private ruleBasedEngine: RuleBasedMatchingEngine | null = null
  private aiService: AIVerificationService | null = null
  private isInitialized = false

  constructor() {
    // Initialize will be called explicitly
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Initialize helper components
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
    this.addressPatternMatcher = new AddressPatternMatcher()
    this.iplIdentifier = new IPLIdentifier()
    this.learningSystem = new VerificationLearningSystem()
    await this.learningSystem.initialize()

    this.ruleBasedEngine = new RuleBasedMatchingEngine()
    await this.ruleBasedEngine.initialize()

    this.aiService = new AIVerificationService()
    await this.aiService.initialize()

    this.isInitialized = true
  }

  /**
   * Get transactions that require manual verification
   */
  async getVerificationCandidates(
    options: ManualVerificationOptions = {}
  ): Promise<ManualVerificationCandidate[]> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    // Get unmatched or low-confidence transactions
    const unmatchedMutations = await (db as any).bankMutation.findMany({
      where: {
        OR: [
          { matched_resident_id: null },
          { is_verified: false },
          { match_score: { lt: 0.7 } }
        ]
      },
      orderBy: [
        { amount: 'desc' },
        { transaction_date: 'desc' }
      ],
      take: 50 // Limit for performance
    })

    const candidates: ManualVerificationCandidate[] = []

    for (const mutation of unmatchedMutations) {
      const suggestedMatches = await this.getSuggestedMatches(mutation, options)
      
      // Determine priority based on amount and match confidence
      const priority = this.determinePriority(mutation, suggestedMatches)
      
      candidates.push({
        id: mutation.id,
        transaction: {
          id: mutation.id,
          date: mutation.transaction_date.toISOString(),
          description: mutation.description,
          amount: mutation.amount,
          balance: mutation.balance,
          reference: mutation.reference_number
        },
        suggestedMatches,
        requiresReview: suggestedMatches.length === 0 || 
                         suggestedMatches.every(m => m.confidence < 0.7),
        priority,
        created_at: mutation.created_at
      })
    }

    return candidates
  }

  /**
   * Get suggested matches for a transaction
   */
  private async getSuggestedMatches(
    mutation: any,
    options: ManualVerificationOptions
  ): Promise<Array<{
    resident_id: string
    confidence: number
    strategy: string
    factors: string[]
    source: 'RULE_BASED' | 'AI' | 'LEARNING' | 'HISTORICAL'
  }>> {
    const matches: Array<{
      resident_id: string
      confidence: number
      strategy: string
      factors: string[]
      source: 'RULE_BASED' | 'AI' | 'LEARNING' | 'HISTORICAL'
    }> = []

    // Get residents for matching
    const residents = await db.resident.findMany({
      where: { is_active: true }
    })

    // 1. Rule-based matching
    if (this.ruleBasedEngine) {
      try {
        const ruleResult = await this.ruleBasedEngine.findBestMatch(mutation, residents)
        if (ruleResult) {
          matches.push({
            resident_id: ruleResult.resident_id!,
            confidence: ruleResult.confidence,
            strategy: ruleResult.strategy,
            factors: ruleResult.factors,
            source: 'RULE_BASED'
          })
        }
      } catch (error) {
        console.error('Rule-based matching failed:', error)
      }
    }

    // 2. AI matching (if enabled and available)
    if (options.includeAI && this.aiService?.isAvailable()) {
      try {
        const aiRequest = {
          transaction: {
            id: mutation.id,
            date: mutation.transaction_date.toISOString(),
            description: mutation.description,
            amount: mutation.amount,
            balance: mutation.balance,
            reference: mutation.reference_number
          },
          residents,
          context: {
            ruleBasedResults: matches
              .filter(m => m.source === 'RULE_BASED')
              .map(m => ({
                resident_id: m.resident_id,
                confidence: m.confidence,
                strategy: m.strategy,
                factors: m.factors
              }))
          },
          options: {
            maxSuggestions: 3,
            minConfidence: 0.5
          }
        }

        // Transform residents to match AI service interface
        const transformedResidents = residents.map(resident => ({
          id: resident.id,
          name: resident.name,
          blok: resident.blok || undefined,
          house_number: resident.house_number || undefined,
          payment_index: resident.payment_index || undefined,
          rt: resident.rt,
          rw: resident.rw,
          phone: resident.phone,
          email: resident.email || undefined
        }))

        const aiRequestWithTransformedResidents = {
          ...aiRequest,
          residents: transformedResidents
        }

        const aiResponse = await this.aiService.verifyTransaction(aiRequestWithTransformedResidents)
        
        for (const match of aiResponse.matches) {
          matches.push({
            resident_id: match.resident_id,
            confidence: match.confidence,
            strategy: 'AI_ANALYSIS',
            factors: match.factors,
            source: 'AI'
          })
        }
      } catch (error) {
        console.error('AI matching failed:', error)
      }
    }

    // 3. Learning-based matching (if enabled)
    if (options.includeLearning && this.learningSystem) {
      try {
        // This would use learning patterns to suggest matches
        // For now, this is a placeholder implementation
        const learningMatches = await this.getLearningBasedMatches(mutation, residents)
        
        for (const match of learningMatches) {
          matches.push({
            resident_id: match.resident_id,
            confidence: match.confidence,
            strategy: 'LEARNING_PATTERN',
            factors: match.factors,
            source: 'LEARNING'
          })
        }
      } catch (error) {
        console.error('Learning-based matching failed:', error)
      }
    }

    // 4. Historical pattern matching (if enabled)
    if (options.includeHistorical) {
      try {
        const historicalMatches = await this.getHistoricalMatches(mutation, residents)
        
        for (const match of historicalMatches) {
          matches.push({
            resident_id: match.resident_id,
            confidence: match.confidence,
            strategy: 'HISTORICAL_PATTERN',
            factors: match.factors,
            source: 'HISTORICAL'
          })
        }
      } catch (error) {
        console.error('Historical matching failed:', error)
      }
    }

    // Sort by confidence and limit results
    const maxSuggestions = options.maxSuggestions || 5
    return matches
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions)
  }

  /**
   * Get learning-based matches (placeholder implementation)
   */
  private async getLearningBasedMatches(
    mutation: any,
    residents: any[]
  ): Promise<Array<{
    resident_id: string
    confidence: number
    factors: string[]
  }>> {
    if (!this.learningSystem) return []

    // This would use the learning system to find matches
    // For now, return empty array as placeholder
    return []
  }

  /**
   * Get historical matches (placeholder implementation)
   */
  private async getHistoricalMatches(
    mutation: any,
    residents: any[]
  ): Promise<Array<{
    resident_id: string
    confidence: number
    factors: string[]
  }>> {
    // This would find matches based on historical verification patterns
    // For now, return empty array as placeholder
    return []
  }

  /**
   * Determine priority of verification candidate
   */
  private determinePriority(
    mutation: any,
    matches: Array<{
      resident_id: string
      confidence: number
      strategy: string
      factors: string[]
      source: string
    }>
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    // High priority for large amounts or no matches
    if (mutation.amount > 500000) return 'HIGH'
    if (matches.length === 0) return 'HIGH'
    
    // Medium priority for medium amounts or low confidence matches
    if (mutation.amount > 200000) return 'MEDIUM'
    if (matches.every(m => m.confidence < 0.5)) return 'MEDIUM'
    
    // Low priority for small amounts with some confidence
    return 'LOW'
  }

  /**
   * Execute a verification action
   */
  async executeVerificationAction(
    action: VerificationAction,
    userId: string
  ): Promise<{
    success: boolean
    mutation_id: string
    error?: string
  }> {
    try {
      switch (action.type) {
        case 'MATCH':
          return await this.executeMatchAction(action, userId)
        
        case 'UNMATCH':
          return await this.executeUnmatchAction(action, userId)
        
        case 'SKIP':
          return await this.executeSkipAction(action, userId)
        
        case 'FLAG':
          return await this.executeFlagAction(action, userId)
        
        case 'BULK_MATCH':
          return await this.executeBulkMatchAction(action, userId)
        
        case 'BULK_UNMATCH':
          return await this.executeBulkUnmatchAction(action, userId)
        
        default:
          return {
            success: false,
            mutation_id: action.mutation_id,
            error: 'Unknown action type'
          }
      }
    } catch (error) {
      console.error('Verification action failed:', error)
      
      return {
        success: false,
        mutation_id: action.mutation_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Execute match action
   */
  private async executeMatchAction(
    action: VerificationAction,
    userId: string
  ): Promise<{
    success: boolean
    mutation_id: string
    error?: string
  }> {
    if (!action.resident_id) {
      return {
        success: false,
        mutation_id: action.mutation_id,
        error: 'Resident ID is required for match action'
      }
    }

    // Update bank mutation
    await (db as any).bankMutation.update({
      where: { id: action.mutation_id },
      data: {
        matched_resident_id: action.resident_id,
        matched_payment_id: action.payment_id,
        match_score: action.confidence || 0.8,
        is_verified: true,
        verified_at: new Date(),
        verified_by: userId
      }
    })

    // Record verification history
    await (db as any).bankMutationVerification.create({
      data: {
        mutation_id: action.mutation_id,
        action: 'MANUAL_CONFIRM',
        confidence: action.confidence || 0.8,
        verified_by: userId,
        notes: action.notes || 'Manual verification match',
        new_matched_payment_id: action.payment_id
      }
    })

    // Update learning system
    if (this.learningSystem) {
      const mutation = await (db as any).bankMutation.findUnique({
        where: { id: action.mutation_id }
      })

      if (mutation) {
        await this.learningSystem.learnFromVerification({
          mutation,
          action: 'MANUAL_CONFIRM',
          confidence: action.confidence || 0.8
        })
      }
    }

    return {
      success: true,
      mutation_id: action.mutation_id
    }
  }

  /**
   * Execute unmatch action
   */
  private async executeUnmatchAction(
    action: VerificationAction,
    userId: string
  ): Promise<{
    success: boolean
    mutation_id: string
    error?: string
  }> {
    // Get current match info before unmatching
    const mutation = await (db as any).bankMutation.findUnique({
      where: { id: action.mutation_id }
    })

    // Update bank mutation
    await (db as any).bankMutation.update({
      where: { id: action.mutation_id },
      data: {
        matched_resident_id: null,
        matched_payment_id: null,
        match_score: 0,
        is_verified: false,
        verified_at: null,
        verified_by: null
      }
    })

    // Record verification history
    await (db as any).bankMutationVerification.create({
      data: {
        mutation_id: action.mutation_id,
        action: 'MANUAL_OVERRIDE',
        confidence: 0,
        verified_by: userId,
        notes: action.notes || 'Manual verification unmatch',
        previous_matched_payment_id: mutation?.matched_payment_id
      }
    })

    return {
      success: true,
      mutation_id: action.mutation_id
    }
  }

  /**
   * Execute skip action
   */
  private async executeSkipAction(
    action: VerificationAction,
    userId: string
  ): Promise<{
    success: boolean
    mutation_id: string
    error?: string
  }> {
    // Record verification history
    await (db as any).bankMutationVerification.create({
      data: {
        mutation_id: action.mutation_id,
        action: 'MANUAL_SKIP',
        confidence: 0,
        verified_by: userId,
        notes: action.notes || 'Manual verification skip'
      }
    })

    return {
      success: true,
      mutation_id: action.mutation_id
    }
  }

  /**
   * Execute flag action
   */
  private async executeFlagAction(
    action: VerificationAction,
    userId: string
  ): Promise<{
    success: boolean
    mutation_id: string
    error?: string
  }> {
    // Record verification history
    await (db as any).bankMutationVerification.create({
      data: {
        mutation_id: action.mutation_id,
        action: 'MANUAL_FLAG',
        confidence: 0,
        verified_by: userId,
        notes: action.notes || 'Manual verification flag'
      }
    })

    return {
      success: true,
      mutation_id: action.mutation_id
    }
  }

  /**
   * Execute bulk match action (placeholder)
   */
  private async executeBulkMatchAction(
    action: VerificationAction,
    userId: string
  ): Promise<{
    success: boolean
    mutation_id: string
    error?: string
  }> {
    // Bulk actions would be implemented here
    return {
      success: false,
      mutation_id: action.mutation_id,
      error: 'Bulk actions not yet implemented'
    }
  }

  /**
   * Execute bulk unmatch action (placeholder)
   */
  private async executeBulkUnmatchAction(
    action: VerificationAction,
    userId: string
  ): Promise<{
    success: boolean
    mutation_id: string
    error?: string
  }> {
    // Bulk actions would be implemented here
    return {
      success: false,
      mutation_id: action.mutation_id,
      error: 'Bulk actions not yet implemented'
    }
  }

  /**
   * Start a verification session
   */
  async startVerificationSession(userId: string): Promise<VerificationSession> {
    const session: VerificationSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      startTime: new Date(),
      totalProcessed: 0,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      flagged: 0,
      averageTimePerTransaction: 0
    }

    // Store session in database or cache
    // For now, we'll just return it
    
    return session
  }

  /**
   * End a verification session and update statistics
   */
  async endVerificationSession(session: VerificationSession): Promise<VerificationSession> {
    session.endTime = new Date()
    
    // Calculate average time per transaction
    const duration = session.endTime.getTime() - session.startTime.getTime()
    if (session.totalProcessed > 0) {
      session.averageTimePerTransaction = duration / session.totalProcessed
    }

    // Store session statistics
    // This would be saved to database in a real implementation
    
    return session
  }

  /**
   * Get verification statistics
   */
  async getVerificationStatistics(): Promise<{
    totalUnmatched: number
    highPriority: number
    mediumPriority: number
    lowPriority: number
    averageConfidence: number
    recentActivity: Array<{
      date: string
      processed: number
      matched: number
    }>
  }> {
    // Get unmatched transactions count by priority
    const unmatchedMutations = await (db as any).bankMutation.findMany({
      where: {
        OR: [
          { matched_resident_id: null },
          { is_verified: false },
          { match_score: { lt: 0.7 } }
        ]
      },
      select: {
        id: true,
        amount: true,
        match_score: true,
        created_at: true
      }
    })

    const totalUnmatched = unmatchedMutations.length
    let highPriority = 0
    let mediumPriority = 0
    let lowPriority = 0
    let totalConfidence = 0
    let confidenceCount = 0

    for (const mutation of unmatchedMutations) {
      // Determine priority
      if (mutation.amount > 500000 || mutation.match_score === null) {
        highPriority++
      } else if (mutation.amount > 200000 || mutation.match_score < 0.5) {
        mediumPriority++
      } else {
        lowPriority++
      }

      // Track confidence
      if (mutation.match_score !== null) {
        totalConfidence += mutation.match_score
        confidenceCount++
      }
    }

    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const recentVerifications = await (db as any).bankMutationVerification.findMany({
      where: {
        created_at: { gte: sevenDaysAgo },
        verified_by: { not: 'SYSTEM' }
      },
      select: {
        created_at: true,
        action: true
      }
    })

    // Group by date
    const activityByDate: Record<string, { processed: number; matched: number }> = {}
    
    for (const verification of recentVerifications) {
      const date = verification.created_at.toISOString().split('T')[0]
      
      if (!activityByDate[date]) {
        activityByDate[date] = { processed: 0, matched: 0 }
      }
      
      activityByDate[date].processed++
      
      if (verification.action === 'MANUAL_CONFIRM') {
        activityByDate[date].matched++
      }
    }

    const recentActivity = Object.entries(activityByDate).map(([date, stats]) => ({
      date,
      processed: stats.processed,
      matched: stats.matched
    }))

    return {
      totalUnmatched,
      highPriority,
      mediumPriority,
      lowPriority,
      averageConfidence,
      recentActivity
    }
  }

  /**
   * Get verification history for a transaction
   */
  async getVerificationHistory(mutation_id: string): Promise<Array<{
    id: string
    action: string
    confidence: number
    verified_by: string
    notes: string
    created_at: Date
  }>> {
    const history = await (db as any).bankMutationVerification.findMany({
      where: { mutation_id },
      orderBy: { created_at: 'desc' }
    })

    return history.map((record: any) => ({
      id: record.id,
      action: record.action,
      confidence: record.confidence,
      verified_by: record.verified_by,
      notes: record.notes || '',
      created_at: record.created_at
    }))
  }
}

/**
 * Utility function to create a manual verification service
 */
export function createManualVerificationService(): ManualVerificationService {
  return new ManualVerificationService()
}