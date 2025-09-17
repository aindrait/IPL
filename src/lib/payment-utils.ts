/**
 * Generate a payment index from BLOK and house number
 * Example: C11/9 becomes 119
 * @param blok - The BLOK identifier (e.g., "C11")
 * @param houseNumber - The house number (e.g., "9")
 * @returns The generated payment index as a number
 */
export function generatePaymentIndex(blok: string, houseNumber: string): number {
  if (!blok || !houseNumber) {
    throw new Error('BLOK and house number are required');
  }

  // Extract numbers from BLOK (e.g., "C11" -> 11)
  const blokNumbers = blok.replace(/[^0-9]/g, '');
  const blokNum = parseInt(blokNumbers, 10) || 0;
  
  // Parse house number
  const houseNum = parseInt(houseNumber, 10) || 0;
  
  // Combine to create payment index - blok number * 1000 + house number
  // This ensures C4 and 5 becomes 4 * 1000 + 5 = 4005, and C4 and 6 becomes 4 * 1000 + 6 = 4006
  // Using 1000 to ensure proper sorting even with house numbers up to 999
  return blokNum * 1000 + houseNum;
}

/**
 * Extract payment index from payment amount
 * Example: 250087 with base amount 250000 returns 87
 * @param amount - The total payment amount
 * @param baseAmount - The base IPL amount per month
 * @returns The extracted payment index
 */
export function extractPaymentIndex(amount: number, baseAmount: number = 250000): number {
  if (amount <= 0 || baseAmount <= 0) {
    throw new Error('Amount and base amount must be positive numbers');
  }

  // Calculate how many months are being paid for
  const months = Math.floor(amount / baseAmount);
  
  // Extract the payment index
  return amount - (months * baseAmount);
}

/**
 * Validate payment amount against resident's payment index
 * @param amount - The payment amount
 * @param residentPaymentIndex - The resident's payment index
 * @param baseAmount - The base IPL amount per month
 * @returns Object with validation result and number of months
 */
export function validatePaymentAmount(
  amount: number, 
  residentPaymentIndex: number, 
  baseAmount: number = 250000
): { isValid: boolean; months: number; message?: string } {
  try {
    const extractedIndex = extractPaymentIndex(amount, baseAmount);
    const months = Math.floor((amount - extractedIndex) / baseAmount);
    
    if (extractedIndex !== residentPaymentIndex) {
      return {
        isValid: false,
        months,
        message: `Invalid payment index. Expected ${residentPaymentIndex}, got ${extractedIndex}`
      };
    }
    
    if (months < 1) {
      return {
        isValid: false,
        months,
        message: 'Payment amount is too low'
      };
    }
    
    return {
      isValid: true,
      months
    };
  } catch (error) {
    return {
      isValid: false,
      months: 0,
      message: error instanceof Error ? error.message : 'Invalid payment amount'
    };
  }
}

/**
 * Format BLOK and house number for display
 * Example: "C11" and "9" becomes "C11/9"
 * @param blok - The BLOK identifier
 * @param houseNumber - The house number
 * @returns Formatted BLOK and house number
 */
export function formatBlokAndHouseNumber(blok: string, houseNumber: string): string {
  if (!blok || !houseNumber) {
    return '';
  }
  return `${blok}/${houseNumber}`;
}