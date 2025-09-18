#!/usr/bin/env node

/**
 * Script untuk memperbaiki Prisma schema relations
 * Mengubah field names di relations dari camelCase ke snake_case
 */

const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

function fixPrismaRelations() {
  console.log('🔧 Fixing Prisma schema relations...');
  
  try {
    let content = fs.readFileSync(schemaPath, 'utf8');
    
    // Field mappings untuk relations
    const relationMappings = [
      // User relations
      { from: 'residents Resident[]', to: 'residents Resident[]' },
      { from: 'payments  Payment[]', to: 'payments  Payment[]' },
      { from: 'reminders Reminder[]', to: 'reminders Reminder[]' },
      { from: 'paymentSchedules PaymentSchedule[]', to: 'payment_schedules PaymentSchedule[]' },
      
      // Resident relations
      { from: 'createdBy    User     @relation(fields: [created_by_id], references: [id])', to: 'created_by    User     @relation(fields: [created_by_id], references: [id])' },
      { from: 'payments     Payment[]', to: 'payments     Payment[]' },
      { from: 'reminders    Reminder[]', to: 'reminders    Reminder[]' },
      { from: 'rtRelation   RT?      @relation(fields: [rt_id], references: [id])', to: 'rt_relation   RT?      @relation(fields: [rt_id], references: [id])' },
      { from: 'scheduleItems PaymentScheduleItem[]', to: 'schedule_items PaymentScheduleItem[]' },
      { from: 'bankAliases  ResidentBankAlias[]', to: 'bank_aliases  ResidentBankAlias[]' },
      { from: 'bankMutations BankMutation[]', to: 'bank_mutations BankMutation[]' },
      
      // PaymentPeriod relations
      { from: 'schedules PaymentSchedule[]', to: 'schedules PaymentSchedule[]' },
      { from: 'scheduleItems PaymentScheduleItem[]', to: 'schedule_items PaymentScheduleItem[]' },
      
      // Payment relations
      { from: 'resident   Resident      @relation(fields: [resident_id], references: [id])', to: 'resident   Resident      @relation(fields: [resident_id], references: [id])' },
      { from: 'createdBy  User          @relation(fields: [created_by_id], references: [id])', to: 'created_by  User          @relation(fields: [created_by_id], references: [id])' },
      { from: 'proofs     PaymentProof[]', to: 'proofs     PaymentProof[]' },
      { from: 'scheduleItems PaymentScheduleItem[]', to: 'schedule_items PaymentScheduleItem[]' },
      { from: 'verifications PaymentVerification[]', to: 'verifications PaymentVerification[]' },
      { from: 'bankMutations BankMutation[]', to: 'bank_mutations BankMutation[]' },
      
      // PaymentProof relations
      { from: 'payment Payment @relation(fields: [payment_id], references: [id])', to: 'payment Payment @relation(fields: [payment_id], references: [id])' },
      
      // Reminder relations
      { from: 'resident Resident @relation(fields: [resident_id], references: [id])', to: 'resident Resident @relation(fields: [resident_id], references: [id])' },
      { from: 'createdBy User     @relation(fields: [created_by_id], references: [id])', to: 'created_by User     @relation(fields: [created_by_id], references: [id])' },
      
      // PaymentSchedule relations
      { from: 'period     PaymentPeriod @relation(fields: [period_id], references: [id])', to: 'period     PaymentPeriod @relation(fields: [period_id], references: [id])' },
      { from: 'createdBy  User          @relation(fields: [created_by_id], references: [id])', to: 'created_by  User          @relation(fields: [created_by_id], references: [id])' },
      { from: 'items      PaymentScheduleItem[]', to: 'items      PaymentScheduleItem[]' },
      
      // PaymentScheduleItem relations
      { from: 'schedule     PaymentSchedule            @relation(fields: [schedule_id], references: [id])', to: 'schedule     PaymentSchedule            @relation(fields: [schedule_id], references: [id])' },
      { from: 'period       PaymentPeriod              @relation(fields: [period_id], references: [id])', to: 'period       PaymentPeriod              @relation(fields: [period_id], references: [id])' },
      { from: 'resident     Resident                   @relation(fields: [resident_id], references: [id])', to: 'resident     Resident                   @relation(fields: [resident_id], references: [id])' },
      { from: 'payment      Payment?                   @relation(fields: [payment_id], references: [id])', to: 'payment      Payment?                   @relation(fields: [payment_id], references: [id])' },
      
      // RT relations
      { from: 'residents Resident[]', to: 'residents Resident[]' },
      
      // PaymentVerification relations
      { from: 'payment Payment @relation(fields: [payment_id], references: [id], onDelete: Cascade)', to: 'payment Payment @relation(fields: [payment_id], references: [id], onDelete: Cascade)' },
      
      // BankMutation relations
      { from: 'matchedPayment  Payment? @relation(fields: [matched_payment_id], references: [id])', to: 'matched_payment  Payment? @relation(fields: [matched_payment_id], references: [id])' },
      { from: 'matchedResident Resident? @relation(fields: [matched_resident_id], references: [id])', to: 'matched_resident Resident? @relation(fields: [matched_resident_id], references: [id])' },
      { from: 'verificationHistory BankMutationVerification[]', to: 'verification_history BankMutationVerification[]' },
      
      // BankMutationVerification relations
      { from: 'mutation      BankMutation @relation(fields: [mutation_id], references: [id], onDelete: Cascade)', to: 'mutation      BankMutation @relation(fields: [mutation_id], references: [id], onDelete: Cascade)' },
      
      // ResidentBankAlias relations
      { from: 'resident    Resident @relation(fields: [resident_id], references: [id], onDelete: Cascade)', to: 'resident    Resident @relation(fields: [resident_id], references: [id], onDelete: Cascade)' }
    ];
    
    // Apply all mappings
    relationMappings.forEach(mapping => {
      const regex = new RegExp(mapping.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      content = content.replace(regex, mapping.to);
    });
    
    // Write updated content
    fs.writeFileSync(schemaPath, content);
    console.log('✅ Prisma schema relations updated successfully');
    
    console.log('\n📋 Next steps:');
    console.log('1. Run: npx prisma generate');
    console.log('2. Restart the application');
    console.log('3. Test the dashboard');
    
  } catch (error) {
    console.error('❌ Error fixing Prisma schema relations:', error.message);
  }
}

if (require.main === module) {
  fixPrismaRelations();
}

module.exports = { fixPrismaRelations };
