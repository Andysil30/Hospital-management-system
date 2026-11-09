// One shared connection pool for the whole app.
require('dotenv').config();
const { Pool, types } = require('pg');

// By default "pg" returns DATE as a JS Date and NUMERIC/COUNT as strings,
// which causes time-zone surprises. These parsers keep things simple:
types.setTypeParser(1082, (v) => v);              // DATE    -> 'YYYY-MM-DD'
types.setTypeParser(1700, (v) => parseFloat(v));  // NUMERIC -> number
types.setTypeParser(20, (v) => parseInt(v, 10));  // BIGINT (COUNT) -> number

const TIMEZONE = (process.env.TIMEZONE || 'Africa/Nairobi').replace(/[^A-Za-z_\/+-]/g, '');

// Every connection uses the hospital's local time zone, so CURRENT_DATE
// and "daily revenue" match the wall clock in the hospital.
// Serverless platforms start many short-lived copies of the app, so keep each
// copy's pool small. If you use a *pooled* cloud connection string (it has
// "-pooler" in the host name) set DB_POOLED=true; those poolers reject the
// start-up time-zone option, so set the zone on the database instead:
//   ALTER DATABASE neondb SET timezone TO 'Africa/Nairobi';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 10000,
  ...(process.env.DB_POOLED === 'true' ? {} : { options: `-c timezone=${TIMEZONE}` }),
});

// Run several queries as ONE all-or-nothing unit (an ACID transaction).
// If anything throws, everything is rolled back.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query: (text, params) => pool.query(text, params), withTransaction };
