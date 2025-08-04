#!/usr/bin/env node
const { execSync } = require('node:child_process');

async function runMigrations() {
  try {
    console.log('⏳ Running migrations...');
    execSync('npx tsx lib/db/migrate.ts', { stdio: 'inherit' });
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigrations();