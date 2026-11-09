// Creates the owner (admin) account, or resets the password of any existing account.
//   npm run create-admin -- "Owner Name" owner@example.com "A-strong-password"
// Use this on your real/online database instead of the demo accounts.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

(async () => {
  const [name, rawEmail, password] = process.argv.slice(2);
  const email = String(rawEmail || '').trim().toLowerCase();
  try {
    if (!name || !email || !password) throw new Error('Usage: npm run create-admin -- "Full Name" email@example.com "password"');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('That e-mail address does not look valid.');
    if (password.length < 10) throw new Error('Please use a password of at least 10 characters.');
    const hash = await bcrypt.hash(password, 10);
    const existing = await pool.query('SELECT id, role FROM users WHERE email = $1', [email]);
    if (existing.rows.length) {
      await pool.query('UPDATE users SET password_hash = $1, is_active = TRUE WHERE id = $2', [hash, existing.rows[0].id]);
      console.log(`Password reset for the existing ${existing.rows[0].role} account ${email}.`);
    } else {
      await pool.query(`INSERT INTO users (full_name, email, password_hash, role) VALUES ($1,$2,$3,'admin')`, [name, email, hash]);
      console.log(`Owner (admin) account created for ${email}.`);
    }
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
