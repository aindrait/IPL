const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('Starting Vercel build process...');

  try {
    // Copy production schema to main schema file
    console.log('Setting up production schema...');
    if (process.platform === 'win32') {
      execSync('copy prisma\\schema.prisma.production prisma\\schema.prisma', { stdio: 'inherit' });
    } else {
      execSync('cp prisma/schema.prisma.production prisma/schema.prisma', { stdio: 'inherit' });
    }

    // Generate Prisma Client
    console.log('Generating Prisma Client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Build Next.js application
    console.log('Building Next.js application...');
    execSync('npx next build', { stdio: 'inherit' });

    // Try to connect to the database and check if tables exist
    console.log('Checking database connection...');
    const prisma = new PrismaClient();
    
    try {
      await prisma.$connect();
      console.log('Database connection successful');
      
      // Check if users table exists
      try {
        await prisma.user.findFirst();
        console.log('Database tables already exist, skipping migration');
      } catch (error) {
        console.log('Database tables do not exist, running migration...');
        execSync('npx prisma db push', { stdio: 'inherit' });
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