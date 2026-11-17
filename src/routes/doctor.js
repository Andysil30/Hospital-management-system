// Module B - Doctor portal (clinical workspace).
// Every query is limited to req.doctorId, and patient history is only
// visible for patients who have an appointment with THIS doctor.
const express = require('express');
const { query, withTransaction } = require('../db');
const { requireRole, loadDoctor } = require('../middleware/auth');
const { toMinutes } = require('../slots');
const { audit } = require('../audit');
const { loadPrescription, buildPrescriptionPdf, newCode } = require('../prescription');

const LIVE = `('booked','checked_in','awaiting_lab')`;

const router = express.Router();
router.use(requireRole('doctor'), loadDoctor);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- Dashboard overview (summary cards, chart, next patient, rating) ----------
router.get('/overview', async (req, res) => {
  const id = req.doctorId;
  const today = (await query(
    `SELECT COUNT(*) FILTER (WHERE status <> 'cancelled') AS total,
            COUNT(*) FILTER (WHERE status IN ('booked','checked_in','awaiting_lab')) AS waiting,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed
     FROM appointments WHERE doctor_id = $1 AND appointment_date = CURRENT_DATE`, [id])).rows[0];

  const next = (await query(
    `SELECT a.id, a.patient_id, a.appointment_date AS date, to_char(a.start_time,'HH24:MI') AS time, a.status, a.reason, u.full_name AS patient
     FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = p.user_id
     WHERE a.doctor_id = $1 AND a.status IN ('booked','checked_in')
       AND (a.appointment_date > CURRENT_DATE OR (a.appointment_date = CURRENT_DATE AND a.start_time >= LOCALTIME - interval '30 minutes'))
     ORDER BY a.appointment_date, a.start_time LIMIT 1`, [id])).rows[0] || null;

  // The last 14 days (patients seen) and the next 6 days (patients booked)
  const series = (await query(
    `SELECT to_char(d, 'DD Mon') AS label,
            COUNT(a.id) FILTER (WHERE a.status = 'completed') AS seen,
            COUNT(a.id) FILTER (WHERE a.status IN ('booked','checked_in')) AS upcoming
     FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE + 6, interval '1 day') AS d
     LEFT JOIN appointments a ON a.doctor_id = $1 AND a.appointment_date = d::date
     GROUP BY d ORDER BY d`, [id])).rows;

  const month = (await query(
    `SELECT COUNT(DISTINCT patient_id) AS n FROM appointments
     WHERE doctor_id = $1 AND status = 'completed' AND date_trunc('month', appointment_date) = date_trunc('month', CURRENT_DATE)`, [id])).rows[0].n;

  const rating = (await query(
    `SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS avg, COUNT(*) AS total,
            COUNT(*) FILTER (WHERE rating = 5) AS r5, COUNT(*) FILTER (WHERE rating = 4) AS r4, COUNT(*) FILTER (WHERE rating = 3) AS r3,
            COUNT(*) FILTER (WHERE rating = 2) AS r2, COUNT(*) FILTER (WHERE rating = 1) AS r1
     FROM feedback WHERE doctor_id = $1`, [id])).rows[0];

  const recent = (await query(
    `SELECT rating, comment, created_at::date AS date FROM feedback WHERE doctor_id = $1 ORDER BY created_at DESC LIMIT 3`, [id])).rows;

  // Patients whose lab results are all back and who are waiting for the doctor
  const labReady = (await query(
    `SELECT a.id, a.patient_id, to_char(a.start_time,'HH24:MI') AS time, u.full_name AS patient,
            COUNT(r.id)::int AS tests, COUNT(*) FILTER (WHERE r.result_flag = 'abnormal')::int AS abnormal
     FROM appointments a JOIN patients p ON p.id = a.patient_id JOIN users u ON u.id = p.user_id
     JOIN lab_requests r ON r.appointment_id = a.id
     WHERE a.doctor_id = $1 AND a.status = 'checked_in' AND a.appointment_date = CURRENT_DATE
     GROUP BY a.id, u.full_name HAVING COUNT(*) FILTER (WHERE r.status = 'requested') = 0
     ORDER BY a.start_time`, [id])).rows;

  res.json({ today, next, series, month, rating, recent, labReady });
});

