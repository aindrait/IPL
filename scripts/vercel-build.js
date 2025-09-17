const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

async function main() {
  console.log('Starting Vercel build process...');

  try {
    // Check if we have the required environment variables
    if (!process.env.POSTGRES_PRISMA_URL) {
      console.log('POSTGRES_PRISMA_URL not found in environment variables');
      console.log('This is expected in local development. In Vercel, make sure to set this variable in the dashboard.');
      process.exit(0);
    }

    // Generate Prisma Client with production schema
    console.log('Generating Prisma Client...');
    execSync('npx prisma generate --schema=prisma/schema.prisma.production', { stdio: 'inherit' });

    // Build Next.js application
    console.log('Building Next.js application...');
    execSync('npx next build', { stdio: 'inherit' });

    // Try to connect to the database and check if tables exist
    console.log('Checking database connection...');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.POSTGRES_PRISMA_URL
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
        execSync('npx prisma migrate deploy --schema=prisma/schema.prisma.production', { stdio: 'inherit' });
      } catch (error) {
        console.log('Database tables do not exist, running initial migration...');
        execSync('npx prisma migrate deploy --schema=prisma/schema.prisma.production', { stdio: 'inherit' });
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