// Creates all tables.  Run with:  npm run db:init
// Add --reset to wipe EVERYTHING first (development only):  npm run db:reset
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

(async () => {
  try {
    if (process.argv.includes('--reset')) {
      console.log('Resetting database (dropping all tables)...');
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    }
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('Database schema is ready.');
  } catch (err) {
    console.error('Could not set up the database:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
