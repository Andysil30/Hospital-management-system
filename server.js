require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');

const { pool } = require('./src/db');
const { HOME, requireRolePage, requireAjaxHeader } = require('./src/middleware/auth');

if (!process.env.DATABASE_URL || !process.env.SESSION_SECRET) {
  console.error('Missing DATABASE_URL or SESSION_SECRET. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const app = express();
const isProd = process.env.NODE_ENV === 'production';
if (isProd) app.set('trust proxy', 1); // needed when hosted behind an HTTPS proxy

// 1. Security headers. The CSP only lets scripts/styles load from this site
//    and the Bootstrap / Chart.js CDN, which blocks most XSS attacks.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'data:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
}));

// 2. Read JSON request bodies.
app.use(express.json({ limit: '100kb' }));

// 3. Login sessions stored in PostgreSQL (survive server restarts).
app.use(session({
  store: new PgSession({ pool, tableName: 'session' }),
  name: 'connect.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,          // JavaScript in the browser cannot read the cookie
    sameSite: 'lax',         // not sent on cross-site POSTs
    secure: isProd,          // HTTPS only in production
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// 4. Static files (CSS / JS only - the dashboards themselves are protected below).
app.use('/assets', express.static(path.join(__dirname, 'public')));

// 5. API routes. Role checks live inside each router.
app.use('/api', requireAjaxHeader);
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/public', require('./src/routes/public'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/doctor', require('./src/routes/doctor'));
app.use('/api/patient', require('./src/routes/patient'));
app.use('/api/bot', require('./src/routes/bot'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// 6. Pages. The front page is open; each sign-in page is separate; each dashboard needs the right role.
const view = (name) => (req, res) => res.sendFile(path.join(__dirname, 'views', name));
const PORTALS = ['patient', 'doctor', 'owner'];

app.get('/', (req, res, next) => {
  const u = req.session.user;
  if (u) return res.redirect(HOME[u.role]);
  next();
}, view('home.html'));

// /login/patient, /login/doctor, /login/owner use one template, filled in per portal.
app.get('/login/:portal', (req, res) => {
  const portal = req.params.portal;
  if (!PORTALS.includes(portal)) return res.redirect('/');
  const u = req.session.user;
  if (u) return res.redirect(HOME[u.role]);
  fs.readFile(path.join(__dirname, 'views', 'login.html'), 'utf8', (err, html) => {
    if (err) return res.status(500).send('Page unavailable.');
    res.type('html').send(html.split('__PORTAL__').join(portal));
  });
});

app.get('/admin', requireRolePage('admin'), view('admin.html'));
app.get('/doctor', requireRolePage('doctor'), view('doctor.html'));
app.get('/patient', requireRolePage('patient'), view('patient.html'));

// 7. Central error handler - never leak internals to the browser.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
});

// On your computer (npm start) we listen on a port. On Vercel the app is exported
// and Vercel calls it for each request (serverless), so we must NOT call listen().
module.exports = app;
if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => console.log(`Hospital system running at http://localhost:${port}`));
}
