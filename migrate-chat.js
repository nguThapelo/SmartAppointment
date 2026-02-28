require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local' });

const { ensureAppointmentChatTable } = require('./server/services/ensureChatTable');

async function runMigration() {
  try {
    console.log('Ensuring appointment chat table exists...');
    await ensureAppointmentChatTable();
    console.log('Chat table migration completed successfully!');
  } catch (error) {
    console.error('Chat table migration failed:', error);
    process.exit(1);
  }
}

runMigration();