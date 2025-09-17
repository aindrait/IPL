const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

async function testConnection() {
  console.log('Testing database connection to Supabase...');
  
  // Load Vercel environment variables for testing
  const vercelEnv = dotenv.config({ path: '.env.vercel' });
  
  // Set environment variables
  if (vercelEnv.parsed) {
    process.env.POSTGRES_PRISMA_URL = vercelEnv.parsed.POSTGRES_PRISMA_URL;
    process.env.DATABASE_URL = vercelEnv.parsed.DATABASE_URL;
  }
  
  console.log('Environment variables loaded from .env.vercel');
  
  // Create a direct PostgreSQL connection using the pooler URL
  const { Client } = require('pg');
  
  // Modify connection string to handle SSL issues
  let connectionString = process.env.POSTGRES_PRISMA_URL;
  if (connectionString.includes('sslmode=require')) {
    connectionString = connectionString.replace('sslmode=require', 'sslmode=no-verify');
  }
  
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    // Log the connection string (without password)
    const connectionString = process.env.POSTGRES_PRISMA_URL;
    console.log('🔗 Connection string (masked):', connectionString.replace(/:[^:]*@/, ':***@'));
    
    // Test basic connection
    await client.connect();
    console.log('✅ Database connection successful');
    
    // List all tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Existing tables:');
    if (result.rows.length === 0) {
      console.log('   No tables found');
    } else {
      result.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    }
    
    // Create a test table
    console.log('\n🔨 Creating test table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS test (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Test table created successfully');
    
    // Insert a test record
    await client.query(`
      INSERT INTO test (name) VALUES ('Test Connection')
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Test record inserted');
    
    // Query the test table
    const testResult = await client.query('SELECT * FROM test;');
    console.log('\n📝 Test table contents:');
    testResult.rows.forEach(row => {
      console.log(`   ID: ${row.id}, Name: ${row.name}, Created: ${row.created_at}`);
    });
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

testConnection();