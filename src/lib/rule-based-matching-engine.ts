/**
 * Rule-Based Matching Engine with Configurable Rules
 * Provides a flexible system for defining and executing matching rules
 */

import { db } from '@/lib/db'
import { FuzzyNameMatcher } from './fuzzy-name-matching'
import { AddressPatternMatcher } from './address-pattern-matching'
import { IPLIdentifier } from './ipl-identifier'
import { VerificationLearningSystem } from './verification-learning-system'

export interface MatchingRule {
  id: string
  name: string
  description: string
  priority: number
  enabled: boolean
  condition: RuleCondition
  action: RuleAction
  confidence: number
  tags: string[]
  lastModified: Date
}

export interface RuleCondition {
  type: 'AND' | 'OR' | 'NOT'
  conditions: RuleConditionNode[]
}

export interface RuleConditionNode {
  type: 'PAYMENT_INDEX' | 'AMOUNT' | 'DATE_RANGE' | 'NAME' | 'ADDRESS' | 'IPL_KEYWORDS' | 'DESCRIPTION_PATTERN' | 'LEARNING_PATTERN'
  field?: string
  operator: 'EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'GREATER_THAN' | 'LESS_THAN' | 'BETWEEN' | 'REGEX' | 'EXISTS' | 'MATCHES'
  value: any
  weight?: number
}

export interface RuleAction {
  type: 'MATCH_RESIDENT' | 'SUGGEST_MATCH' | 'EXCLUDE_MATCH' | 'BOOST_CONFIDENCE' | 'REQUIRE_VERIFICATION'
  target?: string
  parameters: Record<string, any>
}

export interface MatchingResult {
  resident_id?: string
  payment_id?: string
  confidence: number
  strategy: string
  factors: string[]
  rules: string[]
  requiresVerification: boolean
  suggestions: string[]
}

export interface MatchingContext {
  transaction: any
  residents: any[]
  learningData?: Map<string, any>
  historicalPatterns?: Map<string, any[]>
  currentDate: Date
}

export class RuleBasedMatchingEngine {
  private rules: Map<string, MatchingRule> = new Map()
  private fuzzyNameMatcher: FuzzyNameMatcher | null = null
  private addressPatternMatcher: AddressPatternMatcher | null = null
  private iplIdentifier: IPLIdentifier | null = null
  private learningSystem: VerificationLearningSystem | null = null
  private isInitialized = false

  constructor() {
    this.initializeDefaultRules()
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

    // Load custom rules from database if available
    await this.loadCustomRules()

    this.isInitialized = true
  }

