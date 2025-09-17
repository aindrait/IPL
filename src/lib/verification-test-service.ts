
/**
 * Verification Test Service
 * Provides testing functionality for the enhanced verification system
 */

import { db } from '@/lib/db'
import { EnhancedVerificationEngine } from './enhanced-verification-engine'
import { VerificationLearningSystem } from './verification-learning-system'
import { RuleBasedMatchingEngine } from './rule-based-matching-engine'
import { AIVerificationService } from './ai-verification-service'
import { ManualVerificationService } from './manual-verification-service'
import { VerificationDashboardService } from './verification-dashboard-service'

export interface TestTransaction {
  id: string
  date: string
  description: string
  amount: number
  balance?: number
  reference?: string
  expectedResidentId?: string
  expectedConfidence?: number
}

export interface TestResult {
  transactionId: string
  actualResidentId?: string
  actualConfidence?: number
  expectedResidentId?: string
  expectedConfidence?: number
  match: boolean
  confidenceMatch: boolean
  processingTime: number
  strategy?: string
  factors?: string[]
  error?: string
}

export interface TestSuite {
  id: string
  name: string
  description: string
  transactions: TestTransaction[]
  createdAt: Date
}

export interface TestReport {
  suiteId: string
  suiteName: string
  totalTransactions: number
  successfulMatches: number
  confidenceMatches: number
  averageConfidence: number
  averageProcessingTime: number
  results: TestResult[]
  summary: {
    accuracy: number
    precision: number
    recall: number
    f1Score: number
  }
  createdAt: Date
}

export class VerificationTestService {
  private verificationEngine: EnhancedVerificationEngine | null = null
  private learningSystem: VerificationLearningSystem | null = null
  private ruleBasedEngine: RuleBasedMatchingEngine | null = null
  private aiService: AIVerificationService | null = null
  private manualService: ManualVerificationService | null = null
  private dashboardService: VerificationDashboardService | null = null
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

    this.dashboardService = new VerificationDashboardService()
    await this.dashboardService.initialize()

