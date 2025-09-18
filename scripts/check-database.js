#!/usr/bin/env node

/**
 * Script untuk mengecek status database dan memberikan solusi
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Checking database status...');
  
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test query dengan field lama
    console.log('\n📊 Testing with old field names...');
    try {
      const residentsOld = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM residents 
        WHERE "isActive" = true
      `;
      console.log('✅ Old field names still exist:', residentsOld);
    } catch (error) {
      console.log('❌ Old field names not found:', error.message);
    }
    
    // Test query dengan field baru
    console.log('\n📊 Testing with new field names...');
    try {
      const residentsNew = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM residents 
        WHERE is_active = true
      `;
      console.log('✅ New field names exist:', residentsNew);
    } catch (error) {
      console.log('❌ New field names not found:', error.message);
    }
    
    // Cek struktur tabel residents
    console.log('\n📋 Checking residents table structure...');
    try {
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'residents' 
        AND table_schema = 'public'
        ORDER BY column_name
      `;
      console.log('📊 Residents table columns:');
      columns.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    } catch (error) {
      console.log('❌ Error checking table structure:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  checkDatabase();
}

module.exports = { checkDatabase };
