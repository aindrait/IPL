/**
 * Enhanced Fuzzy Name Matching using Fuse.js
 * Provides improved name matching capabilities for bank transaction verification
 */

import Fuse from 'fuse.js'
import type { FuseResult, IFuseOptions } from 'fuse.js'

export interface FuzzyNameMatchOptions {
  threshold?: number
  keys?: string[]
  includeScore?: boolean
  minMatchCharLength?: number
  shouldSort?: boolean
}

export interface FuzzyNameMatchResult {
  resident: any
  score: number
  matchedField: string
  matchedValue: string
}

export class FuzzyNameMatcher {
  private fuse: Fuse<any>
  private options: FuzzyNameMatchOptions

  constructor(residents: any[], options: FuzzyNameMatchOptions = {}) {
    this.options = {
      threshold: options.threshold || 0.4, // Lower threshold = more strict matching
      keys: options.keys || ['name', 'aliases'],
      includeScore: options.includeScore || true,
      minMatchCharLength: options.minMatchCharLength || 2,
      shouldSort: options.shouldSort !== false // Default to true
    }

    // Prepare residents data for Fuse.js
    const fuseData = residents.map(resident => ({
      ...resident,
      // Ensure aliases is an array
      aliases: resident.aliases || []
    }))

    this.fuse = new Fuse(fuseData, this.options)
  }

  /**
   * Find the best matching resident for a given search term
   */
  findBestMatch(searchTerm: string): FuzzyNameMatchResult | null {
    const results = this.fuse.search(searchTerm, { limit: 1 })
    
    if (results.length === 0) return null

    const result = results[0]
    const matches = result.matches || []
    
    // Determine which field matched best
    let bestMatch = matches[0]
    for (const match of matches) {
      if (match.refIndex !== undefined && bestMatch.refIndex !== undefined && match.refIndex < bestMatch.refIndex) {
        bestMatch = match
      }
    }

    const finalScore = 1 - (result.score || 0) // Convert to similarity score (0-1)
    
    // Handle case where matches array is empty
    const matchResult = {
      resident: result.item,
      score: finalScore,
      matchedField: bestMatch?.key || 'name',
      matchedValue: bestMatch?.value || result.item.name || ''
    }
    
    return matchResult
  }

  /**
   * Find all matching residents up to a specified limit
   */
  findMatches(searchTerm: string, limit: number = 5): FuzzyNameMatchResult[] {
    const results = this.fuse.search(searchTerm, { limit })
    
    return results.map(result => {
      const matches = result.matches || []
      let bestMatch = matches[0]
      
      for (const match of matches) {
        if (match.refIndex !== undefined && bestMatch.refIndex !== undefined && match.refIndex < bestMatch.refIndex) {
          bestMatch = match
        }
      }

      return {
        resident: result.item,
        score: 1 - (result.score || 0),
        matchedField: bestMatch.key || '',
        matchedValue: bestMatch.value || ''
      }
    })
  }

  /**
   * Find matches with a minimum similarity threshold
   */
  findMatchesAboveThreshold(searchTerm: string, minSimilarity: number = 0.7): FuzzyNameMatchResult[] {
    const allMatches = this.findMatches(searchTerm, 20) // Get more results initially
    
    return allMatches.filter(match => match.score >= minSimilarity)
  }

  /**
   * Batch search for multiple search terms
   */
  batchSearch(searchTerms: string[], options: { limit?: number; minSimilarity?: number } = {}): Map<string, FuzzyNameMatchResult[]> {
    const results = new Map<string, FuzzyNameMatchResult[]>()
    
    for (const term of searchTerms) {
      const matches = options.minSimilarity 
        ? this.findMatchesAboveThreshold(term, options.minSimilarity)
        : this.findMatches(term, options.limit || 5)
      
      results.set(term, matches)
    }
    
    return results
  }

