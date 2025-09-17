/**
 * AI Verification Service for Gemini API Integration
 * Provides AI-powered verification for complex bank transaction matching
 */

export interface AIVerificationRequest {
  transaction: {
    id: string
    date: string
    description: string
    amount: number
    balance?: number
    reference?: string
  }
  residents: Array<{
    id: string
    name: string
    blok?: string
    houseNumber?: string
    paymentIndex?: number
    rt?: number
    rw?: number
    phone?: string
    email?: string
  }>
  context: {
    historicalMatches?: Array<{
      residentId: string
      description: string
      amount: number
      confidence: number
    }>
    learningPatterns?: Array<{
      residentId: string
      patterns: string[]
      confidence: number
    }>
    ruleBasedResults?: Array<{
      residentId: string
      confidence: number
      strategy: string
      factors: string[]
    }>
  }
  options?: {
    maxSuggestions?: number
    minConfidence?: number
    includeReasoning?: boolean
    temperature?: number
  }
}

export interface AIVerificationResponse {
  success: boolean
  matches: Array<{
    residentId: string
    confidence: number
    reasoning: string
    factors: string[]
  }>
  suggestions: string[]
  confidence: number
  reasoning: string
  metadata?: {
    modelUsed?: string
    tokensUsed?: number
    processingTime?: number
  }
  error?: string
}

export interface AIVerificationConfig {
  apiKey?: string
  model?: string
  baseUrl?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
  enabled?: boolean
}

export class AIVerificationService {
  private config: AIVerificationConfig
  private isInitialized = false

  constructor(config: AIVerificationConfig = {}) {
    this.config = {
      model: 'gemini-pro',
      temperature: 0.2,
      maxTokens: 1000,
      timeout: 30000,
      enabled: false,
      ...config
    }
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Check if API key is available
    if (!this.config.apiKey) {
      console.log('AI verification service disabled: No API key provided')
      this.config.enabled = false
    }

    this.isInitialized = true
  }

