// Module C - Patient portal.  Every query is filtered by req.patientId,
// so a patient can only ever see THEIR OWN data.
const express = require('express');
const { query } = require('../db');
const { requireRole, loadPatient } = require('../middleware/auth');
const { getSlots } = require('../slots');

const router = express.Router();
router.use(requireRole('patient'), loadPatient);

// Free slots for a doctor on a date
router.get('/doctors/:id/slots', async (req, res) => {
  const result = await getSlots(parseInt(req.params.id, 10), String(req.query.date || ''));
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

// Book an appointment
router.post('/appointments', async (req, res) => {
  const doctorId = parseInt(req.body.doctor_id, 10);
  const date = String(req.body.date || '');
  const time = String(req.body.time || '');
  const reason = String(req.body.reason || '').trim().slice(0, 500);
  if (!doctorId || !date || !time) return res.status(400).json({ error: 'Doctor, date and time are required.' });

  // Re-check on the server that the slot really exists and is free.
  const result = await getSlots(doctorId, date);
  if (result.error) return res.status(400).json({ error: result.error });
  const slot = result.slots.find((s) => s.time === time);
  if (!slot) return res.status(400).json({ error: 'That time is not offered by the doctor.' });
  if (!slot.available) return res.status(409).json({ error: 'Sorry, that slot was just taken. Please pick another.' });

  try {
    const { rows } = await query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, reason)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [req.patientId, doctorId, date, time, reason || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    // The unique index caught a race between two patients booking at once.
    if (err.code === '23505') return res.status(409).json({ error: 'Sorry, that slot was just taken. Please pick another.' });
    throw err;
  }
});

// My appointments (upcoming + past)
router.get('/appointments', async (req, res) => {
  const { rows } = await query(
    `SELECT a.id, a.appointment_date AS date, to_char(a.start_time,'HH24:MI') AS time, a.status, a.reason,
            u.full_name AS doctor, doc.specialty, dep.name AS department,
            (a.appointment_date >= CURRENT_DATE AND a.status = 'booked') AS can_cancel,
            (f.id IS NOT NULL) AS reviewed,
            CASE WHEN a.appointment_date = CURRENT_DATE AND a.status IN ('booked','checked_in') THEN
              (SELECT COUNT(*) FROM appointments x
               WHERE x.doctor_id = a.doctor_id AND x.appointment_date = a.appointment_date
                 AND x.start_time < a.start_time AND x.status IN ('booked','checked_in'))
            END AS ahead_in_queue
     FROM appointments a
     JOIN doctors doc ON doc.id = a.doctor_id
     JOIN users u ON u.id = doc.user_id
     JOIN departments dep ON dep.id = doc.department_id
     LEFT JOIN feedback f ON f.appointment_id = a.id
     WHERE a.patient_id = $1
     ORDER BY a.appointment_date DESC, a.start_time DESC`,
    [req.patientId]
  );
  res.json(rows);
});

router.post('/appointments/:id/cancel', async (req, res) => {
  const { rowCount } = await query(
    `UPDATE appointments SET status = 'cancelled'
     WHERE id = $1 AND patient_id = $2 AND status = 'booked' AND appointment_date >= CURRENT_DATE`,
    [parseInt(req.params.id, 10), req.patientId]
  );
  if (!rowCount) return res.status(400).json({ error: 'This appointment cannot be cancelled.' });
  res.json({ ok: true });
});

// Medical history (visit notes + prescriptions for each visit)
router.get('/history', async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.created_at, a.appointment_date AS date, r.diagnosis, r.notes,
            u.full_name AS doctor, dep.name AS department,
            (SELECT COALESCE(json_agg(json_build_object(
                'medicine', m.name, 'dosage', p.dosage, 'frequency', p.frequency,
                'duration_days', p.duration_days, 'instructions', p.instructions)), '[]'::json)
             FROM prescriptions p JOIN medicines m ON m.id = p.medicine_id
             WHERE p.record_id = r.id) AS prescriptions
     FROM medical_records r
     JOIN appointments a ON a.id = r.appointment_id
     JOIN doctors doc ON doc.id = r.doctor_id
     JOIN users u ON u.id = doc.user_id
     JOIN departments dep ON dep.id = doc.department_id
     WHERE r.patient_id = $1
     ORDER BY r.created_at DESC`,
    [req.patientId]
  );
  res.json(rows);
});

// Active prescriptions = still within the prescribed number of days
router.get('/prescriptions', async (req, res) => {
  const { rows } = await query(
    `SELECT m.name AS medicine, p.dosage, p.frequency, p.duration_days, p.instructions,
            u.full_name AS doctor, p.created_at::date AS prescribed_on,
            (p.created_at::date + p.duration_days) AS ends_on,
            (p.created_at::date + p.duration_days >= CURRENT_DATE) AS active
     FROM prescriptions p
     JOIN medicines m ON m.id = p.medicine_id
     JOIN doctors doc ON doc.id = p.doctor_id
     JOIN users u ON u.id = doc.user_id
     WHERE p.patient_id = $1
     ORDER BY active DESC, p.created_at DESC`,
    [req.patientId]
  );
  res.json(rows);
});

// Feedback: only for MY completed visits, once per visit
router.post('/feedback', async (req, res) => {
  const appointmentId = parseInt(req.body.appointment_id, 10);
  const rating = parseInt(req.body.rating, 10);
  const comment = String(req.body.comment || '').trim().slice(0, 1000);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Please choose a rating from 1 to 5.' });

  const appt = await query(
    `SELECT doctor_id FROM appointments WHERE id = $1 AND patient_id = $2 AND status = 'completed'`,
    [appointmentId, req.patientId]
  );
  if (!appt.rows.length) return res.status(400).json({ error: 'You can only review your own completed visits.' });

  try {
    await query(
      'INSERT INTO feedback (appointment_id, patient_id, doctor_id, rating, comment) VALUES ($1,$2,$3,$4,$5)',
      [appointmentId, req.patientId, appt.rows[0].doctor_id, rating, comment || null]
    );
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'You already reviewed this visit.' });
    throw err;
  }
  res.status(201).json({ ok: true });
});

module.exports = router;
