/**
 * Enhanced Address Pattern Matching for House Numbers
 * Handles various Indonesian address formats like C11/9, C11 no9, C 11 nomor 09, etc.
 */

export interface AddressPattern {
  blok: string
  houseNumber: string
  format: string
  confidence: number
  rawMatch: string
}

export interface AddressMatchResult {
  pattern: AddressPattern | null
  residentId?: string
  confidence: number
  factors: string[]
}

export class AddressPatternMatcher {
  private patterns: Array<{
    regex: RegExp
    extractor: (match: RegExpMatchArray) => { blok: string; houseNumber: string }
    format: string
    confidence: number
  }>

  constructor() {
    this.patterns = [
      // Pattern 1: C11/9 format (most common)
      {
        regex: /C\s*(\d+)\s*[\/\s]\s*(\d+)/i,
        extractor: (match) => ({
          blok: `C ${match[1]}`,
          houseNumber: match[2].replace(/^0+/, '') // Remove leading zeros
        }),
        format: 'C##/#',
        confidence: 0.95
      },
      
      // Pattern 2: C11 no9 format
      {
        regex: /C\s*(\d+)\s*no\.?\s*(\d+)/i,
        extractor: (match) => ({
          blok: `C ${match[1]}`,
          houseNumber: match[2].replace(/^0+/, '')
        }),
        format: 'C## no#',
        confidence: 0.9
      },
      
      // Pattern 3: C 11 nomor 09 format
      {
        regex: /C\s*(\d+)\s*nomor\s*(\d+)/i,
        extractor: (match) => ({
          blok: `C ${match[1]}`,
          houseNumber: match[2].replace(/^0+/, '')
        }),
        format: 'C ## nomor ##',
        confidence: 0.9
      },
      
      // Pattern 4: Blok C11 no 9 format
      {
        regex: /blok\s*C\s*(\d+)\s*no\.?\s*(\d+)/i,
        extractor: (match) => ({
          blok: `C ${match[1]}`,
          houseNumber: match[2].replace(/^0+/, '')
        }),
        format: 'Blok C## no #',
        confidence: 0.85
      },
      
      // Pattern 5: C11/09 format (with leading zero)
      {
        regex: /C\s*(\d+)\s*[\/\s]\s*0?(\d+)/i,
        extractor: (match) => ({
          blok: `C ${match[1]}`,
          houseNumber: match[2].replace(/^0+/, '')
        }),
        format: 'C##/0#',
        confidence: 0.85
      },
      
      // Pattern 6: C11-9 format
      {
        regex: /C\s*(\d+)\s*-\s*(\d+)/i,
        extractor: (match) => ({
          blok: `C ${match[1]}`,
          houseNumber: match[2].replace(/^0+/, '')
        }),
        format: 'C##-#',
        confidence: 0.8
      },
      
      // Pattern 7: C.11/9 format
      {
        regex: /C\.?\s*(\d+)\s*[\/\s]\s*(\d+)/i,
        extractor: (match) => ({
          blok: `C ${match[1]}`,
          houseNumber: match[2].replace(/^0+/, '')
        }),
        format: 'C.##/#',
        confidence: 0.8
      },
      
      // Pattern 8: Cluster C11 No.9 format
      {
        regex: /cluster\s*C\s*(\d+)\s*No\.?\s*(\d+)/i,
        extractor: (match) => ({
          blok: `C ${match[1]}`,
          houseNumber: match[2].replace(/^0+/, '')
        }),
        format: 'Cluster C## No.#',
        confidence: 0.75
      }
    ]
  }

  /**
   * Extract address pattern from transaction description
   */
  extractAddressPattern(description: string): AddressPattern | null {
    for (const pattern of this.patterns) {
      const match = description.match(pattern.regex)
      if (match) {
        const { blok, houseNumber } = pattern.extractor(match)
        
        return {
          blok,
          houseNumber,
          format: pattern.format,
          confidence: pattern.confidence,
          rawMatch: match[0]
        }
      }
    }

    return null
  }

