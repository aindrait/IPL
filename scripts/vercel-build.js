const { execSync } = require('child_process');

async function main() {
  console.log('Starting Vercel build process...');

  try {
    // Check if we have the required environment variables
    // Use PRISMA_URL for build operations (port 5432), fallback to DATABASE_URL if PRISMA_URL not available
    const buildDatabaseUrl = process.env.PRISMA_URL || process.env.DATABASE_URL;
    
    if (!buildDatabaseUrl) {
      console.log('Neither PRISMA_URL nor DATABASE_URL found in environment variables');
      console.log('This is expected in local development. In Vercel, make sure to set these variables in the dashboard.');
      process.exit(0);
    }

    console.log('Using database URL for build operations:', process.env.PRISMA_URL ? 'PRISMA_URL (port 5432)' : 'DATABASE_URL (fallback)');

    // Generate Prisma Client
    console.log('Generating Prisma Client...');
    execSync('npx prisma generate', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: buildDatabaseUrl }
    });

    // Push schema to database (this will create/update tables if needed)
    console.log('Pushing schema to database...');
    execSync('npx prisma db push', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: buildDatabaseUrl }
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