/**
 * Debug Test for Fuzzy Name Matching Issues
 * Tests the specific problematic cases mentioned by the user
 */

import { FuzzyNameMatcher, createIndonesianNameMatcher, normalizeIndonesianName, areNamesEquivalent } from './fuzzy-name-matching'
import { parseDescription, calculateNameSimilarity } from './bank-mutation-utils'

// Mock resident data for testing
const mockResidents = [
  {
    id: '1',
    name: 'DONNY PUTRA',
    aliases: [],
    is_active: true
  },
  {
    id: '2', 
    name: 'ANNA CARLINA / AGUSTINUS ERWIN',
    aliases: [],
    is_active: true
  }
]

class FuzzyNameDebugTest {
  private matcher: FuzzyNameMatcher

  constructor() {
    this.matcher = createIndonesianNameMatcher(mockResidents)
  }

  /**
   * Test Case 1: DONNY PUTRA matching issue
   * Expected: Should match "DONNY PUTRA" with 100% confidence
   * Actual: Getting 50% match and becoming "FONY"
   */
  async testDonnyPutraMatch() {
    console.log('\n=== TEST CASE 1: DONNY PUTRA MATCH ===')
    
    const searchTerm = 'DONNY PUTRA'
    console.log(`Search term: "${searchTerm}"`)
    
    // Test name extraction
    const extractedNames = this.matcher.extractPotentialNames(searchTerm)
    console.log('Extracted names:', extractedNames)
    
    // Test normalization
    const normalized = normalizeIndonesianName(searchTerm)
    console.log('Normalized:', normalized)
    
    // Test direct matching
    const match = this.matcher.findBestMatch(searchTerm)
    console.log('Match result:', match)
    
    // Test the calculateNameSimilarity function
    const similarity = calculateNameSimilarity(searchTerm, 'DONNY PUTRA')
    console.log('Direct similarity:', similarity)
    
    // Test areNamesEquivalent
    const equivalent = areNamesEquivalent(searchTerm, 'DONNY PUTRA')
    console.log('Are equivalent:', equivalent)
    
    return {
      searchTerm,
      extractedNames,
      normalized,
      match,
      similarity,
      equivalent
    }
  }

  /**
   * Test Case 2: AGUSTINUS ERWIN matching issue
   * Expected: Should match "ANNA CARLINA / AGUSTINUS ERWIN" with high confidence
   * Actual: Getting 0% match
   */
  async testAgustinusErwinMatch() {
    console.log('\n=== TEST CASE 2: AGUSTINUS ERWIN MATCH ===')
    
    const searchTerm = 'AGUSTINUS ERWIN'
    console.log(`Search term: "${searchTerm}"`)
    
    // Test name extraction
    const extractedNames = this.matcher.extractPotentialNames(searchTerm)
    console.log('Extracted names:', extractedNames)
    
    // Test normalization
    const normalized = normalizeIndonesianName(searchTerm)
    console.log('Normalized:', normalized)
    
    // Test direct matching
    const match = this.matcher.findBestMatch(searchTerm)
    console.log('Match result:', match)
    
    // Test the calculateNameSimilarity function
    const similarity1 = calculateNameSimilarity(searchTerm, 'ANNA CARLINA / AGUSTINUS ERWIN')
    const similarity2 = calculateNameSimilarity(searchTerm, 'AGUSTINUS ERWIN')
    console.log('Similarity with full name:', similarity1)
    console.log('Similarity with partial name:', similarity2)
    
    // Test areNamesEquivalent
    const equivalent1 = areNamesEquivalent(searchTerm, 'ANNA CARLINA / AGUSTINUS ERWIN')
    const equivalent2 = areNamesEquivalent(searchTerm, 'AGUSTINUS ERWIN')
    console.log('Are equivalent (full):', equivalent1)
    console.log('Are equivalent (partial):', equivalent2)
    
    return {
      searchTerm,
      extractedNames,
      normalized,
      match,
      similarity1,
      similarity2,
      equivalent1,
      equivalent2
    }
  }

  /**
   * Test Case 3: Parse description with DONNY PUTRA
   */
  async testDescriptionParsing1() {
    console.log('\n=== TEST CASE 3: DESCRIPTION PARSING (DONNY PUTRA) ===')
    
    const description = 'Transfer dari DONNY PUTRA'
    console.log(`Description: "${description}"`)
    
    const parsed = parseDescription(description)
    console.log('Parsed result:', parsed)
    
    return { description, parsed }
  }

  /**
   * Test Case 4: Parse description with AGUSTINUS ERWIN
   */
  async testDescriptionParsing2() {
    console.log('\n=== TEST CASE 4: DESCRIPTION PARSING (AGUSTINUS ERWIN) ===')
    
    const description = 'Transfer dari AGUSTINUS ERWIN'
    console.log(`Description: "${description}"`)
    
    const parsed = parseDescription(description)
    console.log('Parsed result:', parsed)
    
    return { description, parsed }
  }

  /**
   * Test Case 5: Check Fuse.js configuration
   */
  async testFuseJsConfiguration() {
    console.log('\n=== TEST CASE 5: FUSE.JS CONFIGURATION ===')
    
    const stats = this.matcher.getStatistics()
    console.log('Matcher statistics:', stats)
    
    // Test with different thresholds
    const testNames = ['DONNY PUTRA', 'AGUSTINUS ERWIN', 'FONY', 'DONNY', 'PUTRA']
    
    for (const name of testNames) {
      const match = this.matcher.findBestMatch(name)
      console.log(`Testing "${name}":`, match ? `Matched ${match.resident.name} with ${Math.round(match.score * 100)}% confidence` : 'No match')
    }
    
    return { stats, testNames }
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('Starting Fuzzy Name Matching Debug Tests...')
    
    const results = {
      donnyPutra: await this.testDonnyPutraMatch(),
      agustinusErwin: await this.testAgustinusErwinMatch(),
      descriptionParsing1: await this.testDescriptionParsing1(),
      descriptionParsing2: await this.testDescriptionParsing2(),
      fuseJsConfig: await this.testFuseJsConfiguration()
    }
    
    console.log('\n=== TEST SUMMARY ===')
    console.log('All tests completed. Check the output above for detailed results.')
    
    return results
  }
}

// Export for use in other files
export { FuzzyNameDebugTest }

// If run directly, execute tests
if (require.main === module) {
  const test = new FuzzyNameDebugTest()
  test.runAllTests().catch(console.error)
}