  /**
   * Find matching resident based on address pattern
   */
  findMatchingResident(addressPattern: AddressPattern, residents: any[]): any | null {
    return residents.find(r => 
      r.blok && r.houseNumber && 
      this.normalizeBlok(r.blok) === this.normalizeBlok(addressPattern.blok) &&
      this.normalizeHouseNumber(r.houseNumber) === this.normalizeHouseNumber(addressPattern.houseNumber)
    )
  }

  /**
   * Match address pattern in description and find corresponding resident
   */
  matchAddress(description: string, residents: any[]): AddressMatchResult {
    const addressPattern = this.extractAddressPattern(description)
    
    if (!addressPattern) {
      return {
        pattern: null,
        confidence: 0,
        factors: ['No address pattern found']
      }
    }

    const resident = this.findMatchingResident(addressPattern, residents)
    
    if (!resident) {
      return {
        pattern: addressPattern,
        confidence: addressPattern.confidence * 0.5, // Lower confidence if no resident match
        factors: [`Address pattern found: ${addressPattern.rawMatch}`, 'No matching resident']
      }
    }

    return {
      pattern: addressPattern,
      residentId: resident.id,
      confidence: addressPattern.confidence,
      factors: [
        `Address pattern match: ${addressPattern.rawMatch}`,
        `Resident: ${resident.name} (${resident.blok}/${resident.houseNumber})`
      ]
    }
  }

  /**
   * Extract all potential address patterns from description
   */
  extractAllAddressPatterns(description: string): AddressPattern[] {
    const patterns: AddressPattern[] = []
    
    for (const pattern of this.patterns) {
      const matches = description.match(new RegExp(pattern.regex.source, 'gi'))
      if (matches) {
        for (const match of matches) {
          const matchArray = match.match(pattern.regex)
          if (matchArray) {
            const { blok, houseNumber } = pattern.extractor(matchArray)
            patterns.push({
              blok,
              houseNumber,
              format: pattern.format,
              confidence: pattern.confidence,
              rawMatch: match
            })
          }
        }
      }
    }

    // Sort by confidence and remove duplicates
    return patterns
      .sort((a, b) => b.confidence - a.confidence)
      .filter((pattern, index, self) => 
        index === self.findIndex(p => 
          p.blok === pattern.blok && p.houseNumber === pattern.houseNumber
        )
      )
  }

  /**
   * Normalize blok format for comparison
   */
  private normalizeBlok(blok: string): string {
    return blok
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .replace(/[.\-]/g, '')
      .trim()
  }

  /**
   * Normalize house number format for comparison
   */
  private normalizeHouseNumber(houseNumber: string): string {
    return houseNumber
      .replace(/^0+/, '') // Remove leading zeros
      .trim()
  }

  /**
   * Calculate similarity between two address patterns
   */
  calculateAddressSimilarity(pattern1: AddressPattern, pattern2: AddressPattern): number {
    let similarity = 0

    // Blok similarity
    if (this.normalizeBlok(pattern1.blok) === this.normalizeBlok(pattern2.blok)) {
      similarity += 0.5
    }

    // House number similarity
    if (this.normalizeHouseNumber(pattern1.houseNumber) === this.normalizeHouseNumber(pattern2.houseNumber)) {
      similarity += 0.5
    }

    return similarity
  }

  /**
   * Find best address match from a list of potential addresses
   */
  findBestAddressMatch(
    targetAddress: AddressPattern, 
    candidateAddresses: AddressPattern[]
  ): AddressPattern | null {
    let bestMatch: AddressPattern | null = null
    let bestSimilarity = 0

    for (const candidate of candidateAddresses) {
      const similarity = this.calculateAddressSimilarity(targetAddress, candidate)
      
      if (similarity > bestSimilarity && similarity >= 0.8) {
        bestSimilarity = similarity
        bestMatch = candidate
      }
    }

    return bestMatch
  }