  private initializeDefaultRules(): void {
    // Rule 1: Payment Index Match (Highest Priority)
    this.addRule({
      id: 'payment_index_match',
      name: 'Payment Index Match',
      description: 'Match by payment index extracted from transaction amount',
      priority: 1,
      enabled: true,
      condition: {
        type: 'AND',
        conditions: [
          {
            type: 'PAYMENT_INDEX',
            operator: 'EXISTS',
            value: null
          }
        ]
      },
      action: {
        type: 'MATCH_RESIDENT',
        parameters: {
          confidence: 0.95,
          strategy: 'PAYMENT_INDEX'
        }
      },
      confidence: 0.95,
      tags: ['high-confidence', 'payment-index'],
      lastModified: new Date()
    })

    // Rule 2: Exact Amount + Date Range Match
    this.addRule({
      id: 'exact_amount_date_match',
      name: 'Exact Amount + Date Range Match',
      description: 'Match by exact amount within date range',
      priority: 2,
      enabled: true,
      condition: {
        type: 'AND',
        conditions: [
          {
            type: 'AMOUNT',
            operator: 'EQUALS',
            value: null
          },
          {
            type: 'DATE_RANGE',
            operator: 'BETWEEN',
            value: { daysBefore: 7, daysAfter: 7 }
          }
        ]
      },
      action: {
        type: 'MATCH_RESIDENT',
        parameters: {
          confidence: 0.9,
          strategy: 'EXACT_AMOUNT_DATE'
        }
      },
      confidence: 0.9,
      tags: ['high-confidence', 'amount-date'],
      lastModified: new Date()
    })

    // Rule 3: Enhanced Name Match
    this.addRule({
      id: 'enhanced_name_match',
      name: 'Enhanced Name Match',
      description: 'Match using fuzzy name matching with Fuse.js',
      priority: 3,
      enabled: true,
      condition: {
        type: 'AND',
        conditions: [
          {
            type: 'NAME',
            operator: 'CONTAINS',
            value: null
          }
        ]
      },
      action: {
        type: 'MATCH_RESIDENT',
        parameters: {
          confidence: 0.8,
          strategy: 'ENHANCED_NAME'
        }
      },
      confidence: 0.8,
      tags: ['medium-confidence', 'name-matching'],
      lastModified: new Date()
    })

    // Rule 4: Address Pattern Match
    this.addRule({
      id: 'address_pattern_match',
      name: 'Address Pattern Match',
      description: 'Match by address pattern in transaction description',
      priority: 4,
      enabled: true,
      condition: {
        type: 'AND',
        conditions: [
          {
            type: 'ADDRESS',
            operator: 'EXISTS',
            value: null
          }
        ]
      },
      action: {
        type: 'MATCH_RESIDENT',
        parameters: {
          confidence: 0.85,
          strategy: 'ADDRESS_PATTERN'
        }
      },
      confidence: 0.85,
      tags: ['high-confidence', 'address-matching'],
      lastModified: new Date()
    })

    // Rule 5: IPL Keywords Match
    this.addRule({
      id: 'ipl_keywords_match',
      name: 'IPL Keywords Match',
      description: 'Match by IPL keywords in transaction description',
      priority: 5,
      enabled: true,
      condition: {
        type: 'AND',
        conditions: [
          {
            type: 'IPL_KEYWORDS',
            operator: 'EXISTS',
            value: null
          }
        ]
      },
      action: {
        type: 'SUGGEST_MATCH',
        parameters: {
          confidence: 0.7,
          strategy: 'IPL_KEYWORDS'
        }
      },
      confidence: 0.7,
      tags: ['medium-confidence', 'ipl-matching'],
      lastModified: new Date()
    })

    // Rule 6: Learning Pattern Match
    this.addRule({
      id: 'learning_pattern_match',
      name: 'Learning Pattern Match',
      description: 'Match based on historical learning patterns',
      priority: 6,
      enabled: true,
      condition: {
        type: 'AND',
        conditions: [
          {
            type: 'LEARNING_PATTERN',
            operator: 'EXISTS',
            value: null
          }
        ]
      },
      action: {
        type: 'SUGGEST_MATCH',
        parameters: {
          confidence: 0.75,
          strategy: 'LEARNING_PATTERN'
        }
      },
      confidence: 0.75,
      tags: ['medium-confidence', 'learning-based'],
      lastModified: new Date()
    })

    // Rule 7: Description Pattern Match
    this.addRule({
      id: 'description_pattern_match',
      name: 'Description Pattern Match',
      description: 'Match by regex patterns in transaction description',
      priority: 7,
      enabled: true,
      condition: {
        type: 'AND',
        conditions: [
          {
            type: 'DESCRIPTION_PATTERN',
            operator: 'MATCHES',
            value: null
          }
        ]
      },
      action: {
        type: 'SUGGEST_MATCH',
        parameters: {
          confidence: 0.6,
          strategy: 'DESCRIPTION_PATTERN'
        }
      },
      confidence: 0.6,
      tags: ['low-confidence', 'pattern-matching'],
      lastModified: new Date()
    })
  }

  private async loadCustomRules(): Promise<void> {
    try {
      // Try to load custom rules from database if the table exists
      const customRules = await (db as any).verificationRule.findMany({
        where: { is_active: true },
        orderBy: { priority: 'asc' }
      })

      for (const rule of customRules) {
        try {
          const parsedRule: MatchingRule = {
            id: rule.id,
            name: rule.name,
            description: rule.description || '',
            priority: rule.priority,
            enabled: true,
            condition: JSON.parse(rule.condition || '{}'),
            action: JSON.parse(rule.action || '{}'),
            confidence: rule.confidence || 0.5,
            tags: [],
            lastModified: rule.updated_at
          }

          this.addRule(parsedRule)
        } catch (error) {
          console.error(`Failed to parse custom rule ${rule.id}:`, error)
        }
      }
    } catch (error) {
      console.log('Custom rules table not available, using default rules only')
    }
  }

