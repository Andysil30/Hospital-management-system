// Laboratory portal: the lab technician sees the tests doctors requested and enters results.
const express = require('express');
const { query, withTransaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../audit');

const router = express.Router();
router.use(requireRole('lab'));

router.get('/requests', async (req, res) => {
  const done = req.query.status === 'completed';
  const { rows } = await query(
    `SELECT r.id, r.status, r.requested_at, r.completed_at, r.clinical_notes, r.result_text, r.result_flag,
            t.name AS test, t.category, t.price,
            u.full_name AS patient, p.gender, EXTRACT(YEAR FROM age(p.date_of_birth))::int AS age,
            du.full_name AS doctor, a.appointment_date AS date
     FROM lab_requests r
     JOIN lab_tests t ON t.id = r.test_id
     JOIN patients p ON p.id = r.patient_id JOIN users u ON u.id = p.user_id
     JOIN doctors d ON d.id = r.doctor_id JOIN users du ON du.id = d.user_id
     JOIN appointments a ON a.id = r.appointment_id
     WHERE r.status = $1 AND ($1 = 'requested' OR r.completed_at > now() - interval '14 days')
     ORDER BY ${done ? 'r.completed_at DESC' : 'r.requested_at'} LIMIT 200`,
    [done ? 'completed' : 'requested']);
  res.json(rows);
});

router.post('/requests/:id/result', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const text = String(req.body.result_text || '').trim().slice(0, 2000);
  const flag = req.body.result_flag;
  if (!text) return res.status(400).json({ error: 'Enter the result.' });
  if (!['normal', 'abnormal'].includes(flag)) return res.status(400).json({ error: 'Mark the result as normal or abnormal.' });

  const out = await withTransaction(async (db) => {
    const r = (await db.query(
      `SELECT r.id, r.appointment_id, r.patient_id, t.name, t.price FROM lab_requests r JOIN lab_tests t ON t.id = r.test_id
       WHERE r.id = $1 AND r.status = 'requested' FOR UPDATE OF r`, [id])).rows[0];
    if (!r) return null;
    await db.query(
      `UPDATE lab_requests SET status = 'completed', result_text = $1, result_flag = $2, completed_at = NOW(), completed_by = $3 WHERE id = $4`,
      [text, flag, req.session.user.id, id]);
    await db.query(`INSERT INTO payments (appointment_id, patient_id, amount, type) VALUES ($1,$2,$3,'lab')`, [r.appointment_id, r.patient_id, r.price]);
    // When every test of this visit is back, the patient returns to the doctor's queue
    const left = (await db.query(`SELECT COUNT(*)::int AS n FROM lab_requests WHERE appointment_id = $1 AND status = 'requested'`, [r.appointment_id])).rows[0].n;
    if (left === 0) await db.query(`UPDATE appointments SET status = 'checked_in' WHERE id = $1 AND status = 'awaiting_lab'`, [r.appointment_id]);
    return { ...r, allDone: left === 0 };
  });
  if (!out) return res.status(400).json({ error: 'This request is not waiting for a result.' });
  await audit(req, { action: 'enter_lab_result', entity: 'lab_request', entityId: id, patientId: out.patient_id, details: `${out.name}: ${flag}` });
  res.json({ ok: true, all_done: out.allDone });
});

module.exports = router;