  /**
   * Extract RT/RW information from description
   */
  extractRtRw(description: string): { rt?: number; rw?: number; confidence: number } {
    // RT/RW pattern matching
    const rtRwPatterns = [
      {
        regex: /RT\s*(\d+)(?:\s*\/?\s*RW\s*(\d+))?/i,
        extractor: (match: RegExpMatchArray) => ({
          rt: parseInt(match[1], 10),
          rw: match[2] ? parseInt(match[2], 10) : undefined
        }),
        confidence: 0.9
      },
      {
        regex: /RUKUN\s*TETANGGA\s*(\d+)(?:\s*[\/\s]?\s*RUKUN\s*WARGA\s*(\d+))?/i,
        extractor: (match: RegExpMatchArray) => ({
          rt: parseInt(match[1], 10),
          rw: match[2] ? parseInt(match[2], 10) : undefined
        }),
        confidence: 0.85
      }
    ]

    for (const pattern of rtRwPatterns) {
      const match = description.match(pattern.regex)
      if (match) {
        const result = pattern.extractor(match)
        return {
          rt: result.rt,
          rw: result.rw,
          confidence: pattern.confidence
        }
      }
    }

    return { confidence: 0 }
  }

  /**
   * Validate if an address pattern looks like a valid Indonesian address
   */
  isValidAddressPattern(pattern: AddressPattern): boolean {
    // Check blok format (should be like "C 11")
    const blokValid = /^C\s*\d+$/.test(pattern.blok)
    
    // Check house number (should be numeric)
    const houseNumberValid = /^\d+$/.test(pattern.houseNumber)
    
    // Check reasonable ranges
    const blokNumber = parseInt(pattern.blok.replace(/\D/g, ''))
    const houseNumberValidRange = parseInt(pattern.houseNumber) >= 1 && parseInt(pattern.houseNumber) <= 999
    
    return blokValid && houseNumberValid && blokNumber >= 1 && blokNumber <= 99 && houseNumberValidRange
  }

  /**
   * Generate standardized address string from pattern
   */
  formatAddress(pattern: AddressPattern): string {
    return `${pattern.blok} / ${pattern.houseNumber}`
  }

  /**
   * Parse complex address strings that might contain multiple address components
   */
  parseComplexAddress(addressString: string): {
    primaryAddress?: AddressPattern
    secondaryAddresses?: AddressPattern[]
    rtRw?: { rt?: number; rw?: number }
    confidence: number
  } {
    const result: any = {
      confidence: 0
    }

    // Extract primary address
    const primaryPattern = this.extractAddressPattern(addressString)
    if (primaryPattern) {
      result.primaryAddress = primaryPattern
      result.confidence = primaryPattern.confidence
    }

    // Extract all address patterns
    const allPatterns = this.extractAllAddressPatterns(addressString)
    if (allPatterns.length > 1) {
      result.secondaryAddresses = allPatterns.filter(p => 
        p !== result.primaryAddress
      )
    }

    // Extract RT/RW
    const rtRw = this.extractRtRw(addressString)
    if (rtRw.confidence > 0) {
      result.rtRw = rtRw
      result.confidence = Math.max(result.confidence, rtRw.confidence * 0.3)
    }

    return result
  }

  /**
   * Get statistics about address pattern matching
   */
  getStatistics(): {
    totalPatterns: number
    patternFormats: string[]
    averageConfidence: number
  } {
    const patternFormats = this.patterns.map(p => p.format)
    const averageConfidence = this.patterns.reduce((sum, p) => sum + p.confidence, 0) / this.patterns.length

    return {
      totalPatterns: this.patterns.length,
      patternFormats,
      averageConfidence
    }
  }
}

/**
 * Utility function to create an address pattern matcher with Indonesian address support
 */
export function createIndonesianAddressMatcher(): AddressPatternMatcher {
  return new AddressPatternMatcher()
}

/**
 * Utility function to standardize address format for display
 */
export function standardizeAddressFormat(blok: string, houseNumber: string): string {
  const normalizedBlok = blok
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/[.\-]/g, '')
    .trim()
  
  const normalizedHouseNumber = houseNumber
    .replace(/^0+/, '')
    .trim()
  
  return `${normalizedBlok} / ${normalizedHouseNumber}`
}