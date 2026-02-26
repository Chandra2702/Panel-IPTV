const { initDatabase, pool } = require('../src/config/database');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runInit() {
    console.log('🔄 Starting database initialization...');
    try {
        await initDatabase();
        console.log('✅ Initialization complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Initialization failed:', err);
        process.exit(1);
    }
}

runInit();
