#!/usr/bin/env node

/**
 * Script untuk memperbaiki semua field names dari camelCase ke snake_case
 * di semua file TypeScript/JavaScript
 */

const fs = require('fs');
const path = require('path');

// Mapping field names dari camelCase ke snake_case
const fieldMappings = {
  // User fields
  'createdAt': 'created_at',
  'updatedAt': 'updated_at',
  
  // Resident fields
  'houseNumber': 'house_number',
  'paymentIndex': 'payment_index',
  'isActive': 'is_active',
  'createdById': 'created_by_id',
  'rtId': 'rt_id',
  
  // Payment fields
  'paymentDate': 'payment_date',
  'paymentMethod': 'payment_method',
  'residentId': 'resident_id',
  
  // PaymentProof fields
  'filePath': 'file_path',
  'fileSize': 'file_size',
  'mimeType': 'mime_type',
  'analysisResult': 'analysis_result',
  'paymentId': 'payment_id',
  
  // PaymentSchedule fields
  'startDate': 'start_date',
  'endDate': 'end_date',
  'periodId': 'period_id',
  
  // PaymentScheduleItem fields
  'dueDate': 'due_date',
  'paidDate': 'paid_date',
  'scheduleId': 'schedule_id',
  
  // BankMutation fields
  'transactionDate': 'transaction_date',
  'referenceNumber': 'reference_number',
  'transactionType': 'transaction_type',
  'isOmitted': 'is_omitted',
  'omitReason': 'omit_reason',
  'isVerified': 'is_verified',
  'verifiedAt': 'verified_at',
  'verifiedBy': 'verified_by',
  'matchedPaymentId': 'matched_payment_id',
  'matchedResidentId': 'matched_resident_id',
  'matchScore': 'match_score',
  'matchingStrategy': 'matching_strategy',
  'rawData': 'raw_data',
  'uploadBatch': 'upload_batch',
  'fileName': 'file_name',
  
  // Other fields
  'sentAt': 'sent_at',
  'sentVia': 'sent_via',
  'verificationData': 'verification_data',
  'previousMatchedPaymentId': 'previous_matched_payment_id',
  'newMatchedPaymentId': 'new_matched_payment_id',
  'namePatterns': 'name_patterns',
  'addressPatterns': 'address_patterns',
  'transactionPatterns': 'transaction_patterns',
  'confidenceScores': 'confidence_scores',
  'lastUpdated': 'last_updated',
  'bankName': 'bank_name',
  'lastSeen': 'last_seen',
  'mutationId': 'mutation_id'
};

// Function untuk mengupdate content
function updateContent(content) {
  let updatedContent = content;
  
  // Update field names dalam Prisma queries
  for (const [camelCase, snakeCase] of Object.entries(fieldMappings)) {
    // Pattern untuk field names dalam Prisma queries (tanpa quotes)
    const prismaPattern = new RegExp(`\\b${camelCase}\\b`, 'g');
    updatedContent = updatedContent.replace(prismaPattern, snakeCase);
    
    // Pattern untuk field names dalam raw SQL (dengan quotes)
    const sqlPattern = new RegExp(`"${camelCase}"`, 'g');
    updatedContent = updatedContent.replace(sqlPattern, snakeCase);
  }
  
  return updatedContent;
}

// Function untuk mencari file secara recursive
function findFiles(dir, extensions) {
  let files = [];
  
  try {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip node_modules dan .git
        if (item !== 'node_modules' && item !== '.git' && item !== '.next') {
          files = files.concat(findFiles(fullPath, extensions));
        }
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }
  
  return files;
}

// Function untuk memproses file
function processFile(filePath) {
  try {
    console.log(`Processing: ${filePath}`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    const updatedContent = updateContent(content);
    
    if (content !== updatedContent) {
      // Backup file asli
      const backupPath = filePath + '.backup';
      fs.writeFileSync(backupPath, content);
      console.log(`  Backup created: ${backupPath}`);
      
      // Write updated content
      fs.writeFileSync(filePath, updatedContent);
      console.log(`  Updated: ${filePath}`);
    } else {
      console.log(`  No changes needed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Main execution
function main() {
  console.log('Starting field names migration...');
  
  // Find all TypeScript and JavaScript files in src directory
  const srcDir = path.join(__dirname, '..', 'src');
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  
  const files = findFiles(srcDir, extensions);
  
  console.log(`Found ${files.length} files to process`);
  
  files.forEach(processFile);
  
  console.log('Field names migration completed!');
  console.log('\nNext steps:');
  console.log('1. Review the changes in each file');
  console.log('2. Test the application');
  console.log('3. Remove .backup files if everything works correctly');
}

if (require.main === module) {
  main();
}

module.exports = { updateContent, fieldMappings };