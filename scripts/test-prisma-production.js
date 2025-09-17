const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

async function testPrismaProduction() {
  console.log('Testing Prisma with production environment...');
  
  // Load Vercel environment variables for testing
  const vercelEnv = dotenv.config({ path: '.env.vercel' });
  
  // Set environment variables
  if (vercelEnv.parsed) {
    process.env.POSTGRES_PRISMA_URL = vercelEnv.parsed.POSTGRES_PRISMA_URL;
    process.env.DATABASE_URL = vercelEnv.parsed.DATABASE_URL;
  }
  
  console.log('Environment variables loaded from .env.vercel');
  console.log('Connection string (masked):', process.env.POSTGRES_PRISMA_URL.replace(/:[^:]*@/, ':***@'));
  
  // Create Prisma client with production schema
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.POSTGRES_PRISMA_URL
      }
    }
  });
  
  try {
    // Test connection
    console.log('\n🔌 Testing Prisma connection...');
    await prisma.$connect();
    console.log('✅ Prisma connection successful');
    
    // Check if tables exist
    console.log('\n📋 Checking existing tables...');
    try {
      const users = await prisma.user.findMany();
      console.log(`   Found ${users.length} users`);
    } catch (error) {
      console.log('   Users table does not exist or is not accessible');
    }
    
    // Test query
    console.log('\n🔍 Testing simple query...');
    try {
      const result = await prisma.$queryRaw`SELECT current_database(), current_user`;
      console.log('   Database info:', result[0]);
    } catch (error) {
      console.log('   Query failed:', error.message);
    }
    
    // Test creating a simple table directly with SQL
    console.log('\n🔨 Creating test table with Prisma raw query...');
    try {
      await prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS prisma_test (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `;
      console.log('✅ Test table created successfully');
      
      // Insert test data
      await prisma.$executeRaw`
        INSERT INTO prisma_test (name) VALUES ('Prisma Test') 
        ON CONFLICT DO NOTHING;
      `;
      console.log('✅ Test data inserted');
      
      // Query test data
      const testData = await prisma.$queryRaw`SELECT * FROM prisma_test;`;
      console.log('\n📝 Test table contents:');
      testData.forEach(row => {
        console.log(`   ID: ${row.id}, Name: ${row.name}, Created: ${row.created_at}`);
      });
    } catch (error) {
      console.log('❌ Failed to create test table:', error.message);
    }
    
    // Test Prisma migration with accept-data-loss flag
    console.log('\n🚀 Testing Prisma migration...');
    try {
      const { execSync } = require('child_process');
      execSync('npx prisma db push --schema=prisma/schema.prisma.production --accept-data-loss', {
        stdio: 'inherit',
        env: { ...process.env, POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL }
      });
      console.log('✅ Prisma db push completed');
    } catch (error) {
      console.log('❌ Prisma db push failed:', error.message);
    }
    
    // Check if Prisma tables were created
    console.log('\n🔍 Checking if Prisma tables were created...');
    try {
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name LIKE 'users' OR table_name LIKE 'residents' OR table_name LIKE 'payments'
        ORDER BY table_name;
      `;
      
      console.log('📋 Found Prisma tables:');
      if (tables.length === 0) {
        console.log('   No Prisma tables found');
      } else {
        tables.forEach(table => {
          console.log(`   - ${table.table_name}`);
        });
      }
    } catch (error) {
      console.log('❌ Failed to check tables:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Prisma test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrismaProduction();