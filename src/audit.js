// Security log. Every time someone views or changes patient information, a line is added.
// The log is append-only: there is no code anywhere that edits or deletes its rows.
const { query } = require('./db');

// e = { action, entity, entityId, patientId, details, user? }
async function audit(req, e) {
  try {
    const u = e.user || (req.session && req.session.user) || {};
    await query(
      `INSERT INTO audit_log (user_id, user_name, role, action, entity, entity_id, patient_id, patient_name, details, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
               (SELECT us.full_name FROM patients p JOIN users us ON us.id = p.user_id WHERE p.id = $7::int), $8, $9)`,
      [u.id || null, u.name || null, u.role || null, e.action, e.entity || null, e.entityId || null,
       e.patientId || null, e.details ? String(e.details).slice(0, 300) : null, String(req.ip || '').slice(0, 60)]);
  } catch (err) {
    console.error('audit log failed:', err.message); // never break the real request because of logging
  }
}

module.exports = { audit };
