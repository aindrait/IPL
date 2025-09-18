/**
 * Debug Test for Additional Fuzzy Name Matching Issues
 * Tests the specific problematic cases mentioned by the user
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

class FuzzyNameDebugTestV2 {
  private matcher: FuzzyNameMatcher
  private verificationEngine: EnhancedVerificationEngine

  constructor() {
    this.matcher = createIndonesianNameMatcher(mockResidents)
    this.verificationEngine = new EnhancedVerificationEngine()
  }

  /**
   * Test Case 1: "Ipl feb 25 c11 no 10 AGUSTINUS ERWIN"
   * Expected: Should match resident "ANNA CARLINA / AGUSTINUS ERWIN" with blok C10 no 10
   * Actual: Getting 0% match
   */
  async testCase1() {
    console.log('\n=== TEST CASE 1: "Ipl feb 25 c11 no 10 AGUSTINUS ERWIN" ===')
    
    const description = "Ipl feb 25 c11 no 10 AGUSTINUS ERWIN"
    console.log(`Description: "${description}"`)
    
    // Test description parsing
    const parsed = parseDescription(description)
    console.log('Parsed description:', parsed)
    
    // Test name extraction
    const extractedNames = this.matcher.extractPotentialNames(description)
    console.log('Extracted names:', extractedNames)
    
    // Test name matching
    for (const name of extractedNames) {
      const match = this.matcher.findBestMatch(name)
      console.log(`Name "${name}" match:`, match)
    }
    
    // Test address pattern extraction
    const addressPattern = this.extractAddressPattern(description)
    console.log('Extracted address pattern:', addressPattern)
    
    // Test if we can find resident by address pattern
    const residentByAddress = this.findResidentByAddress(addressPattern)
    console.log('Resident by address:', residentByAddress)
    
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
   * Test Case 2: "250000.00c12 no 3 H M NUHLODI"
   * Expected: Should match resident "H M NUHLODI" with blok C12 no 3
   * Actual: Getting 0% match
   */
  async testCase2() {
    console.log('\n=== TEST CASE 2: "250000.00c12 no 3 H M NUHLODI" ===')
    
    const description = "250000.00c12 no 3 H M NUHLODI"
    console.log(`Description: "${description}"`)
    
    // Test description parsing
    const parsed = parseDescription(description)
    console.log('Parsed description:', parsed)
    
    // Test name extraction
    const extractedNames = this.matcher.extractPotentialNames(description)
    console.log('Extracted names:', extractedNames)
    
    // Test name matching
    for (const name of extractedNames) {
      const match = this.matcher.findBestMatch(name)
      console.log(`Name "${name}" match:`, match)
    }
    
    // Test address pattern extraction
    const addressPattern = this.extractAddressPattern(description)
    console.log('Extracted address pattern:', addressPattern)
    
    // Test if we can find resident by address pattern
    const residentByAddress = this.findResidentByAddress(addressPattern)
    console.log('Resident by address:', residentByAddress)
    
    // Test with verification engine
    try {
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
   * Find resident by address pattern
   */
  private findResidentByAddress(addressPattern: string | null) {
    if (!addressPattern) return null
    
    // Normalize address pattern for comparison (remove extra spaces)
    const normalizedPattern = addressPattern.replace(/\s+/g, ' ').trim()
    
    return mockResidents.find(resident => {
      if (!resident.blok || !resident.house_number) return false
      
      // Normalize resident address for comparison
      const residentAddress = `${resident.blok} / ${resident.house_number}`.replace(/\s+/g, ' ').trim()
      
      // Check for exact match first
      if (residentAddress === normalizedPattern) return true
      
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
        
        return patternBlok === residentBlok && patternNumber === residentNumber
      }
      
      return false
    })
  }

  /**
   * Test direct name similarity calculations
   */
  async testNameSimilarity() {
    console.log('\n=== TEST CASE 3: NAME SIMILARITY CALCULATIONS ===')
    
    const testCases = [
      { name1: 'AGUSTINUS ERWIN', name2: 'ANNA CARLINA / AGUSTINUS ERWIN' },
      { name1: 'H M NUHLODI', name2: 'H M NUHLODI' },
      { name1: 'AGUSTINUS', name2: 'ANNA CARLINA / AGUSTINUS ERWIN' },
      { name1: 'ERWIN', name2: 'ANNA CARLINA / AGUSTINUS ERWIN' },
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
    console.log('Starting Fuzzy Name Matching Debug Tests V2...')
    
    const results = {
      testCase1: await this.testCase1(),
      testCase2: await this.testCase2(),
      nameSimilarity: await this.testNameSimilarity()
    }
    
    console.log('\n=== TEST SUMMARY ===')
    console.log('All tests completed. Check the output above for detailed results.')
    
    return results
  }
}

// Export for use in other files
export { FuzzyNameDebugTestV2 }

// If run directly, execute tests
if (require.main === module) {
  const test = new FuzzyNameDebugTestV2()
  test.runAllTests().catch(console.error)
}