// ---------- Daily schedule & queue -----------------------------------
router.get('/schedule', async (req, res) => {
  const date = DATE_RE.test(req.query.date || '') ? req.query.date : null;
  const { rows } = await query(
    `SELECT a.id, a.patient_id, to_char(a.start_time,'HH24:MI') AS time, a.status, a.reason,
            u.full_name AS patient, p.gender,
            EXTRACT(YEAR FROM age(p.date_of_birth))::int AS age,
            m.id AS record_id, (m.id IS NOT NULL) AS has_record,
            (v.id IS NOT NULL) AS has_vitals,
            (SELECT COUNT(*)::int FROM lab_requests lr WHERE lr.appointment_id = a.id AND lr.status = 'requested') AS lab_pending,
            (SELECT COUNT(*)::int FROM lab_requests lr WHERE lr.appointment_id = a.id AND lr.status = 'completed') AS lab_done,
            p.insurance_provider, p.insurance_status,
            CASE WHEN a.status IN ${LIVE} THEN
              ROW_NUMBER() OVER (PARTITION BY a.status IN ${LIVE} ORDER BY a.start_time)
            END AS queue_no
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = p.user_id
     LEFT JOIN medical_records m ON m.appointment_id = a.id
     LEFT JOIN vitals v ON v.appointment_id = a.id
     WHERE a.doctor_id = $1 AND a.appointment_date = COALESCE($2::date, CURRENT_DATE)
     ORDER BY a.start_time`,
    [req.doctorId, date]
  );
  const summary = {
    total: rows.length,
    waiting: rows.filter((r) => ['booked', 'checked_in', 'awaiting_lab'].includes(r.status)).length,
    completed: rows.filter((r) => r.status === 'completed').length,
  };
  res.json({ date, summary, appointments: rows });
});

