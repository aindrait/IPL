/**
 * Verification Dashboard Service
 * Provides comprehensive statistics and management features for the verification system
 */

import { db } from '@/lib/db'
import { EnhancedVerificationEngine } from './enhanced-verification-engine'
import { VerificationLearningSystem } from './verification-learning-system'
import { RuleBasedMatchingEngine } from './rule-based-matching-engine'
import { AIVerificationService } from './ai-verification-service'
import { ManualVerificationService } from './manual-verification-service'

export interface DashboardOverview {
  totalTransactions: number
  matchedTransactions: number
  unmatchedTransactions: number
  autoVerifiedTransactions: number
  manuallyVerifiedTransactions: number
  verificationRate: number
  averageConfidence: number
  totalAmount: number
  last_updated: Date
}

export interface VerificationTrend {
  date: string
  uploaded: number
  matched: number
  verified: number
  confidence: number
}

export interface VerificationStats {
  byStrategy: Array<{
    strategy: string
    count: number
    percentage: number
    averageConfidence: number
  }>
  byConfidence: Array<{
    range: string
    count: number
    percentage: number
  }>
  byMonth: Array<{
    month: string
    uploaded: number
    matched: number
    verified: number
  }>
  byResident: Array<{
    resident_id: string
    residentName: string
    blok?: string
    house_number?: string
    transactionCount: number
    totalAmount: number
    averageConfidence: number
  }>
}

export interface SystemHealth {
  status: 'HEALTHY' | 'WARNING' | 'ERROR'
  components: Array<{
    name: string
    status: 'HEALTHY' | 'WARNING' | 'ERROR'
    message: string
    lastChecked: Date
  }>
  performance: {
    averageProcessingTime: number
    maxProcessingTime: number
    recentProcessingTimes: number[]
  }
}

export interface LearningInsight {
  type: 'NAME_PATTERN' | 'ADDRESS_PATTERN' | 'TRANSACTION_PATTERN' | 'AMOUNT_PATTERN'
  pattern: string
  confidence: number
  frequency: number
  applicableResidentIds: string[]
  impact: 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ManagementAction {
  id: string
  type: 'BULK_VERIFY' | 'BULK_UNVERIFY' | 'RECALCULATE_MATCHES' | 'EXPORT_DATA' | 'IMPORT_DATA'
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  progress: number
  totalItems: number
  processedItems: number
  created_at: Date
  completedAt?: Date
  error?: string
  userId: string
}

export class VerificationDashboardService {
  private verificationEngine: EnhancedVerificationEngine | null = null
  private learningSystem: VerificationLearningSystem | null = null
  private ruleBasedEngine: RuleBasedMatchingEngine | null = null
  private aiService: AIVerificationService | null = null
  private manualService: ManualVerificationService | null = null
  private isInitialized = false

  constructor() {
    // Initialize will be called explicitly
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Initialize all services
    this.verificationEngine = new EnhancedVerificationEngine()
    await this.verificationEngine.initialize()

    this.learningSystem = new VerificationLearningSystem()
    await this.learningSystem.initialize()

    this.ruleBasedEngine = new RuleBasedMatchingEngine()
    await this.ruleBasedEngine.initialize()

    this.aiService = new AIVerificationService()
    await this.aiService.initialize()

    this.manualService = new ManualVerificationService()
    await this.manualService.initialize()

    this.isInitialized = true
  }

  /**
   * Get dashboard overview statistics
   */
  async getOverview(): Promise<DashboardOverview> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    // Get basic statistics
    const [
      totalTransactions,
      matchedTransactions,
      verifiedTransactions,
      autoVerifiedTransactions,
      manuallyVerifiedTransactions,
      totalAmountResult,
      lastUploadResult
    ] = await Promise.all([
      (db as any).bankMutation.count(),
      (db as any).bankMutation.count({ where: { matched_resident_id: { not: null } } }),
      (db as any).bankMutation.count({ where: { is_verified: true } }),
      (db as any).bankMutation.count({ 
        where: { 
          is_verified: true, 
          verified_by: 'SYSTEM' 
        } 
      }),
      (db as any).bankMutation.count({ 
        where: { 
          is_verified: true, 
          verified_by: { not: 'SYSTEM' } 
        } 
      }),
      (db as any).bankMutation.aggregate({ _sum: { amount: true } }),
      (db as any).bankMutation.findFirst({
        orderBy: { created_at: 'desc' },
        select: { created_at: true }
      })
    ])

