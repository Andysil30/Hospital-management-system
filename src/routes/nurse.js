// Nurse / reception portal: triage. The nurse records vitals before the patient sees the doctor.
const express = require('express');
const { query, withTransaction } = require('../db');
const { requireRole } = require('../middleware/auth');
const { audit } = require('../audit');

const router = express.Router();
router.use(requireRole('nurse'));

// Today's patients across all doctors
router.get('/queue', async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.patient_id, to_char(a.start_time,'HH24:MI') AS time, a.status, a.reason,
            u.full_name AS patient, p.gender, EXTRACT(YEAR FROM age(p.date_of_birth))::int AS age,
            p.insurance_provider, p.insurance_status,
            du.full_name AS doctor, dep.name AS department,
            (v.id IS NOT NULL) AS has_vitals,
            v.bp_systolic, v.bp_diastolic, v.temperature_c, v.weight_kg, v.pulse, v.spo2
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = p.user_id
     JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
     JOIN departments dep ON dep.id = d.department_id
     LEFT JOIN vitals v ON v.appointment_id = a.id
     WHERE a.appointment_date = CURRENT_DATE AND a.status IN ('booked','checked_in','awaiting_lab')
     ORDER BY a.start_time, u.full_name`);
  res.json(rows);
});

const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));

router.post('/vitals', async (req, res) => {
  const b = req.body;
  const appointmentId = parseInt(b.appointment_id, 10);
  const v = {
    sys: num(b.bp_systolic), dia: num(b.bp_diastolic), temp: num(b.temperature_c),
    kg: num(b.weight_kg), pulse: num(b.pulse), spo2: num(b.spo2),
  };
  const inRange = (x, lo, hi) => x === null || (Number.isFinite(x) && x >= lo && x <= hi);
  if (v.sys === null && v.dia === null && v.temp === null && v.kg === null && v.pulse === null && v.spo2 === null) {
    return res.status(400).json({ error: 'Enter at least one measurement.' });
  }
  if ((v.sys === null) !== (v.dia === null)) return res.status(400).json({ error: 'Enter both blood pressure numbers (top and bottom).' });
  if (!inRange(v.sys, 40, 300) || !inRange(v.dia, 20, 200) || (v.sys !== null && v.dia >= v.sys)) return res.status(400).json({ error: 'Blood pressure looks wrong. The top number must be higher than the bottom number.' });
  if (!inRange(v.temp, 30, 45)) return res.status(400).json({ error: 'Temperature must be between 30 and 45 degrees C.' });
  if (!inRange(v.kg, 0.5, 400)) return res.status(400).json({ error: 'Weight must be between 0.5 and 400 kg.' });
  if (!inRange(v.pulse, 20, 260)) return res.status(400).json({ error: 'Pulse must be between 20 and 260 beats per minute.' });
  if (!inRange(v.spo2, 50, 100)) return res.status(400).json({ error: 'Oxygen saturation must be between 50 and 100%.' });

  const out = await withTransaction(async (db) => {
    const a = (await db.query(
      `SELECT id, patient_id, status FROM appointments
       WHERE id = $1 AND appointment_date = CURRENT_DATE AND status IN ('booked','checked_in','awaiting_lab') FOR UPDATE`, [appointmentId])).rows[0];
    if (!a) return null;
    const existed = (await db.query('SELECT 1 FROM vitals WHERE appointment_id = $1', [a.id])).rows.length > 0;
    await db.query(
      `INSERT INTO vitals (appointment_id, patient_id, recorded_by, bp_systolic, bp_diastolic, temperature_c, weight_kg, pulse, spo2, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (appointment_id) DO UPDATE SET recorded_by = EXCLUDED.recorded_by, bp_systolic = EXCLUDED.bp_systolic,
         bp_diastolic = EXCLUDED.bp_diastolic, temperature_c = EXCLUDED.temperature_c, weight_kg = EXCLUDED.weight_kg,
         pulse = EXCLUDED.pulse, spo2 = EXCLUDED.spo2, notes = EXCLUDED.notes, recorded_at = NOW()`,
      [a.id, a.patient_id, req.session.user.id, v.sys, v.dia, v.temp, v.kg, v.pulse, v.spo2, String(b.notes || '').trim().slice(0, 500) || null]);
    // Recording vitals means the patient has arrived
    if (a.status === 'booked') await db.query(`UPDATE appointments SET status = 'checked_in' WHERE id = $1`, [a.id]);
    return { id: a.id, patientId: a.patient_id, existed };
  });
  if (!out) return res.status(400).json({ error: "This appointment is not open for triage today." });
  await audit(req, { action: out.existed ? 'update_vitals' : 'record_vitals', entity: 'vitals', entityId: out.id, patientId: out.patientId,
    details: `BP ${v.sys ?? '-'}/${v.dia ?? '-'}, temp ${v.temp ?? '-'}, pulse ${v.pulse ?? '-'}` });
  res.status(201).json({ ok: true });
});

module.exports = router;