  addRule(rule: MatchingRule): void {
    this.rules.set(rule.id, rule)
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId)
  }

  enableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId)
    if (rule) {
      rule.enabled = true
      rule.lastModified = new Date()
      return true
    }
    return false
  }

  disableRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId)
    if (rule) {
      rule.enabled = false
      rule.lastModified = new Date()
      return true
    }
    return false
  }

  getRule(ruleId: string): MatchingRule | undefined {
    return this.rules.get(ruleId)
  }

  getAllRules(): MatchingRule[] {
    return Array.from(this.rules.values()).sort((a, b) => a.priority - b.priority)
  }

  getRulesByTag(tag: string): MatchingRule[] {
    return this.getAllRules().filter(rule => rule.tags.includes(tag))
  }

  async findBestMatch(transaction: any, residents: any[]): Promise<MatchingResult | null> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const context: MatchingContext = {
      transaction,
      residents,
      learningData: new Map(), // Would be populated from learning system
      historicalPatterns: new Map(), // Would be populated from historical data
      currentDate: new Date()
    }

    const results: MatchingResult[] = []

    // Get all enabled rules sorted by priority
    const enabledRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority)

    // Execute each rule
    for (const rule of enabledRules) {
      try {
        const result = await this.executeRule(rule, context)
        if (result) {
          results.push(result)
        }
      } catch (error) {
        console.error(`Error executing rule ${rule.id}:`, error)
      }
    }

    // Return the best result
    if (results.length === 0) {
      return null
    }

    // Sort by confidence and return the best
    results.sort((a, b) => b.confidence - a.confidence)
    return results[0]
  }

  private async executeRule(rule: MatchingRule, context: MatchingContext): Promise<MatchingResult | null> {
    // Check if rule condition is met
    const conditionMet = await this.evaluateCondition(rule.condition, context)
    
    if (!conditionMet) {
      return null
    }

    // Execute rule action
    return await this.executeAction(rule, context)
  }

  private async evaluateCondition(condition: RuleCondition, context: MatchingContext): Promise<boolean> {
    if (condition.conditions.length === 0) return true

    const results = await Promise.all(
      condition.conditions.map(node => this.evaluateConditionNode(node, context))
    )

    switch (condition.type) {
      case 'AND':
        return results.every(result => result)
      case 'OR':
        return results.some(result => result)
      case 'NOT':
        return !results.some(result => result)
      default:
        return false
    }
  }

  private async evaluateConditionNode(node: RuleConditionNode, context: MatchingContext): Promise<boolean> {
    const { transaction, residents, currentDate } = context

    switch (node.type) {
      case 'PAYMENT_INDEX':
        return this.evaluatePaymentIndexCondition(node, transaction)
      
      case 'AMOUNT':
        return this.evaluateAmountCondition(node, transaction)
      
      case 'DATE_RANGE':
        return this.evaluateDateRangeCondition(node, transaction, currentDate)
      
      case 'NAME':
        return this.evaluateNameCondition(node, transaction)
      
      case 'ADDRESS':
        return this.evaluateAddressCondition(node, transaction)
      
      case 'IPL_KEYWORDS':
        return this.evaluateIPLKeywordsCondition(node, transaction)
      
      case 'DESCRIPTION_PATTERN':
        return this.evaluateDescriptionPatternCondition(node, transaction)
      
      case 'LEARNING_PATTERN':
        return this.evaluateLearningPatternCondition(node, transaction, context)
      
      default:
        return false
    }
  }

  private evaluatePaymentIndexCondition(node: RuleConditionNode, transaction: any): boolean {
    // Extract payment index from amount
    // Get base amount from environment variable or use default
    const baseAmounts = (process.env.NEXT_PUBLIC_IPL_BASE_AMOUNT || "250000")
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
    const baseAmount = baseAmounts[0] || 250000
    
    if (transaction.amount <= 0 || baseAmount <= 0) return false
    
    const months = Math.floor(transaction.amount / baseAmount)
    if (months === 0) return false
    
    const remainder = transaction.amount - (months * baseAmount)
    
    return remainder >= 100 && remainder <= 9999
  }

  private evaluateAmountCondition(node: RuleConditionNode, transaction: any): boolean {
    const amount = transaction.amount

    switch (node.operator) {
      case 'EQUALS':
        return amount === node.value
      
      case 'GREATER_THAN':
        return amount > node.value
      
      case 'LESS_THAN':
        return amount < node.value
      
      case 'BETWEEN':
        return amount >= node.value.min && amount <= node.value.max
      
      default:
        return false
    }
  }

  private evaluateDateRangeCondition(node: RuleConditionNode, transaction: any, currentDate: Date): boolean {
    const transaction_date = new Date(transaction.date)
    const { daysBefore = 7, daysAfter = 7 } = node.value
    
    const minDate = new Date(currentDate.getTime() - daysBefore * 24 * 60 * 60 * 1000)
    const maxDate = new Date(currentDate.getTime() + daysAfter * 24 * 60 * 60 * 1000)
    
    return transaction_date >= minDate && transaction_date <= maxDate
  }

  private evaluateNameCondition(node: RuleConditionNode, transaction: any): boolean {
    if (!this.fuzzyNameMatcher) return false

    const description = transaction.description
    const potentialNames = this.fuzzyNameMatcher.extractPotentialNames(description)
    
    return potentialNames.length > 0
  }

  private evaluateAddressCondition(node: RuleConditionNode, transaction: any): boolean {
    if (!this.addressPatternMatcher) return false

    const description = transaction.description
    const addressPattern = this.addressPatternMatcher.extractAddressPattern(description)
    
    return addressPattern !== null
  }

  private evaluateIPLKeywordsCondition(node: RuleConditionNode, transaction: any): boolean {
    if (!this.iplIdentifier) return false

    const description = transaction.description
    const iplInfo = this.iplIdentifier.identifyIPLTransaction(description, transaction.amount)
    
    return iplInfo.isIPLTransaction
  }

  private evaluateDescriptionPatternCondition(node: RuleConditionNode, transaction: any): boolean {
    if (!node.value || !node.value.pattern) return false

    const description = transaction.description
    const pattern = new RegExp(node.value.pattern, node.value.flags || 'i')
    
    return pattern.test(description)
  }

  private evaluateLearningPatternCondition(node: RuleConditionNode, transaction: any, context: MatchingContext): boolean {
    if (!this.learningSystem || !context.learningData) return false

    // This would check against learning patterns
    // For now, return false as a placeholder
    return false
  }

  private async executeAction(rule: MatchingRule, context: MatchingContext): Promise<MatchingResult | null> {
    const { transaction, residents } = context

    switch (rule.action.type) {
      case 'MATCH_RESIDENT':
        return await this.executeMatchResidentAction(rule, context)
      
      case 'SUGGEST_MATCH':
        return await this.executeSuggestMatchAction(rule, context)
      
      case 'EXCLUDE_MATCH':
        return this.executeExcludeMatchAction(rule, context)
      
      case 'BOOST_CONFIDENCE':
        return this.executeBoostConfidenceAction(rule, context)
      
      case 'REQUIRE_VERIFICATION':
        return this.executeRequireVerificationAction(rule, context)
      
      default:
        return null
    }
  }

  private async executeMatchResidentAction(rule: MatchingRule, context: MatchingContext): Promise<MatchingResult | null> {
    const { transaction, residents } = context
    const { strategy } = rule.action.parameters

    let resident_id: string | undefined
    let payment_id: string | undefined
    const factors: string[] = []

    switch (strategy) {
      case 'PAYMENT_INDEX':
        const payment_index = this.extractPaymentIndex(transaction.amount)
        if (payment_index) {
          const resident = residents.find(r => r.payment_index === payment_index)
          if (resident) {
            resident_id = resident.id
            factors.push(`Payment index match: ${payment_index}`)
            
            // Try to find matching payment
            const payment = await this.findMatchingPayment(resident.id, transaction)
            if (payment) {
              payment_id = payment
            }
          }
        }
        break
      
      case 'EXACT_AMOUNT_DATE':
        // Find resident with exact amount match in date range
        for (const resident of residents) {
          const payment = await this.findMatchingPayment(resident.id, transaction)
          if (payment) {
            resident_id = resident.id
            payment_id = payment
            factors.push(`Exact amount match: ${transaction.amount}`)
            break
          }
        }
        break
      
      case 'ENHANCED_NAME':
        if (this.fuzzyNameMatcher) {
          const nameMatch = this.fuzzyNameMatcher.findBestResidentMatch(transaction.description)
          if (nameMatch) {
            resident_id = nameMatch.resident.id
            factors.push(`Name match: ${nameMatch.matchedValue} (${Math.round(nameMatch.score * 100)}%)`)
            
            // Try to find matching payment
            if (resident_id) {
              const payment = await this.findMatchingPayment(resident_id, transaction)
              if (payment) {
                payment_id = payment
              }
            }
          }
        }
        break
      
      case 'ADDRESS_PATTERN':
        if (this.addressPatternMatcher) {
          const addressMatch = this.addressPatternMatcher.matchAddress(transaction.description, residents)
          if (addressMatch.resident_id) {
            resident_id = addressMatch.resident_id
            factors.push(...addressMatch.factors)
            
            // Try to find matching payment
            const payment = await this.findMatchingPayment(resident_id, transaction)
            if (payment) {
              payment_id = payment
            }
          }
        }
        break
      
      default:
        return null
    }

    if (!resident_id) {
      return null
    }

    return {
      resident_id,
      payment_id,
      confidence: rule.action.parameters.confidence || rule.confidence,
      strategy,
      factors,
      rules: [rule.id],
      requiresVerification: false,
      suggestions: []
    }
  }

  private async executeSuggestMatchAction(rule: MatchingRule, context: MatchingContext): Promise<MatchingResult | null> {
    // Similar to MATCH_RESIDENT but with lower confidence and requires verification
    const result = await this.executeMatchResidentAction(rule, context)
    
    if (result) {
      result.confidence *= 0.8 // Reduce confidence for suggestions
      result.requiresVerification = true
      result.suggestions.push('Manual verification recommended')
    }
    
    return result
  }

  private executeExcludeMatchAction(rule: MatchingRule, context: MatchingContext): MatchingResult | null {
    // This would exclude certain matches
    // For now, return null as a placeholder
    return null
  }

  private executeBoostConfidenceAction(rule: MatchingRule, context: MatchingContext): MatchingResult | null {
    // This would boost confidence of existing matches
    // For now, return null as a placeholder
    return null
  }

  private executeRequireVerificationAction(rule: MatchingRule, context: MatchingContext): MatchingResult | null {
    // This would mark matches as requiring verification
    // For now, return null as a placeholder
    return null
  }

  private extractPaymentIndex(amount: number): number | null {
    // Get base amount from environment variable or use default
    const baseAmounts = (process.env.NEXT_PUBLIC_IPL_BASE_AMOUNT || "250000")
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
    const baseAmount = baseAmounts[0] || 250000
    
    if (amount <= 0 || baseAmount <= 0) return null
    
    const months = Math.floor(amount / baseAmount)
    if (months === 0) return null
    
    const remainder = amount - (months * baseAmount)
    
    if (remainder >= 10 && remainder <= 9999) {
      return remainder
    }
    
    return null
  }

  private async findMatchingPayment(resident_id: string, transaction: any): Promise<string | null> {
    const transaction_date = new Date(transaction.date)
    
    const matchingPayment = await db.payment.findFirst({
      where: {
        resident_id,
        amount: transaction.amount,
        payment_date: {
          gte: new Date(transaction_date.getTime() - 7 * 24 * 60 * 60 * 1000),
          lte: new Date(transaction_date.getTime() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      orderBy: { payment_date: 'desc' }
    })
    
    return matchingPayment?.id || null
  }

  /**
   * Get statistics about rule execution
   */
  getStatistics(): {
    totalRules: number
    enabledRules: number
    rulesByTag: Record<string, number>
    averagePriority: number
  } {
    const allRules = Array.from(this.rules.values())
    const enabledRules = allRules.filter(rule => rule.enabled)
    
    const rulesByTag: Record<string, number> = {}
    for (const rule of allRules) {
      for (const tag of rule.tags) {
        rulesByTag[tag] = (rulesByTag[tag] || 0) + 1
      }
    }
    
    const averagePriority = allRules.reduce((sum, rule) => sum + rule.priority, 0) / (allRules.length || 1)
    
    return {
      totalRules: allRules.length,
      enabledRules: enabledRules.length,
      rulesByTag,
      averagePriority
    }
  }
}

/**
 * Utility function to create a rule-based matching engine
 */
export function createRuleBasedMatchingEngine(): RuleBasedMatchingEngine {
  return new RuleBasedMatchingEngine()
}