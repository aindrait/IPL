/**
 * Debug Test for Additional Fuzzy Name Matching Issues V3
 * Tests the specific case: "250000.00Ipl feb 25 c11 no 10 AGUSTINUS ERWIN SO"
 */

import { FuzzyNameMatcher, createIndonesianNameMatcher } from './fuzzy-name-matching'
import { parseDescription, calculateNameSimilarity } from './bank-mutation-utils'
import { EnhancedVerificationEngine } from './enhanced-verification-engine'

// Mock resident data for testing
const mockResidents = [
  {
    id: '1',
    name: 'ANNA CARLINA / AGUSTINUS ERWIN',
    aliases: [],
    blok: 'C10',
    house_number: '10',
    is_active: true
  },
  {
    id: '2', 
    name: 'H M NUHLODI',
    aliases: [],
    blok: 'C12',
    house_number: '3',
    is_active: true
  }
]

class FuzzyNameDebugTestV3 {
  private matcher: FuzzyNameMatcher
  private verificationEngine: EnhancedVerificationEngine

  constructor() {
    this.matcher = createIndonesianNameMatcher(mockResidents)
    this.verificationEngine = new EnhancedVerificationEngine()
  }

  /**
   * Test Case: "250000.00Ipl feb 25 c11 no 10 AGUSTINUS ERWIN SO"
   * Expected: Should match resident "ANNA CARLINA / AGUSTINUS ERWIN" with blok C10 no 10
   * Issues: 
   * 1. "AGUSTINUS ERWIN SO" should match with "ANNA CARLINA /AGUSTINUS ERWIN" (partial name)
   * 2. "c11 no 10" should match with "C10" (fuzzy address matching)
   */
  async testCase() {
    console.log('\n=== TEST CASE: "250000.00Ipl feb 25 c11 no 10 AGUSTINUS ERWIN SO" ===')
    
    const description = "250000.00Ipl feb 25 c11 no 10 AGUSTINUS ERWIN SO"
    console.log(`Description: "${description}"`)
    
    // Test description parsing
    const parsed = parseDescription(description)
    console.log('Parsed description:', parsed)
    
    // Test name extraction
    const extractedNames = this.matcher.extractPotentialNames(description)
    console.log('Extracted names:', extractedNames)
    
    // Test name matching for each extracted name
    for (const name of extractedNames) {
      const match = this.matcher.findBestMatch(name)
      console.log(`Name "${name}" match:`, match)
      
      // Test partial name matching
      if (name.includes(' ')) {
        const nameParts = name.split(' ')
        for (const part of nameParts) {
          if (part.length > 2) {
            const partMatch = this.matcher.findBestMatch(part)
            console.log(`  Partial name "${part}" match:`, partMatch)
          }
        }
      }
    }
    
    // Test address pattern extraction
    const addressPattern = this.extractAddressPattern(description)
    console.log('Extracted address pattern:', addressPattern)
    
    // Test if we can find resident by address pattern (with fuzzy matching)
    const residentByAddress = this.findResidentByAddressFuzzy(addressPattern)
    console.log('Resident by fuzzy address:', residentByAddress)
    
    // Test with verification engine
    try {
      await this.verificationEngine.initialize()
      const transaction = {
        date: '2025-02-25',
        description,
        amount: 250000,
        balance: 1000000
      }
      const verificationResult = await this.verificationEngine.verifyTransaction(transaction as any)
      console.log('Verification engine result:', verificationResult)
    } catch (error) {
      console.log('Verification engine error:', error)
    }
    
    return { description, parsed, extractedNames, addressPattern }
  }

  /**
   * Extract address pattern from description
   */
  private extractAddressPattern(description: string): string | null {
    // Look for house patterns like "c11 no 10", "c12 no 3", etc.
    const patterns = [
      /c\s*(\d+)\s*no\.?\s*(\d+)/i,      // c # no #
      /c(\d+)\s*no\.?\s*(\d+)/i,         // c# no #
      /blok\s*c\s*(\d+)\s*no\.?\s*(\d+)/i, // blok c# no #
      /c\s*(\d+)\s*\/\s*(\d+)/i,         // c # / #
      /C(\d+)\s*no\s*(\d+)/i,            // C# no # (uppercase)
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

  /**
   * Find resident by address pattern with fuzzy matching
   */
  private findResidentByAddressFuzzy(addressPattern: string | null) {
    if (!addressPattern) return null
    
    // Normalize address pattern for comparison (remove extra spaces)
    const normalizedPattern = addressPattern.replace(/\s+/g, ' ').trim()
    
    const matches: any[] = []
    
    for (const resident of mockResidents) {
      if (!resident.blok || !resident.house_number) continue
      
      // Normalize resident address for comparison
      const residentAddress = `${resident.blok} / ${resident.house_number}`.replace(/\s+/g, ' ').trim()
      
      // Check for exact match first
      if (residentAddress === normalizedPattern) {
        matches.push({ resident, score: 1.0, type: 'exact' })
        continue
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
        
        if (score > 0) {
          matches.push({ 
            resident, 
            score, 
            type: score === 1.0 ? 'exact' : 'fuzzy',
            details: {
              patternBlok, residentBlok, patternNumber, residentNumber
            }
          })
        }
      }
    }
    
    // Sort by score and return the best match
    matches.sort((a, b) => b.score - a.score)
    return matches.length > 0 ? matches[0] : null
  }

  /**
   * Test direct name similarity calculations
   */
  async testNameSimilarity() {
    console.log('\n=== TEST CASE: NAME SIMILARITY CALCULATIONS ===')
    
    const testCases = [
      { name1: 'AGUSTINUS ERWIN SO', name2: 'ANNA CARLINA / AGUSTINUS ERWIN' },
      { name1: 'AGUSTINUS ERWIN', name2: 'ANNA CARLINA / AGUSTINUS ERWIN' },
      { name1: 'ERWIN', name2: 'ANNA CARLINA / AGUSTINUS ERWIN' },
      { name1: 'AGUSTINUS', name2: 'ANNA CARLINA / AGUSTINUS ERWIN' },
      { name1: 'SO', name2: 'ANNA CARLINA / AGUSTINUS ERWIN' },
    ]
    
    for (const testCase of testCases) {
      const similarity = calculateNameSimilarity(testCase.name1, testCase.name2)
      console.log(`Similarity between "${testCase.name1}" and "${testCase.name2}": ${similarity}`)
    }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('Starting Fuzzy Name Matching Debug Tests V3...')
    
    const results = {
      testCase: await this.testCase(),
      nameSimilarity: await this.testNameSimilarity()
    }
    
    console.log('\n=== TEST SUMMARY ===')
    console.log('All tests completed. Check the output above for detailed results.')
    
    return results
  }
}

// Export for use in other files
export { FuzzyNameDebugTestV3 }

// If run directly, execute tests
if (require.main === module) {
  const test = new FuzzyNameDebugTestV3()
  test.runAllTests().catch(console.error)
}