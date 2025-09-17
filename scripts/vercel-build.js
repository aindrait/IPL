const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

async function main() {
  console.log('Starting Vercel build process...');

  try {
    // Load Vercel environment variables for testing
    const vercelEnv = dotenv.config({ path: '.env.vercel' });
    
    // Set environment variables for Prisma
    if (vercelEnv.parsed) {
      process.env.DATABASE_URL = vercelEnv.parsed.DATABASE_URL;
    }

    // Check if we have the required environment variables
    if (!process.env.DATABASE_URL) {
      console.log('DATABASE_URL not found in environment variables');
      console.log('This is expected in local development. In Vercel, make sure to set this variable in the dashboard.');
      process.exit(0);
    }

    // Generate Prisma Client with production schema
    console.log('Generating Prisma Client...');
    execSync('npx prisma generate --schema=prisma/schema.prisma.production', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });

    // Build Next.js application
    console.log('Building Next.js application...');
    execSync('npx next build', { stdio: 'inherit' });

    // Try to connect to the database and check if tables exist
    console.log('Checking database connection...');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    });
    
    try {
      await prisma.$connect();
      console.log('Database connection successful');
      
      // Check if users table exists
      try {
        await prisma.user.findFirst();
        console.log('Database tables already exist, running pending migrations...');
        execSync('npx prisma db push --schema=prisma/schema.prisma.production --accept-data-loss', { stdio: 'inherit' });
      } catch (error) {
        console.log('Database tables do not exist, running initial migration...');
        execSync('npx prisma db push --schema=prisma/schema.prisma.production --accept-data-loss', { stdio: 'inherit' });
      }
    } catch (error) {
      console.log('Database connection failed, skipping migration');
      console.log('Error:', error.message);
    } finally {
      await prisma.$disconnect();
    }

    console.log('Vercel build process completed successfully');
  } catch (error) {
    console.error('Vercel build process failed:', error);
    process.exit(1);
  }
}

main();