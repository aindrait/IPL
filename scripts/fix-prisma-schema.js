#!/usr/bin/env node

/**
 * Script untuk memperbaiki Prisma schema
 * Menghapus @map() yang tidak perlu karena database sudah menggunakan snake_case
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

function fixPrismaSchema() {
  console.log('🔧 Fixing Prisma schema...');
  
  try {
    let content = fs.readFileSync(schemaPath, 'utf8');
    
    // Remove @map() for field names that are already snake_case
    const fieldMappings = [
      // User fields
      { from: '@map("createdAt")', to: '' },
      { from: '@map("updatedAt")', to: '' },
      
      // Resident fields
      { from: '@map("houseNumber")', to: '' },
      { from: '@map("paymentIndex")', to: '' },
      { from: '@map("isActive")', to: '' },
      { from: '@map("createdAt")', to: '' },
      { from: '@map("updatedAt")', to: '' },
      { from: '@map("createdById")', to: '' },
      { from: '@map("rtId")', to: '' },
      
      // Payment fields
      { from: '@map("paymentDate")', to: '' },
      { from: '@map("paymentMethod")', to: '' },
      { from: '@map("createdAt")', to: '' },
      { from: '@map("updatedAt")', to: '' },
      { from: '@map("residentId")', to: '' },
      { from: '@map("createdById")', to: '' },
      
      // PaymentProof fields
      { from: '@map("filePath")', to: '' },
      { from: '@map("fileSize")', to: '' },
      { from: '@map("mimeType")', to: '' },
      { from: '@map("analysisResult")', to: '' },
      { from: '@map("createdAt")', to: '' },
      { from: '@map("paymentId")', to: '' },
      
      // PaymentSchedule fields
      { from: '@map("startDate")', to: '' },
      { from: '@map("endDate")', to: '' },
      { from: '@map("isActive")', to: '' },
      { from: '@map("createdAt")', to: '' },
      { from: '@map("updatedAt")', to: '' },
      { from: '@map("periodId")', to: '' },
      { from: '@map("createdById")', to: '' },
      
      // PaymentScheduleItem fields
      { from: '@map("dueDate")', to: '' },
      { from: '@map("paidDate")', to: '' },
      { from: '@map("createdAt")', to: '' },
      { from: '@map("updatedAt")', to: '' },
      { from: '@map("scheduleId")', to: '' },
      { from: '@map("periodId")', to: '' },
      { from: '@map("residentId")', to: '' },
      { from: '@map("paymentId")', to: '' },
      
      // BankMutation fields
      { from: '@map("transactionDate")', to: '' },
      { from: '@map("referenceNumber")', to: '' },
      { from: '@map("transactionType")', to: '' },
      { from: '@map("isOmitted")', to: '' },
      { from: '@map("omitReason")', to: '' },
      { from: '@map("isVerified")', to: '' },
      { from: '@map("verifiedAt")', to: '' },
      { from: '@map("verifiedBy")', to: '' },
      { from: '@map("matchedPaymentId")', to: '' },
      { from: '@map("matchedResidentId")', to: '' },
      { from: '@map("matchScore")', to: '' },
      { from: '@map("matchingStrategy")', to: '' },
      { from: '@map("rawData")', to: '' },
      { from: '@map("uploadBatch")', to: '' },
      { from: '@map("fileName")', to: '' },
      { from: '@map("createdAt")', to: '' },
      { from: '@map("updatedAt")', to: '' },
      
      // Other fields
      { from: '@map("sentAt")', to: '' },
      { from: '@map("sentVia")', to: '' },
      { from: '@map("verificationData")', to: '' },
      { from: '@map("previousMatchedPaymentId")', to: '' },
      { from: '@map("newMatchedPaymentId")', to: '' },
      { from: '@map("namePatterns")', to: '' },
      { from: '@map("addressPatterns")', to: '' },
      { from: '@map("transactionPatterns")', to: '' },
      { from: '@map("confidenceScores")', to: '' },
      { from: '@map("lastUpdated")', to: '' },
      { from: '@map("bankName")', to: '' },
      { from: '@map("lastSeen")', to: '' },
      { from: '@map("mutationId")', to: '' },
      { from: '@map("residentId")', to: '' },
      { from: '@map("isVerified")', to: '' },
      { from: '@map("createdAt")', to: '' },
      { from: '@map("updatedAt")', to: '' },
      { from: '@map("paymentId")', to: '' },
      { from: '@map("verifiedBy")', to: '' },
      { from: '@map("isActive")', to: '' },
      { from: '@map("createdAt")', to: '' },
      { from: '@map("updatedAt")', to: '' },
      { from: '@map("dueDate")', to: '' },
      { from: '@map("isActive")', to: '' },
      { from: '@map("createdAt")', to: '' },
      { from: '@map("updatedAt")', to: '' }
    ];
    
    // Apply all mappings
    fieldMappings.forEach(mapping => {
      content = content.replace(new RegExp(mapping.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), mapping.to);
    });
    
    // Write updated content
    fs.writeFileSync(schemaPath, content);
    console.log('✅ Prisma schema updated successfully');
    
    console.log('\n📋 Next steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart the application');
    console.log('3. Test the dashboard');
    
  } catch (error) {
    console.error('❌ Error fixing Prisma schema:', error.message);
  }
}

if (require.main === module) {
  fixPrismaSchema();
}

module.exports = { fixPrismaSchema };