// Mark a patient as arrived, no-show, or cancel (completion happens via the medical record)
router.post('/appointments/:id/status', async (req, res) => {
  const status = req.body.status;
  if (!['checked_in', 'no_show', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const { rowCount } = await query(
    `UPDATE appointments SET status = $1
     WHERE id = $2 AND doctor_id = $3 AND status IN ('booked','checked_in','awaiting_lab')`,
    [status, parseInt(req.params.id, 10), req.doctorId]
  );
  if (!rowCount) return res.status(400).json({ error: 'This appointment cannot be changed.' });
  res.json({ ok: true });
});

// ---------- EMR: patient history -------------------------------------
router.get('/patients/:patientId/history', async (req, res) => {
  const patientId = parseInt(req.params.patientId, 10);
  // Access rule: only patients who have booked with this doctor.
  const link = await query('SELECT 1 FROM appointments WHERE doctor_id = $1 AND patient_id = $2 LIMIT 1', [req.doctorId, patientId]);
  if (!link.rows.length) return res.status(403).json({ error: 'This patient is not under your care.' });

  await audit(req, { action: 'view_history', entity: 'patient_history', patientId, details: 'Opened the patient\'s medical history' });
  const profile = (await query(
    `SELECT u.full_name, u.phone, p.gender, p.blood_group, p.allergies,
            EXTRACT(YEAR FROM age(p.date_of_birth))::int AS age
     FROM patients p JOIN users u ON u.id = p.user_id WHERE p.id = $1`, [patientId])).rows[0];

  const records = (await query(
    `SELECT r.id, a.appointment_date AS date, r.diagnosis, r.notes, u.full_name AS doctor,
            (SELECT COALESCE(json_agg(json_build_object('medicine', m.name, 'dosage', p.dosage,
                'frequency', p.frequency, 'duration_days', p.duration_days)), '[]'::json)
             FROM prescriptions p JOIN medicines m ON m.id = p.medicine_id WHERE p.record_id = r.id) AS prescriptions
     FROM medical_records r
     JOIN appointments a ON a.id = r.appointment_id
     JOIN doctors d ON d.id = r.doctor_id JOIN users u ON u.id = d.user_id
     WHERE r.patient_id = $1 ORDER BY r.created_at DESC LIMIT 20`, [patientId])).rows;
  res.json({ profile, records });
});

// Medicines the doctor can prescribe (in stock, not expired)
router.get('/medicines', async (req, res) => {
  const { rows } = await query(
    `SELECT id, name, category, stock_qty, unit_price FROM medicines
     WHERE stock_qty > 0 AND (expiry_date IS NULL OR expiry_date > CURRENT_DATE) ORDER BY name`
  );
  res.json(rows);
});

// Save diagnosis + prescriptions and complete the visit - ALL IN ONE TRANSACTION.
// If any medicine is out of stock, nothing is saved at all.
router.post('/records', async (req, res) => {
  const appointmentId = parseInt(req.body.appointment_id, 10);
  const diagnosis = String(req.body.diagnosis || '').trim();
  const notes = String(req.body.notes || '').trim();
  const items = Array.isArray(req.body.prescriptions) ? req.body.prescriptions : [];
  if (!diagnosis) return res.status(400).json({ error: 'Please enter a diagnosis.' });
  if (items.length > 15) return res.status(400).json({ error: 'Too many medicines in one prescription.' });

  let saved;
  try {
    saved = await withTransaction(async (db) => {
      const appt = (await db.query(
        `SELECT a.id, a.patient_id, d.consultation_fee FROM appointments a JOIN doctors d ON d.id = a.doctor_id
         WHERE a.id = $1 AND a.doctor_id = $2 AND a.status IN ${LIVE} FOR UPDATE OF a`,
        [appointmentId, req.doctorId])).rows[0];
      if (!appt) throw Object.assign(new Error('This appointment is not open for a consultation.'), { http: 400 });
      const pending = (await db.query(`SELECT COUNT(*)::int AS n FROM lab_requests WHERE appointment_id = $1 AND status = 'requested'`, [appt.id])).rows[0].n;
      if (pending > 0) throw Object.assign(new Error('Some lab results are still pending. Wait for the laboratory before completing the visit.'), { http: 409 });

      const rec = (await db.query(
        `INSERT INTO medical_records (appointment_id, patient_id, doctor_id, diagnosis, notes, verify_code)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [appt.id, appt.patient_id, req.doctorId, diagnosis, notes || null, newCode()])).rows[0];

      for (const it of items) {
        const medId = parseInt(it.medicine_id, 10);
        const qty = parseInt(it.quantity, 10);
        const days = parseInt(it.duration_days, 10);
        if (!medId || !(qty > 0) || !(days > 0) || !it.dosage || !it.frequency) {
          throw Object.assign(new Error('Each medicine needs dosage, frequency, duration and quantity.'), { http: 400 });
        }
        // Lock the medicine row so two doctors cannot sell the last box twice.
        const med = (await db.query('SELECT name, stock_qty, unit_price, expiry_date, (expiry_date <= CURRENT_DATE) AS expired FROM medicines WHERE id = $1 FOR UPDATE', [medId])).rows[0];
        if (!med) throw Object.assign(new Error('Medicine not found.'), { http: 400 });
        if (med.expired) throw Object.assign(new Error(`${med.name} is expired and cannot be prescribed.`), { http: 400 });
        if (med.stock_qty < qty) throw Object.assign(new Error(`Only ${med.stock_qty} of ${med.name} left in stock.`), { http: 409 });

        await db.query('UPDATE medicines SET stock_qty = stock_qty - $1 WHERE id = $2', [qty, medId]);
        await db.query(
          `INSERT INTO prescriptions (record_id, patient_id, doctor_id, medicine_id, dosage, frequency, duration_days, quantity, instructions)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [rec.id, appt.patient_id, req.doctorId, medId, String(it.dosage).slice(0, 80), String(it.frequency).slice(0, 80), days, qty, it.instructions || null]);
        await db.query(
          `INSERT INTO payments (appointment_id, patient_id, amount, type) VALUES ($1,$2,$3,'pharmacy')`,
          [appt.id, appt.patient_id, med.unit_price * qty]);
      }

      // If the patient already paid the consultation fee (for example by M-Pesa), do not charge it twice.
      const alreadyPaid = (await db.query(`SELECT 1 FROM payments WHERE appointment_id = $1 AND type = 'consultation' LIMIT 1`, [appt.id])).rows.length > 0;
      if (!alreadyPaid) {
        await db.query(`INSERT INTO payments (appointment_id, patient_id, amount, type) VALUES ($1,$2,$3,'consultation')`,
          [appt.id, appt.patient_id, appt.consultation_fee]);
      }
      await db.query(`UPDATE appointments SET status = 'completed' WHERE id = $1`, [appt.id]);
      return { recordId: rec.id, patientId: appt.patient_id };
    });
  } catch (err) {
    if (err.http) return res.status(err.http).json({ error: err.message });
    throw err;
  }
  await audit(req, { action: 'create_record', entity: 'medical_record', entityId: saved.recordId, patientId: saved.patientId,
    details: `Diagnosis saved, ${items.length} medicine(s) prescribed` });
  res.status(201).json({ ok: true, record_id: saved.recordId });
});

// ---------- Triage vitals, lab requests and results for one appointment ----------
router.get('/appointments/:id/clinical', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const a = (await query('SELECT id, patient_id FROM appointments WHERE id = $1 AND doctor_id = $2', [id, req.doctorId])).rows[0];
  if (!a) return res.status(404).json({ error: 'Appointment not found.' });
  const vitals = (await query(
    `SELECT v.bp_systolic, v.bp_diastolic, v.temperature_c, v.weight_kg, v.pulse, v.spo2, v.notes,
            to_char(v.recorded_at,'HH24:MI') AS at, u.full_name AS by
     FROM vitals v LEFT JOIN users u ON u.id = v.recorded_by WHERE v.appointment_id = $1`, [id])).rows[0] || null;
  const labs = (await query(
    `SELECT r.id, t.name AS test, r.status, r.result_text, r.result_flag, r.clinical_notes
     FROM lab_requests r JOIN lab_tests t ON t.id = r.test_id WHERE r.appointment_id = $1 ORDER BY t.name`, [id])).rows;
  const cover = (await query('SELECT insurance_provider, insurance_number, insurance_status FROM patients WHERE id = $1', [a.patient_id])).rows[0];
  await audit(req, { action: 'view_clinical', entity: 'appointment', entityId: id, patientId: a.patient_id, details: 'Viewed triage vitals and lab results' });
  res.json({ vitals, labs, cover });
});

router.get('/lab-tests', async (req, res) => {
  res.json((await query(`SELECT id, name, category, price FROM lab_tests WHERE is_active ORDER BY category, name`)).rows);
});

// The doctor asks the laboratory for tests; the patient then shows as "Awaiting lab"
router.post('/lab-requests', async (req, res) => {
  const appointmentId = parseInt(req.body.appointment_id, 10);
  const ids = [...new Set((Array.isArray(req.body.test_ids) ? req.body.test_ids : []).map(Number).filter(Number.isInteger))];
  const notes = String(req.body.notes || '').trim().slice(0, 500) || null;
  if (!ids.length) return res.status(400).json({ error: 'Choose at least one test.' });
  if (ids.length > 12) return res.status(400).json({ error: 'Choose at most 12 tests at a time.' });

  const out = await withTransaction(async (db) => {
    const a = (await db.query(`SELECT id, patient_id FROM appointments WHERE id = $1 AND doctor_id = $2 AND status IN ${LIVE} FOR UPDATE`, [appointmentId, req.doctorId])).rows[0];
    if (!a) return null;
    let added = 0; const names = [];
    for (const tid of ids) {
      const t = (await db.query('SELECT name FROM lab_tests WHERE id = $1 AND is_active', [tid])).rows[0];
      if (!t) continue;
      const r = await db.query(
        `INSERT INTO lab_requests (appointment_id, patient_id, doctor_id, test_id, clinical_notes) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (appointment_id, test_id) DO NOTHING`,
        [a.id, a.patient_id, req.doctorId, tid, notes]);
      if (r.rowCount) { added++; names.push(t.name); }
    }
    if (added) await db.query(`UPDATE appointments SET status = 'awaiting_lab' WHERE id = $1`, [a.id]);
    return { added, names, patientId: a.patient_id, id: a.id };
  });
  if (!out) return res.status(400).json({ error: 'This appointment is not open.' });
  if (!out.added) return res.status(409).json({ error: 'Those tests were already requested for this visit.' });
  await audit(req, { action: 'request_lab', entity: 'lab_request', entityId: out.id, patientId: out.patientId, details: out.names.join(', ') });
  res.status(201).json({ ok: true, added: out.added });
});

// PDF prescription for a visit written by THIS doctor
router.get('/records/:id/prescription.pdf', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const rx = await loadPrescription(id);
  if (!rx || rx.doctor_id !== req.doctorId) return res.status(404).json({ error: 'Record not found.' });
  await audit(req, { action: 'download_prescription', entity: 'medical_record', entityId: id, patientId: rx.patient_id, details: 'PDF prescription downloaded' });
  const doc = await buildPrescriptionPdf(rx, `${req.protocol}://${req.get('host')}`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="prescription-${rx.verify_code}.pdf"`);
  doc.pipe(res);
});

// ---------- Availability control -------------------------------------
router.get('/availability', async (req, res) => {
  const doc = (await query('SELECT slot_minutes FROM doctors WHERE id = $1', [req.doctorId])).rows[0];
  const hours = (await query(
    `SELECT weekday, to_char(start_time,'HH24:MI') AS start, to_char(end_time,'HH24:MI') AS "end"
     FROM doctor_availability WHERE doctor_id = $1 ORDER BY weekday, start_time`, [req.doctorId])).rows;
  const offDays = (await query(
    `SELECT id, off_date, reason FROM doctor_off_days WHERE doctor_id = $1 AND off_date >= CURRENT_DATE ORDER BY off_date`, [req.doctorId])).rows;
  res.json({ slot_minutes: doc.slot_minutes, hours, off_days: offDays });
});

router.put('/availability', async (req, res) => {
  const slotMinutes = parseInt(req.body.slot_minutes, 10);
  const hours = Array.isArray(req.body.hours) ? req.body.hours : [];
  if (!(slotMinutes >= 10 && slotMinutes <= 120)) return res.status(400).json({ error: 'Consultation length must be 10-120 minutes.' });
  for (const h of hours) {
    if (!(h.weekday >= 0 && h.weekday <= 6) || !TIME_RE.test(h.start) || !TIME_RE.test(h.end) || toMinutes(h.end) <= toMinutes(h.start)) {
      return res.status(400).json({ error: 'Each working period needs a day and an end time later than its start time.' });
    }
  }
  await withTransaction(async (db) => {
    await db.query('UPDATE doctors SET slot_minutes = $1, schedule = NULL WHERE id = $2', [slotMinutes, req.doctorId]);
    await db.query('DELETE FROM doctor_availability WHERE doctor_id = $1', [req.doctorId]);
    for (const h of hours) {
      await db.query('INSERT INTO doctor_availability (doctor_id, weekday, start_time, end_time) VALUES ($1,$2,$3,$4)',
        [req.doctorId, h.weekday, h.start, h.end]);
    }
  });
  res.json({ ok: true });
});

router.post('/off-days', async (req, res) => {
  const date = String(req.body.off_date || '');
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Please choose a date.' });
  const booked = await query(
    `SELECT COUNT(*) AS n FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status IN ('booked','checked_in')`,
    [req.doctorId, date]);
  if (booked.rows[0].n > 0) {
    return res.status(409).json({ error: `You already have ${booked.rows[0].n} booking(s) on that date. Cancel them first from your schedule.` });
  }
  try {
    await query('INSERT INTO doctor_off_days (doctor_id, off_date, reason) VALUES ($1,$2,$3)',
      [req.doctorId, date, String(req.body.reason || '').slice(0, 200) || null]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That date is already an off-day.' });
    throw err;
  }
  res.status(201).json({ ok: true });
});

router.delete('/off-days/:id', async (req, res) => {
  await query('DELETE FROM doctor_off_days WHERE id = $1 AND doctor_id = $2', [parseInt(req.params.id, 10), req.doctorId]);
  res.json({ ok: true });
});

// ---------- My feedback ----------------------------------------------
router.get('/feedback', async (req, res) => {
  const stats = (await query(
    `SELECT COALESCE(ROUND(AVG(rating)::numeric,2),0) AS avg_rating, COUNT(*) AS total FROM feedback WHERE doctor_id = $1`, [req.doctorId])).rows[0];
  const recent = (await query(
    `SELECT rating, comment, created_at::date AS date FROM feedback WHERE doctor_id = $1 ORDER BY created_at DESC LIMIT 15`, [req.doctorId])).rows;
  res.json({ ...stats, recent });
});

module.exports = router;