    const unmatchedTransactions = totalTransactions - matchedTransactions
    const verificationRate = totalTransactions > 0 ? verifiedTransactions / totalTransactions : 0

    // Calculate average confidence
    const confidenceResult = await (db as any).bankMutation.aggregate({
      _avg: { match_score: true },
      where: { matched_resident_id: { not: null } }
    })

    return {
      totalTransactions,
      matchedTransactions,
      unmatchedTransactions,
      autoVerifiedTransactions,
      manuallyVerifiedTransactions,
      verificationRate,
      averageConfidence: confidenceResult._avg.match_score || 0,
      totalAmount: totalAmountResult._sum.amount || 0,
      last_updated: lastUploadResult?.created_at || new Date()
    }
  }

  /**
   * Get verification trends over time
   */
  async getTrends(days: number = 30): Promise<VerificationTrend[]> {
    const start_date = new Date()
    start_date.setDate(start_date.getDate() - days)

    // Get daily statistics
    const dailyStats = await (db as any).bankMutation.groupBy({
      by: ['transaction_date'],
      where: {
        transaction_date: { gte: start_date }
      },
      _count: {
        id: true
      },
      _sum: {
        amount: true
      },
      orderBy: {
        transaction_date: 'asc'
      }
    })

    // Get matched transactions by date
    const matchedStats = await (db as any).bankMutation.groupBy({
      by: ['transaction_date'],
      where: {
        transaction_date: { gte: start_date },
        matched_resident_id: { not: null }
      },
      _count: {
        id: true
      },
      orderBy: {
        transaction_date: 'asc'
      }
    })

    // Get verified transactions by date
    const verifiedStats = await (db as any).bankMutation.groupBy({
      by: ['transaction_date'],
      where: {
        transaction_date: { gte: start_date },
        is_verified: true
      },
      _count: {
        id: true
      },
      _avg: {
        match_score: true
      },
      orderBy: {
        transaction_date: 'asc'
      }
    })

    // Combine data into trends
    const trends: VerificationTrend[] = []

    for (let i = 0; i < days; i++) {
      const date = new Date(start_date)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      const daily = dailyStats.find(s => 
        new Date(s.transaction_date).toISOString().split('T')[0] === dateStr
      )
      
      const matched = matchedStats.find(s => 
        new Date(s.transaction_date).toISOString().split('T')[0] === dateStr
      )
      
      const verified = verifiedStats.find(s => 
        new Date(s.transaction_date).toISOString().split('T')[0] === dateStr
      )

      trends.push({
        date: dateStr,
        uploaded: daily?._count.id || 0,
        matched: matched?._count.id || 0,
        verified: verified?._count.id || 0,
        confidence: verified?._avg.match_score || 0
      })
    }

    return trends
  }

  /**
   * Get detailed verification statistics
   */
  async getStatistics(): Promise<VerificationStats> {
    // Get statistics by strategy
    const strategyStats = await (db as any).bankMutation.groupBy({
      by: ['matching_strategy'],
      where: { matched_resident_id: { not: null } },
      _count: {
        id: true
      },
      _avg: {
        match_score: true
      }
    })

    const totalMatched = strategyStats.reduce((sum: number, stat: any) => sum + stat._count.id, 0)

    const byStrategy = strategyStats.map((stat: any) => ({
      strategy: stat.matching_strategy || 'UNKNOWN',
      count: stat._count.id,
      percentage: totalMatched > 0 ? (stat._count.id / totalMatched) * 100 : 0,
      averageConfidence: stat._avg.match_score || 0
    }))

    // Get statistics by confidence range
    const confidenceRanges = [
      { range: '0.9-1.0', min: 0.9, max: 1.0 },
      { range: '0.8-0.9', min: 0.8, max: 0.9 },
      { range: '0.7-0.8', min: 0.7, max: 0.8 },
      { range: '0.6-0.7', min: 0.6, max: 0.7 },
      { range: '0.5-0.6', min: 0.5, max: 0.6 },
      { range: '<0.5', min: 0, max: 0.5 }
    ]

    const byConfidence = await Promise.all(
      confidenceRanges.map(async (range) => {
        const count = await (db as any).bankMutation.count({
          where: {
            match_score: { gte: range.min, lt: range.max }
          }
        })

        const total = await (db as any).bankMutation.count()

        return {
          range: range.range,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0
        }
      })
    )

    // Get statistics by month
    const currentYear = new Date().getFullYear()
    const monthlyStats: Array<{
      month: string
      uploaded: number
      matched: number
      verified: number
    }> = []

    for (let month = 1; month <= 12; month++) {
      const start_date = new Date(currentYear, month - 1, 1)
      const end_date = new Date(currentYear, month, 0)

      const [uploaded, matched, verified] = await Promise.all([
        (db as any).bankMutation.count({
          where: {
            transaction_date: { gte: start_date, lt: end_date }
          }
        }),
        (db as any).bankMutation.count({
          where: {
            transaction_date: { gte: start_date, lt: end_date },
            matched_resident_id: { not: null }
          }
        }),
        (db as any).bankMutation.count({
          where: {
            transaction_date: { gte: start_date, lt: end_date },
            is_verified: true
          }
        })
      ])

      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]

      monthlyStats.push({
        month: monthNames[month - 1],
        uploaded,
        matched,
        verified
      })
    }

    // Get statistics by resident
    const residentStats = await (db as any).bankMutation.groupBy({
      by: ['matched_resident_id'],
      where: { matched_resident_id: { not: null } },
      _count: {
        id: true
      },
      _sum: {
        amount: true
      },
      _avg: {
        match_score: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 20 // Top 20 residents
    })

    const residentIds = residentStats.map((stat: any) => stat.matched_resident_id)

    const residents = await db.resident.findMany({
      where: { id: { in: residentIds } }
    })

    const byResident = residentStats.map((stat: any) => {
      const resident = residents.find(r => r.id === stat.matched_resident_id)
      
      return {
        resident_id: stat.matched_resident_id,
        residentName: resident?.name || 'Unknown',
        blok: resident?.blok,
        house_number: resident?.house_number,
        transactionCount: stat._count.id,
        totalAmount: stat._sum.amount || 0,
        averageConfidence: stat._avg.match_score || 0
      }
    })

    return {
      byStrategy,
      byConfidence,
      byMonth: monthlyStats,
      byResident
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const components: Array<{
      name: string
      status: 'HEALTHY' | 'WARNING' | 'ERROR'
      message: string
      lastChecked: Date
    }> = []

    // Check database connectivity
    try {
      await (db as any).resident.findFirst({ take: 1 })
      components.push({
        name: 'Database',
        status: 'HEALTHY',
        message: 'Database connection is healthy',
        lastChecked: new Date()
      })
    } catch (error) {
      components.push({
        name: 'Database',
        status: 'ERROR',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      })
    }

    // Check AI service
    if (this.aiService) {
      try {
        const aiHealth = await this.aiService.testConnectivity()
        components.push({
          name: 'AI Service',
          status: aiHealth.success ? 'HEALTHY' : 'WARNING',
          message: aiHealth.message,
          lastChecked: new Date()
        })
      } catch (error) {
        components.push({
          name: 'AI Service',
          status: 'WARNING',
          message: `AI service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date()
        })
      }
    }

    // Check learning system
    if (this.learningSystem) {
      try {
        const stats = this.learningSystem.getStatistics()
        components.push({
          name: 'Learning System',
          status: 'HEALTHY',
          message: `Learning system is active with ${stats.totalResidents} residents and ${stats.totalPatterns} patterns`,
          lastChecked: new Date()
        })
      } catch (error) {
        components.push({
          name: 'Learning System',
          status: 'WARNING',
          message: `Learning system check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date()
        })
      }
    }

    // Check rule-based engine
    if (this.ruleBasedEngine) {
      try {
        const stats = this.ruleBasedEngine.getStatistics()
        components.push({
          name: 'Rule Engine',
          status: 'HEALTHY',
          message: `Rule engine is active with ${stats.totalRules} rules (${stats.enabledRules} enabled)`,
          lastChecked: new Date()
        })
      } catch (error) {
        components.push({
          name: 'Rule Engine',
          status: 'WARNING',
          message: `Rule engine check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          lastChecked: new Date()
        })
      }
    }

    // Determine overall status
    const errorCount = components.filter(c => c.status === 'ERROR').length
    const warningCount = components.filter(c => c.status === 'WARNING').length

    let overallStatus: 'HEALTHY' | 'WARNING' | 'ERROR' = 'HEALTHY'
    if (errorCount > 0) {
      overallStatus = 'ERROR'
    } else if (warningCount > 0) {
      overallStatus = 'WARNING'
    }

    // Get performance metrics (placeholder implementation)
    const performance = {
      averageProcessingTime: 1.2, // seconds
      maxProcessingTime: 3.5, // seconds
      recentProcessingTimes: [1.1, 1.3, 0.9, 1.5, 1.2, 1.0, 1.4]
    }

    return {
      status: overallStatus,
      components,
      performance
    }
  }

  /**
   * Get learning insights
   */
  async getLearningInsights(): Promise<LearningInsight[]> {
    if (!this.learningSystem) {
      return []
    }

    const insights = this.learningSystem.getTopInsights(20)
    
    return insights.map(insight => {
      // Determine impact based on confidence and frequency
      let impact: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
      
      if (insight.confidence >= 0.8 && insight.frequency >= 5) {
        impact = 'HIGH'
      } else if (insight.confidence >= 0.6 && insight.frequency >= 3) {
        impact = 'MEDIUM'
      }

      return {
        type: insight.type,
        pattern: insight.pattern,
        confidence: insight.confidence,
        frequency: insight.frequency,
        applicableResidentIds: insight.applicableResidentIds,
        impact
      }
    })
  }

  /**
   * Get management actions
   */
  async getManagementActions(): Promise<ManagementAction[]> {
    // This would retrieve management actions from a database table
    // For now, return empty array as placeholder
    return []
  }

  /**
   * Create a new management action
   */
  async createManagementAction(
    action: Omit<ManagementAction, 'id' | 'status' | 'progress' | 'created_at'>
  ): Promise<ManagementAction> {
    // This would create a management action in the database
    // For now, return a placeholder
    return {
      id: `action_${Date.now()}`,
      status: 'PENDING',
      progress: 0,
      created_at: new Date(),
      ...action
    }
  }

  /**
   * Execute a management action
   */
  async executeManagementAction(actionId: string): Promise<void> {
    // This would execute a management action
    // Implementation would depend on the action type
    console.log(`Executing management action: ${actionId}`)
  }

  /**
   * Export verification data
   */
  async exportData(options: {
    format: 'CSV' | 'JSON' | 'EXCEL'
    dateRange?: { start: Date; end: Date }
    includeUnmatched?: boolean
  }): Promise<string> {
    // This would export verification data in the specified format
    // For now, return a placeholder
    return JSON.stringify({ message: 'Export functionality would be implemented here' })
  }

  /**
   * Import verification data
   */
  async importData(
    data: string,
    options: {
      format: 'CSV' | 'JSON' | 'EXCEL'
      overwrite?: boolean
    }
  ): Promise<{
    success: boolean
    imported: number
    errors: string[]
  }> {
    // This would import verification data from the specified format
    // For now, return a placeholder
    return {
      success: false,
      imported: 0,
      errors: ['Import functionality would be implemented here']
    }
  }

  /**
   * Recalculate all matches
   */
  async recalculateMatches(): Promise<{
    success: boolean
    processed: number
    updated: number
    errors: string[]
  }> {
    if (!this.verificationEngine) {
      return {
        success: false,
        processed: 0,
        updated: 0,
        errors: ['Verification engine not initialized']
      }
    }

    try {
      // Get all unmatched transactions
      const unmatchedTransactions = await (db as any).bankMutation.findMany({
        where: {
          OR: [
            { matched_resident_id: null },
            { is_verified: false }
          ]
        }
      })

      let processed = 0
      let updated = 0
      const errors: string[] = []

      for (const transaction of unmatchedTransactions) {
        try {
          // Re-verify the transaction
          const result = await this.verificationEngine.verifyTransaction({
            id: transaction.id,
            date: transaction.transaction_date.toISOString(),
            description: transaction.description,
            amount: transaction.amount,
            balance: transaction.balance,
            reference: transaction.reference_number
          } as any)

          if (result.resident_id) {
            // Update the transaction with new match
            await (db as any).bankMutation.update({
              where: { id: transaction.id },
              data: {
                matched_resident_id: result.resident_id,
                match_score: result.confidence,
                matching_strategy: result.strategy,
                is_verified: result.confidence >= 0.8,
                verified_at: result.confidence >= 0.8 ? new Date() : null,
                verified_by: result.confidence >= 0.8 ? 'SYSTEM' : null
              }
            })

            updated++
          }

          processed++
        } catch (error) {
          errors.push(`Failed to process transaction ${transaction.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      return {
        success: true,
        processed,
        updated,
        errors
      }
    } catch (error) {
      return {
        success: false,
        processed: 0,
        updated: 0,
        errors: [`Recalculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }
}

/**
 * Utility function to create a verification dashboard service
 */
export function createVerificationDashboardService(): VerificationDashboardService {
  return new VerificationDashboardService()
}