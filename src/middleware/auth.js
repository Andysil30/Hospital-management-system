// ---------------------------------------------------------------------
// RBAC building blocks.
//   requireRole('admin')            -> for JSON API routes (401 / 403 errors)
//   requireRolePage('doctor')       -> for HTML pages (redirects to login)
// The check happens on the SERVER for every request. Hiding a button in the
// browser is only cosmetics; this is the real lock on the door.
// ---------------------------------------------------------------------
const { query } = require('../db');

const HOME = { admin: '/admin', doctor: '/doctor', patient: '/patient' };

function requireRole(...roles) {
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return res.status(401).json({ error: 'Please log in first.' });
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that.' });
    }
    next();
  };
}

function requireRolePage(...roles) {
  return (req, res, next) => {
    const user = req.session && req.session.user;
    if (!user) return res.redirect('/');
    if (!roles.includes(user.role)) return res.redirect(HOME[user.role] || '/');
    next();
  };
}

// Looks up the doctors.id (or patients.id) that belongs to the logged-in user
// and stores it on req so route handlers can use it safely.
async function loadDoctor(req, res, next) {
  const { rows } = await query('SELECT id FROM doctors WHERE user_id = $1', [req.session.user.id]);
  if (!rows.length) return res.status(403).json({ error: 'No doctor profile found for this account.' });
  req.doctorId = rows[0].id;
  next();
}

async function loadPatient(req, res, next) {
  const { rows } = await query('SELECT id FROM patients WHERE user_id = $1', [req.session.user.id]);
  if (!rows.length) return res.status(403).json({ error: 'No patient profile found for this account.' });
  req.patientId = rows[0].id;
  next();
}

// Simple CSRF defence: browsers cannot add custom headers to cross-site
// requests without permission, so we require one on every write request.
function requireAjaxHeader(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.get('X-Requested-With') !== 'fetch') {
    return res.status(400).json({ error: 'Invalid request.' });
  }
  next();
}

module.exports = { HOME, requireRole, requireRolePage, loadDoctor, loadPatient, requireAjaxHeader };
