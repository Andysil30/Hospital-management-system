// Module C - Patient portal.  Every query is filtered by req.patientId,
// so a patient can only ever see THEIR OWN data.
const express = require('express');
const { query, withTransaction } = require('../db');
const { requireRole, loadPatient } = require('../middleware/auth');
const { getSlots } = require('../slots');
const { audit } = require('../audit');
const { checkCover, PROVIDERS } = require('../cover');
const { loadPrescription, buildPrescriptionPdf } = require('../prescription');
const crypto = require('crypto');

// ---- Mock SMS / WhatsApp confirmation (demonstration only: nothing is really sent) ----
async function afterBooking(req, appointmentId, doctorId, date, time) {
  const info = (await query(
    `SELECT u.full_name AS patient, p.reminders, du.full_name AS doctor, dep.name AS department, d.consultation_fee AS fee,
            (SELECT COUNT(*)::int FROM appointments x WHERE x.doctor_id = $2 AND x.appointment_date = $3
               AND x.status IN ('booked','checked_in','awaiting_lab') AND x.start_time <= $4::time) AS queue_no
     FROM patients p JOIN users u ON u.id = p.user_id, doctors d
     JOIN users du ON du.id = d.user_id JOIN departments dep ON dep.id = d.department_id
     WHERE p.id = $1 AND d.id = $2`, [req.patientId, doctorId, date, time])).rows[0];
  const messages = [];
  if (info && info.reminders) {
    const first = String(info.patient).split(' ')[0];
    const when = new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
    const where = process.env.CLINIC_DIRECTIONS || process.env.HOSPITAL_ADDRESS || 'AfyaCare Clinic reception, ground floor';
    const wa = `*AfyaCare Clinic*\nHello ${first}, your appointment is confirmed.\nDoctor: ${info.doctor} (${info.department})\nWhen: ${when} at ${time}\nYour queue number: ${info.queue_no}\nPlease arrive 15 minutes early.\nDirections: ${where}`.replace(/\\n/g, '\n');
    const sms = `AfyaCare: ${first}, appt confirmed ${when} ${time} with ${info.doctor}. Queue no ${info.queue_no}. Arrive 15 min early. ${where}`;
    for (const [channel, message] of [['whatsapp', wa], ['sms', sms]]) {
      await query('INSERT INTO notifications (patient_id, appointment_id, channel, message) VALUES ($1,$2,$3,$4)', [req.patientId, appointmentId, channel, message]);
      messages.push({ channel, message });
    }
  }
  return { id: appointmentId, queue_no: info ? info.queue_no : null, fee: info ? info.fee : 0, messages };
}


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
    res.status(201).json(await afterBooking(req, rows[0].id, doctorId, date, time));
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
            (f.id IS NOT NULL) AS reviewed, doc.consultation_fee AS fee,
            (SELECT pay.reference FROM payments pay WHERE pay.appointment_id = a.id AND pay.type = 'consultation' LIMIT 1) AS receipt,
            EXISTS (SELECT 1 FROM payments pay WHERE pay.appointment_id = a.id AND pay.type = 'consultation') AS paid,
            (a.status IN ('booked','checked_in','awaiting_lab') AND a.appointment_date >= CURRENT_DATE AND doc.consultation_fee > 0
               AND NOT EXISTS (SELECT 1 FROM payments pay WHERE pay.appointment_id = a.id AND pay.type = 'consultation')) AS can_pay,
            CASE WHEN a.appointment_date = CURRENT_DATE AND a.status IN ('booked','checked_in','awaiting_lab') THEN
              (SELECT COUNT(*) FROM appointments x
               WHERE x.doctor_id = a.doctor_id AND x.appointment_date = a.appointment_date
                 AND x.start_time < a.start_time AND x.status IN ('booked','checked_in','awaiting_lab'))
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
  await audit(req, { action: 'view_own_history', entity: 'patient_history', patientId: req.patientId, details: 'Patient opened their own history' });
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


