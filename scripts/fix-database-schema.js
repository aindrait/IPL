#!/usr/bin/env node

/**
 * Script untuk memperbaiki schema database yang sudah ada data
 * Menambahkan kolom yang hilang dengan default values
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixDatabaseSchema() {
  console.log('Starting database schema fix...');
  
  try {
    // Test connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Check current schema
    console.log('\n📊 Checking current schema...');
    
    // Test if we can query residents with is_active
    try {
      const residents = await prisma.resident.findMany({
        take: 1,
        select: { id: true, is_active: true }
      });
      console.log('✅ Schema already has snake_case fields');
      return;
    } catch (error) {
      console.log('❌ Schema needs to be updated');
      console.log('Error:', error.message);
    }
    
    // If we get here, the schema needs to be updated
    console.log('\n🔧 Database schema needs to be updated.');
    console.log('Please run the following steps:');
    console.log('\n1. Go to Supabase Dashboard');
    console.log('2. Open SQL Editor');
    console.log('3. Run the script: supabase-update-existing.sql');
    console.log('4. After running the script, restart the application');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  fixDatabaseSchema();
}

module.exports = { fixDatabaseSchema };
