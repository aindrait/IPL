#!/usr/bin/env node

/**
 * Script untuk test API dashboard
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testDashboard() {
  console.log('🧪 Testing dashboard API...');
  
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    
    // Test query yang sama seperti di dashboard API
    console.log('\n📊 Testing residents count...');
    const totalResidents = await prisma.resident.count({
      where: { is_active: true }
    });
    console.log('✅ Total residents:', totalResidents);
    
    // Test payment periods
    console.log('\n📊 Testing payment periods...');
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    let currentPeriod = await prisma.paymentPeriod.findFirst({
      where: { 
        month: currentMonth,
        year: currentYear,
        is_active: true 
      }
    });
    console.log('✅ Current period:', currentPeriod);
    
    // Test payments
    console.log('\n📊 Testing payments...');
    const paymentsStats = await prisma.payment.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { amount: true },
      where: currentPeriod
        ? { schedule_items: { some: { period_id: currentPeriod.id } } }
        : {}
    });
    console.log('✅ Payments stats:', paymentsStats);
    
    console.log('\n🎉 All tests passed! Dashboard should work now.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testDashboard();
}

module.exports = { testDashboard };