// ---------- Simulated M-Pesa payment of the consultation fee ----------
// DEMONSTRATION ONLY: no money moves. A real version would call Safaricom's Daraja "STK Push" API.
router.post('/appointments/:id/pay-mpesa', async (req, res) => {
  const m = String(req.body.phone || '').replace(/[\s-]/g, '').match(/^(?:\+?254|0)([17]\d{8})$/);
  if (!m) return res.status(400).json({ error: 'Enter a valid Safaricom number, for example 0712 345 678.' });
  const local = '0' + m[1];
  const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const receipt = 'SIM' + Array.from({ length: 7 }, () => CODE[crypto.randomInt(CODE.length)]).join('');

  const out = await withTransaction(async (db) => {
    const a = (await db.query(
      `SELECT a.id, a.appointment_date AS date, to_char(a.start_time,'HH24:MI') AS time, d.consultation_fee AS fee, du.full_name AS doctor
       FROM appointments a JOIN doctors d ON d.id = a.doctor_id JOIN users du ON du.id = d.user_id
       WHERE a.id = $1 AND a.patient_id = $2 AND a.status IN ('booked','checked_in','awaiting_lab') AND a.appointment_date >= CURRENT_DATE FOR UPDATE OF a`,
      [parseInt(req.params.id, 10), req.patientId])).rows[0];
    if (!a) return { error: 'This appointment cannot be paid for.', http: 400 };
    if (!(a.fee > 0)) return { error: 'There is no fee to pay for this visit.', http: 400 };
    if ((await db.query(`SELECT 1 FROM payments WHERE appointment_id = $1 AND type = 'consultation'`, [a.id])).rows.length) return { error: 'This visit is already paid.', http: 409 };
    const pay = (await db.query(
      `INSERT INTO payments (appointment_id, patient_id, amount, type, method, reference) VALUES ($1,$2,$3,'consultation','mpesa',$4) RETURNING paid_at`,
      [a.id, req.patientId, a.fee, receipt])).rows[0];
    return { receipt, amount: a.fee, doctor: a.doctor, date: a.date, time: a.time, paid_at: pay.paid_at, phone: `${local.slice(0, 4)} *** ${local.slice(-3)}` };
  });
  if (out.error) return res.status(out.http).json({ error: out.error });
  res.status(201).json(out);
});

// ---------- Insurance / SHA cover (the check is a demonstration) ----------
router.get('/cover', async (req, res) => {
  const c = (await query('SELECT insurance_provider AS provider, insurance_number AS number, insurance_status AS status, insurance_checked_at AS checked_at FROM patients WHERE id = $1', [req.patientId])).rows[0];
  res.json({ ...c, providers: PROVIDERS });
});

router.put('/cover', async (req, res) => {
  const c = checkCover(req.body.provider, req.body.number);
  if (c.status !== 'none' && !c.number) return res.status(400).json({ error: 'Enter your member or SHA number.' });
  await query(
    `UPDATE patients SET insurance_provider = $1, insurance_number = $2, insurance_status = $3, insurance_checked_at = $4 WHERE id = $5`,
    [c.provider, c.number, c.status, c.status === 'none' ? null : new Date(), req.patientId]);
  res.json(c);
});

// ---------- Mock SMS / WhatsApp messages ----------
router.get('/messages', async (req, res) => {
  const reminders = (await query('SELECT reminders FROM patients WHERE id = $1', [req.patientId])).rows[0].reminders;
  const messages = (await query(
    `SELECT id, channel, message, created_at FROM notifications WHERE patient_id = $1 ORDER BY created_at DESC, id DESC LIMIT 12`, [req.patientId])).rows;
  res.json({ reminders, messages });
});

router.put('/reminders', async (req, res) => {
  await query('UPDATE patients SET reminders = $1 WHERE id = $2', [req.body.enabled === true, req.patientId]);
  res.json({ ok: true });
});

// ---------- Lab results ----------
router.get('/lab-results', async (req, res) => {
  const { rows } = await query(
    `SELECT t.name AS test, r.status, r.result_text, r.result_flag, r.completed_at, r.requested_at, a.appointment_date AS date, du.full_name AS doctor
     FROM lab_requests r JOIN lab_tests t ON t.id = r.test_id JOIN appointments a ON a.id = r.appointment_id
     JOIN doctors d ON d.id = r.doctor_id JOIN users du ON du.id = d.user_id
     WHERE r.patient_id = $1 ORDER BY r.requested_at DESC LIMIT 40`, [req.patientId]);
  await audit(req, { action: 'view_own_lab_results', entity: 'lab_request', patientId: req.patientId, details: 'Patient opened lab results' });
  res.json(rows);
});

// ---------- PDF prescription of MY visit ----------
router.get('/records/:id/prescription.pdf', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const rx = await loadPrescription(id);
  if (!rx || rx.patient_id !== req.patientId) return res.status(404).json({ error: 'Record not found.' });
  await audit(req, { action: 'download_prescription', entity: 'medical_record', entityId: id, patientId: rx.patient_id, details: 'Patient downloaded the PDF prescription' });
  const doc = await buildPrescriptionPdf(rx, `${req.protocol}://${req.get('host')}`);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="prescription-${rx.verify_code}.pdf"`);
  doc.pipe(res);
});

module.exports = router;
