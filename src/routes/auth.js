const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const { query, withTransaction } = require('../db');
const { HOME } = require('../middleware/auth');

const router = express.Router();

// Slow down password-guessing: max 10 login attempts / 15 min / IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// A fake hash so a wrong e-mail takes as long as a wrong password
// (prevents attackers from discovering which e-mails are registered).
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Which role may use which sign-in page. (The owner's role is called "admin" in the database.)
const PORTAL_ROLE = { patient: 'patient', doctor: 'doctor', owner: 'admin' };
const ROLE_MESSAGE = {
  patient: 'This is a patient account. Please use the Patient sign-in page.',
  doctor: 'This is a doctor account. Please use the Doctor sign-in page.',
  admin: 'This is an owner account. Please use the Owner sign-in page.',
};

// Replace the session ID on login (prevents "session fixation" attacks).
function startSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.user = { id: user.id, role: user.role, name: user.full_name };
      req.session.save((err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

// ---- Patient self-registration (doctors/admins are created by the admin) ----
router.post('/register', async (req, res) => {
  const { full_name, email, password, phone, date_of_birth, gender, confirmed } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();

  if (!full_name || String(full_name).trim().length < 2) return res.status(400).json({ error: 'Please enter your full name.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: 'Please enter a valid e-mail address.' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(String(phone).trim())) return res.status(400).json({ error: 'Please enter a valid phone number.' });
  // The patient must have seen the review screen and ticked the confirmation box.
  if (confirmed !== true) return res.status(400).json({ error: 'Please confirm that your details are correct.' });

  const hash = await bcrypt.hash(String(password), 10);
  let user;
  try {
    user = await withTransaction(async (db) => {
      const u = await db.query(
        `INSERT INTO users (full_name, email, password_hash, role, phone)
         VALUES ($1,$2,$3,'patient',$4) RETURNING id, full_name, role`,
        [String(full_name).trim(), cleanEmail, hash, String(phone || '').trim() || null]
      );
      await db.query(
        'INSERT INTO patients (user_id, date_of_birth, gender) VALUES ($1,$2,$3)',
        [u.rows[0].id, date_of_birth || null, gender || null]
      );
      return u.rows[0];
    });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That e-mail is already registered.' });
    throw err;
  }
  await startSession(req, user);
  res.status(201).json({ role: user.role, redirect: HOME[user.role] });
});

// ---- Login (all roles) ---------------------------------------------------
router.post('/login', loginLimiter, async (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const password = String((req.body && req.body.password) || '');

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !ok) return res.status(401).json({ error: 'Incorrect e-mail or password.' });
  if (!user.is_active) return res.status(403).json({ error: 'This account has been disabled. Contact the hospital administrator.' });

  // Password is correct. Make sure they are using the sign-in page for THEIR role.
  const portal = String((req.body && req.body.portal) || '');
  if (PORTAL_ROLE[portal] && PORTAL_ROLE[portal] !== user.role) {
    return res.status(403).json({ error: ROLE_MESSAGE[user.role] });
  }

  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
  await startSession(req, user);
  res.json({ role: user.role, redirect: HOME[user.role] });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in.' });
  res.json(req.session.user);
});

module.exports = router;