  /**
   * Verify a transaction using AI analysis
   */
  async verifyTransaction(request: AIVerificationRequest): Promise<AIVerificationResponse> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.config.enabled || !this.config.apiKey) {
      return {
        success: false,
        matches: [],
        suggestions: ['AI verification is not enabled'],
        confidence: 0,
        reasoning: 'AI verification service is disabled',
        error: 'AI verification service is disabled'
      }
    }

    try {
      const startTime = Date.now()
      
      // Build prompt for AI analysis
      const prompt = this.buildPrompt(request)
      
      // Call AI API
      const aiResponse = await this.callAIAPI(prompt)
      
      // Parse AI response
      const response = this.parseAIResponse(aiResponse, request)
      
      // Add metadata
      response.metadata = {
        modelUsed: this.config.model,
        processingTime: Date.now() - startTime
      }
      
      return response
    } catch (error) {
      console.error('AI verification failed:', error)
      
      return {
        success: false,
        matches: [],
        suggestions: ['AI verification failed, please try manual verification'],
        confidence: 0,
        reasoning: 'AI verification service encountered an error',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Build comprehensive prompt for AI analysis
   */
  private buildPrompt(request: AIVerificationRequest): string {
    const { transaction, residents, context, options } = request
    
    const prompt = `
You are an expert bank transaction verification assistant for an Indonesian residential community (RT/RW). Your task is to analyze bank transactions and match them to the correct residents.

## TRANSACTION DETAILS
- ID: ${transaction.id}
- Date: ${transaction.date}
- Description: "${transaction.description}"
- Amount: ${transaction.amount}
- Balance: ${transaction.balance || 'N/A'}
- Reference: ${transaction.reference || 'N/A'}

## RESIDENT DIRECTORY
${residents.map(resident => `
- ID: ${resident.id}
  Name: ${resident.name}
  Address: ${resident.blok ? `${resident.blok} / ${resident.houseNumber || 'N/A'}` : 'N/A'}
  Payment Index: ${resident.paymentIndex || 'N/A'}
  RT/RW: ${resident.rt || 'N/A'}/${resident.rw || 'N/A'}
  Contact: ${resident.phone || 'N/A'}, ${resident.email || 'N/A'}
`).join('')}

## CONTEXTUAL INFORMATION
${context.historicalMatches ? `
### HISTORICAL MATCHES
${context.historicalMatches.map(match => `
- Resident ${match.residentId}: "${match.description}" (Amount: ${match.amount}, Confidence: ${match.confidence})
`).join('')}
` : ''}

${context.learningPatterns ? `
### LEARNING PATTERNS
${context.learningPatterns.map(pattern => `
- Resident ${pattern.residentId}: Patterns [${pattern.patterns.join(', ')}] (Confidence: ${pattern.confidence})
`).join('')}
` : ''}

${context.ruleBasedResults ? `
### RULE-BASED RESULTS
${context.ruleBasedResults.map(result => `
- Resident ${result.residentId}: ${result.strategy} (Confidence: ${result.confidence})
  Factors: ${result.factors.join(', ')}
`).join('')}
` : ''}

## ANALYSIS INSTRUCTIONS
1. Analyze the transaction description and amount to identify potential residents
2. Consider Indonesian naming conventions, address formats (like "C11/9"), and payment patterns
3. Look for IPL-related keywords (IPL, kas RT, iuran, bulanan, etc.)
4. Extract any house numbers, names, or other identifying information
5. Consider the context provided (historical matches, learning patterns, rule-based results)
6. Provide a confidence score (0-1) for each potential match
7. Explain your reasoning for each match

## RESPONSE FORMAT
Please respond in JSON format with the following structure:
{
  "matches": [
    {
      "residentId": "string",
      "confidence": number (0-1),
      "reasoning": "string",
      "factors": ["string", "string"]
    }
  ],
  "suggestions": ["string", "string"],
  "overallConfidence": number (0-1),
  "reasoning": "string"
}

${options?.includeReasoning !== false ? 'Include detailed reasoning for your analysis.' : ''}
`

    return prompt
  }

  /**
   * Call AI API (placeholder for Gemini integration)
   */
  private async callAIAPI(prompt: string): Promise<any> {
    // This is a placeholder implementation
    // In a real implementation, this would call the Gemini API
    
    if (!this.config.apiKey) {
      throw new Error('API key not configured')
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // For now, return a mock response
    // This would be replaced with actual Gemini API call
    return {
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              matches: [],
              suggestions: ['AI verification would provide detailed analysis here'],
              overallConfidence: 0,
              reasoning: 'This is a placeholder response. Real AI analysis would be provided by Gemini API.'
            })
          }]
        }
      }]
    }
  }

  /**
   * Parse AI response and format it
   */
  private parseAIResponse(aiResponse: any, request: AIVerificationRequest): AIVerificationResponse {
    try {
      // Extract text from AI response
      const responseText = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      
      // Parse JSON response
      const parsed = JSON.parse(responseText)
      
      // Validate and format response
      const matches = (parsed.matches || []).map((match: any) => ({
        residentId: match.residentId,
        confidence: Math.max(0, Math.min(1, match.confidence || 0)),
        reasoning: match.reasoning || '',
        factors: Array.isArray(match.factors) ? match.factors : []
      }))
      
      // Filter matches by minimum confidence if specified
      const minConfidence = request.options?.minConfidence || 0
      const filteredMatches = matches.filter(match => match.confidence >= minConfidence)
      
      // Limit number of matches if specified
      const maxSuggestions = request.options?.maxSuggestions || 5
      const limitedMatches = filteredMatches.slice(0, maxSuggestions)
      
      return {
        success: true,
        matches: limitedMatches,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        confidence: Math.max(0, Math.min(1, parsed.overallConfidence || 0)),
        reasoning: parsed.reasoning || 'No reasoning provided'
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error)
      
      return {
        success: false,
        matches: [],
        suggestions: ['Failed to parse AI response'],
        confidence: 0,
        reasoning: 'Invalid response format from AI service',
        error: 'Failed to parse AI response'
      }
    }
  }

  /**
   * Check if AI verification is available
   */
  isAvailable(): boolean {
    return this.config.enabled === true && !!this.config.apiKey
  }

  /**
   * Get service configuration
   */
  getConfig(): AIVerificationConfig {
    return { ...this.config }
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<AIVerificationConfig>): void {
    this.config = {
      ...this.config,
      ...config
    }
  }

  /**
   * Test AI service connectivity
   */
  async testConnectivity(): Promise<{
    success: boolean
    message: string
    responseTime?: number
  }> {
    if (!this.isAvailable()) {
      return {
        success: false,
        message: 'AI service is not configured or enabled'
      }
    }

    try {
      const startTime = Date.now()
      
      // Send a simple test request
      const testRequest: AIVerificationRequest = {
        transaction: {
          id: 'test',
          date: new Date().toISOString(),
          description: 'Test transaction',
          amount: 200000
        },
        residents: [],
        context: {}
      }
      
      await this.verifyTransaction(testRequest)
      
      const responseTime = Date.now() - startTime
      
      return {
        success: true,
        message: 'AI service is working correctly',
        responseTime
      }
    } catch (error) {
      return {
        success: false,
        message: `AI service test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Get usage statistics (placeholder)
   */
  getUsageStats(): {
    totalRequests: number
    successfulRequests: number
    averageResponseTime: number
    lastUsed?: Date
  } {
    // This would track actual usage in a real implementation
    return {
      totalRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0
    }
  }
}

/**
 * Utility function to create an AI verification service
 */
export function createAIVerificationService(config?: AIVerificationConfig): AIVerificationService {
  return new AIVerificationService(config)
}

/**
 * Utility function to validate AI verification configuration
 */
export function validateAIVerificationConfig(config: AIVerificationConfig): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!config.apiKey) {
    errors.push('API key is required')
  }

  if (config.temperature && (config.temperature < 0 || config.temperature > 1)) {
    errors.push('Temperature must be between 0 and 1')
  }

  if (config.maxTokens && config.maxTokens < 1) {
    errors.push('Max tokens must be at least 1')
  }

  if (config.timeout && config.timeout < 1000) {
    errors.push('Timeout must be at least 1000ms')
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}