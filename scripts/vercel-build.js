const { execSync } = require('child_process');

async function main() {
  console.log('Starting Vercel build process...');

  try {
    // Check if we have the required environment variables
    if (!process.env.DATABASE_URL) {
      console.log('DATABASE_URL not found in environment variables');
      console.log('This is expected in local development. In Vercel, make sure to set this variable in the dashboard.');
      process.exit(0);
    }

    // Generate Prisma Client
    console.log('Generating Prisma Client...');
    execSync('npx prisma generate', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });

    // Push schema to database (this will create/update tables if needed)
    console.log('Pushing schema to database...');
    execSync('npx prisma db push', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL }
    });

    // Build Next.js application
    console.log('Building Next.js application...');
    execSync('npx next build', { stdio: 'inherit' });

    console.log('Vercel build process completed successfully');
  } catch (error) {
    console.error('Vercel build process failed:', error);
    process.exit(1);
  }
}

main();