  /**
   * Extract potential names from transaction description
   */
  extractPotentialNames(description: string): string[] {
    const names: string[] = []
    
    // Pattern 1: Full names (First Last)
    const fullNamePattern = /\b[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g
    const fullNameMatches = description.match(fullNamePattern)
    if (fullNameMatches) {
      names.push(...fullNameMatches)
    }
    
    // Pattern 2: Indonesian name patterns (e.g., "BUDI SANTOSO")
    const indonesianNamePattern = /\b[A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)?\b/g
    const indonesianNameMatches = description.match(indonesianNamePattern)
    if (indonesianNameMatches) {
      names.push(...indonesianNameMatches)
    }
    
    // Pattern 3: Names with titles (e.g., "Mr. John Doe")
    const titledNamePattern = /\b(?:Mr|Mrs|Ms|Dr|Prof)\.\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/gi
    const titledNameMatches = description.match(titledNamePattern)
    if (titledNameMatches) {
      names.push(...titledNameMatches)
    }
    
    // Filter out common non-name words
    const nonNameWords = [
      'transfer', 'bank', 'payment', 'via', 'from', 'to', 'rt', 'rw',
      'ipl', 'kas', 'iuran', 'bulanan', 'bayar', 'sumbangan', 'thr',
      'mandiri', 'bca', 'bni', 'bri', 'btn', 'cimb', 'danamon'
    ]
    
    const filteredNames = names.filter(name => {
      // Keep names that are at least 3 characters long
      if (name.length < 3) return false
      
      // Check if name contains any filtered words
      const lowerName = name.toLowerCase()
      for (const filterWord of nonNameWords) {
        // Only filter if the entire name matches the filter word exactly
        // or if it's a clear substring match (not part of a longer name)
        if (lowerName === filterWord ||
            (filterWord.length > 4 && lowerName.includes(filterWord) && name.length <= filterWord.length + 2)) {
          return false
        }
      }
      
      return true
    })
    
    // Try to improve name matching by removing common suffixes that might be noise
    const improvedNames = filteredNames.map(name => {
      // Remove common suffixes that might be noise in Indonesian names
      const noiseSuffixes = [' SO', ' SI', ' BIN', ' BINTI', ' AL-']
      let improvedName = name
      
      for (const suffix of noiseSuffixes) {
        if (improvedName.endsWith(suffix)) {
          improvedName = improvedName.substring(0, improvedName.length - suffix.length).trim()
          break
        }
      }
      
      return improvedName
    })
    
    // Add improved names if they're different and still valid
    for (let i = 0; i < improvedNames.length; i++) {
      if (improvedNames[i] !== filteredNames[i] &&
          improvedNames[i].length >= 3 &&
          !filteredNames.includes(improvedNames[i])) {
        filteredNames.push(improvedNames[i])
      }
    }
    
    console.log(`[FUZZY DEBUG] Filtered names:`, filteredNames)
    return filteredNames
  }

  /**
   * Find the best resident match from a transaction description
   */
  findBestResidentMatch(description: string): FuzzyNameMatchResult | null {
    const potentialNames = this.extractPotentialNames(description)
    
    if (potentialNames.length === 0) return null
    
    let bestMatch: FuzzyNameMatchResult | null = null
    
    for (const name of potentialNames) {
      const match = this.findBestMatch(name)
      
      if (match && (!bestMatch || match.score > bestMatch.score)) {
        bestMatch = match
      }
    }
    
    return bestMatch
  }

  /**
   * Calculate confidence score based on match quality and context
   */
  calculateMatchConfidence(match: FuzzyNameMatchResult, context?: {
    amount?: number
    date?: Date
    description?: string
  }): number {
    let confidence = match.score
    
    // Boost confidence for exact name matches
    if (match.score >= 0.95) {
      confidence += 0.05
    }
    
    // Boost confidence for primary name matches over alias matches
    if (match.matchedField === 'name') {
      confidence += 0.1
    }
    
    // Consider context if provided
    if (context) {
      // Amount context: if amount is typical for IPL payments
      if (context.amount && context.amount >= 200000 && context.amount <= 500000) {
        confidence += 0.05
      }
      
      // Description context: if description contains IPL keywords
      if (context.description) {
        const iplKeywords = ['ipl', 'kas', 'iuran', 'rt', 'rw', 'bulanan']
        const hasIplKeywords = iplKeywords.some(keyword => 
          context.description!.toLowerCase().includes(keyword)
        )
        
        if (hasIplKeywords) {
          confidence += 0.05
        }
      }
    }
    
    return Math.min(1.0, confidence)
  }

  /**
   * Update the matcher with new resident data
   */
  updateResidents(residents: any[]): void {
    const fuseData = residents.map(resident => ({
      ...resident,
      aliases: resident.aliases || []
    }))

    this.fuse = new Fuse(fuseData, this.options)
  }

  /**
   * Get statistics about the matcher performance
   */
  getStatistics(): {
    totalResidents: number
    averageAliasesPerResident: number
    options: FuzzyNameMatchOptions
  } {
    // Access the original data instead of the index
    const docs = (this.fuse as any)._docs || []
    const totalResidents = docs.length
    const aliasesCount = docs.reduce((sum: number, doc: any) =>
      sum + (doc.aliases || []).length, 0
    )
    
    return {
      totalResidents,
      averageAliasesPerResident: totalResidents > 0 ? aliasesCount / totalResidents : 0,
      options: this.options
    }
  }
}

/**
 * Utility function to create a fuzzy name matcher with optimal settings for Indonesian names
 */
export function createIndonesianNameMatcher(residents: any[]): FuzzyNameMatcher {
  return new FuzzyNameMatcher(residents, {
    threshold: 0.4, // Relatively strict matching
    keys: ['name', 'aliases'],
    includeScore: true,
    minMatchCharLength: 2,
    shouldSort: true
  })
}

/**
 * Utility function to normalize Indonesian names for better matching
 */
export function normalizeIndonesianName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .trim()
}

/**
 * Utility function to check if two names might refer to the same person
 * considering common Indonesian name variations
 */
export function areNamesEquivalent(name1: string, name2: string): boolean {
  const normalizedName1 = normalizeIndonesianName(name1)
  const normalizedName2 = normalizeIndonesianName(name2)
  
  // Exact match
  if (normalizedName1 === normalizedName2) return true
  
  // Check if one is a substring of the other (common in Indonesian names)
  if (normalizedName1.includes(normalizedName2) || normalizedName2.includes(normalizedName1)) {
    return true
  }
  
  // Check for common Indonesian name patterns
  const words1 = normalizedName1.split(' ')
  const words2 = normalizedName2.split(' ')
  
  // If both names have multiple words, check for overlapping words
  if (words1.length > 1 && words2.length > 1) {
    const commonWords = words1.filter(word => words2.includes(word))
    return commonWords.length >= Math.min(words1.length, words2.length)
  }
  
  return false
}