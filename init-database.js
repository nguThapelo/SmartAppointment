#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running ${scriptName}...\n`);

    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: __dirname
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptName} completed successfully\n`);
        resolve();
      } else {
        console.error(`❌ ${scriptName} failed with exit code ${code}`);
        reject(new Error(`${scriptName} failed`));
      }
    });

    child.on('error', (error) => {
      console.error(`❌ Error running ${scriptName}:`, error);
      reject(error);
    });
  });
}

async function setupDatabase() {
  try {
    console.log('🔧 SmartAppointment Database Setup');
    console.log('==================================\n');

    // Step 1: Set up database schema
    await runScript('setup-database.js');

    // Step 2: Seed with initial data
    await runScript('seed-database.js');

    console.log('🎉 Database setup and seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log('  ✅ All database tables created');
    console.log('  ✅ Indexes created for performance');
    console.log('  ✅ Initial data seeded');
    console.log('  ✅ Service categories added');
    console.log('  ✅ Master data configured');
    console.log('  ✅ Feedback system ready');
    console.log('\n🚀 You can now start your server with: npm run dev');

  } catch (error) {
    console.error('\n💥 Database setup failed:', error.message);
    console.log('\n🔍 Troubleshooting:');
    console.log('  1. Check your .env file has DATABASE_URL set');
    console.log('  2. Ensure your database is accessible');
    console.log('  3. Check database user has CREATE TABLE permissions');
    console.log('  4. Verify SUPABASE_SERVICE_ROLE_KEY is set for seeding');
    process.exit(1);
  }
}

setupDatabase();