    this.isInitialized = true
  }

  /**
   * Get test suites from existing database data
   */
  async getTestSuitesFromDatabase(): Promise<TestSuite[]> {
    // Get transactions from January - March 2025
    const startDate = new Date('2025-01-01T00:00:00Z')
    const endDate = new Date('2025-03-31T23:59:59Z')

    // Get unmatched transactions for testing
    const unmatchedTransactions = await (db as any).bankMutation.findMany({
      where: {
        transactionDate: {
          gte: startDate,
          lte: endDate
        },
        OR: [
          { matchedResidentId: null },
          { isVerified: false }
        ]
      },
      orderBy: { transactionDate: 'desc' },
      take: 50 // Limit for performance
    })

    // Get matched transactions for testing
    const matchedTransactions = await (db as any).bankMutation.findMany({
      where: {
        transactionDate: {
          gte: startDate,
          lte: endDate
        },
        matchedResidentId: { not: null },
        isVerified: true
      },
      orderBy: { transactionDate: 'desc' },
      take: 50 // Limit for performance
    })

    // Create test suites
    const testSuites: TestSuite[] = []

    // Unmatched transactions test suite
    if (unmatchedTransactions.length > 0) {
      testSuites.push({
        id: 'unmatched_db_test',
        name: 'Unmatched Transactions Test Suite',
        description: 'Test unmatched transactions from database (Jan-Mar 2025)',
        transactions: unmatchedTransactions.map((t: any) => ({
          id: t.id,
          date: t.transactionDate.toISOString(),
          description: t.description,
          amount: t.amount,
          balance: t.balance,
          reference: t.referenceNumber
        })),
        createdAt: new Date()
      })
    }

    // Matched transactions test suite
    if (matchedTransactions.length > 0) {
      testSuites.push({
        id: 'matched_db_test',
        name: 'Matched Transactions Test Suite',
        description: 'Test matched transactions from database (Jan-Mar 2025)',
        transactions: matchedTransactions.map((t: any) => ({
          id: t.id,
          date: t.transactionDate.toISOString(),
          description: t.description,
          amount: t.amount,
          balance: t.balance,
          reference: t.referenceNumber,
          expectedResidentId: t.matchedResidentId,
          expectedConfidence: t.matchScore
        })),
        createdAt: new Date()
      })
    }

    // Payment index test suite
    const paymentIndexTransactions = await (db as any).bankMutation.findMany({
      where: {
        transactionDate: {
          gte: startDate,
          lte: endDate
        },
        amount: {
          gte: 200000,
          lte: 500000
        }
      },
      orderBy: { transactionDate: 'desc' },
      take: 20
    })

    if (paymentIndexTransactions.length > 0) {
      testSuites.push({
        id: 'payment_index_db_test',
        name: 'Payment Index Test Suite',
        description: 'Test transactions with potential payment index (Jan-Mar 2025)',
        transactions: paymentIndexTransactions.map((t: any) => ({
          id: t.id,
          date: t.transactionDate.toISOString(),
          description: t.description,
          amount: t.amount,
          balance: t.balance,
          reference: t.referenceNumber
        })),
        createdAt: new Date()
      })
    }

    // IPL keywords test suite
    const iplTransactions = await (db as any).bankMutation.findMany({
      where: {
        transactionDate: {
          gte: startDate,
          lte: endDate
        },
        description: {
          contains: 'IPL'
        }
      },
      orderBy: { transactionDate: 'desc' },
      take: 20
    })

    if (iplTransactions.length > 0) {
      testSuites.push({
        id: 'ipl_keywords_db_test',
        name: 'IPL Keywords Test Suite',
        description: 'Test transactions with IPL keywords (Jan-Mar 2025)',
        transactions: iplTransactions.map((t: any) => ({
          id: t.id,
          date: t.transactionDate.toISOString(),
          description: t.description,
          amount: t.amount,
          balance: t.balance,
          reference: t.referenceNumber
        })),
        createdAt: new Date()
      })
    }

    return testSuites
  }

  /**
   * Run a test suite
   */
  async runTestSuite(suiteId: string): Promise<TestReport> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    // Get the test suite from database
    const testSuites = await this.getTestSuitesFromDatabase()
    const suite = testSuites.find(s => s.id === suiteId)
    if (!suite) {
      throw new Error(`Test suite ${suiteId} not found`)
    }

    // Get residents for testing
    const residents = await db.resident.findMany({
      where: { isActive: true }
    })

    // Run tests for each transaction
    const results: TestResult[] = []
    
    for (const transaction of suite.transactions) {
      const result = await this.testTransaction(transaction, residents)
      results.push(result)
    }

    // Calculate statistics
    const totalTransactions = results.length
    const successfulMatches = results.filter(r => r.match).length
    const confidenceMatches = results.filter(r => r.confidenceMatch).length
    const averageConfidence = results.reduce((sum, r) => sum + (r.actualConfidence || 0), 0) / totalTransactions
    const averageProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / totalTransactions

    // Calculate summary metrics
    const truePositives = results.filter(r => r.match && r.expectedResidentId).length
    const falsePositives = results.filter(r => r.match && !r.expectedResidentId).length
    const falseNegatives = results.filter(r => !r.match && r.expectedResidentId).length
    const trueNegatives = results.filter(r => !r.match && !r.expectedResidentId).length

    const precision = truePositives + falsePositives > 0 
      ? truePositives / (truePositives + falsePositives) 
      : 0
    
    const recall = truePositives + falseNegatives > 0 
      ? truePositives / (truePositives + falseNegatives) 
      : 0
    
    const f1Score = precision + recall > 0 
      ? 2 * (precision * recall) / (precision + recall) 
      : 0

    const accuracy = totalTransactions > 0 
      ? (truePositives + trueNegatives) / totalTransactions 
      : 0

    return {
      suiteId,
      suiteName: suite.name,
      totalTransactions,
      successfulMatches,
      confidenceMatches,
      averageConfidence,
      averageProcessingTime,
      results,
      summary: {
        accuracy,
        precision,
        recall,
        f1Score
      },
      createdAt: new Date()
    }
  }

  /**
   * Test a single transaction
   */
  private async testTransaction(
    transaction: TestTransaction,
    residents: any[]
  ): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      // Verify the transaction
      const result = await this.verificationEngine!.verifyTransaction({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        balance: transaction.balance,
        reference: transaction.reference
      } as any)

      const processingTime = Date.now() - startTime

      // Check if the result matches expectations
      const match = transaction.expectedResidentId 
        ? result.residentId === transaction.expectedResidentId
        : !result.residentId
      
      const confidenceMatch = transaction.expectedConfidence !== undefined
        ? Math.abs((result.confidence || 0) - transaction.expectedConfidence) < 0.1
        : true

      return {
        transactionId: transaction.id,
        actualResidentId: result.residentId,
        actualConfidence: result.confidence,
        expectedResidentId: transaction.expectedResidentId,
        expectedConfidence: transaction.expectedConfidence,
        match,
        confidenceMatch,
        processingTime,
        strategy: result.strategy,
        factors: result.factors
      }
    } catch (error) {
      const processingTime = Date.now() - startTime

      return {
        transactionId: transaction.id,
        expectedResidentId: transaction.expectedResidentId,
        expectedConfidence: transaction.expectedConfidence,
        match: false,
        confidenceMatch: false,
        processingTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Run all test suites
   */
  async runAllTests(): Promise<TestReport[]> {
    const testSuites = await this.getTestSuitesFromDatabase()
    const reports: TestReport[] = []

    for (const suite of testSuites) {
      const report = await this.runTestSuite(suite.id)
      reports.push(report)
    }

    return reports
  }

  /**
   * Generate a comprehensive test report
   */
  async generateComprehensiveReport(): Promise<{
    overallSummary: {
      totalSuites: number
      totalTransactions: number
      overallAccuracy: number
      overallPrecision: number
      overallRecall: number
      overallF1Score: number
      averageConfidence: number
      averageProcessingTime: number
    }
    suiteReports: TestReport[]
    recommendations: string[]
  }> {
    const reports = await this.runAllTests()

    // Calculate overall summary
    const totalSuites = reports.length
    const totalTransactions = reports.reduce((sum, report) => sum + report.totalTransactions, 0)
    const overallAccuracy = reports.reduce((sum, report) => sum + report.summary.accuracy * report.totalTransactions, 0) / totalTransactions
    const overallPrecision = reports.reduce((sum, report) => sum + report.summary.precision * report.totalTransactions, 0) / totalTransactions
    const overallRecall = reports.reduce((sum, report) => sum + report.summary.recall * report.totalTransactions, 0) / totalTransactions
    const overallF1Score = reports.reduce((sum, report) => sum + report.summary.f1Score * report.totalTransactions, 0) / totalTransactions
    const averageConfidence = reports.reduce((sum, report) => sum + report.averageConfidence * report.totalTransactions, 0) / totalTransactions
    const averageProcessingTime = reports.reduce((sum, report) => sum + report.averageProcessingTime * report.totalTransactions, 0) / totalTransactions

    // Generate recommendations
    const recommendations: string[] = []
    
    if (overallAccuracy < 0.8) {
      recommendations.push('Overall accuracy is below 80%. Consider improving matching algorithms.')
    }
    
    if (overallPrecision < 0.8) {
      recommendations.push('Precision is below 80%. Review false positive matches.')
    }
    
    if (overallRecall < 0.8) {
      recommendations.push('Recall is below 80%. Review false negative matches.')
    }
    
    if (averageProcessingTime > 2000) {
      recommendations.push('Average processing time is above 2 seconds. Consider performance optimizations.')
    }

    return {
      overallSummary: {
        totalSuites,
        totalTransactions,
        overallAccuracy,
        overallPrecision,
        overallRecall,
        overallF1Score,
        averageConfidence,
        averageProcessingTime
      },
      suiteReports: reports,
      recommendations
    }
  }
}
