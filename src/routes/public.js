// Public hospital information (no private data).
const express = require('express');
const rateLimit = require('express-rate-limit');
const { query } = require('../db');
const { audit } = require('../audit');

const router = express.Router();

// Groups appear in this order. Administrative departments (HR, billing...) are never public.
const CAT_ORDER = `CASE d.category WHEN 'emergency' THEN 1 WHEN 'specialist' THEN 2 WHEN 'surgical' THEN 3 WHEN 'diagnostic' THEN 4 ELSE 5 END`;

// ?bookable=1 -> only departments where patients can book online
router.get('/departments', async (req, res) => {
  const onlyBookable = req.query.bookable === '1';
  const { rows } = await query(
    `SELECT d.id, d.name, d.description, d.category, d.bookable,
            (SELECT COUNT(*) FROM doctors doc JOIN users u ON u.id = doc.user_id AND u.is_active
             WHERE doc.department_id = d.id) AS doctor_count
     FROM departments d
     WHERE d.category <> 'admin' AND (NOT $1::boolean OR d.bookable)
     ORDER BY ${CAT_ORDER}, d.name`, [onlyBookable]);
  res.json(rows);
});

// The doctor directory only lists doctors in departments that take online bookings.
router.get('/doctors', async (req, res) => {
  const deptId = parseInt(req.query.department_id, 10) || null;
  const { rows } = await query(
    `SELECT doc.id, u.full_name, doc.specialty, doc.qualifications, doc.bio,
            doc.consultation_fee, dep.id AS department_id, dep.name AS department,
            COALESCE(ROUND(AVG(f.rating)::numeric, 1), 0) AS avg_rating,
            COUNT(f.id) AS review_count,
            (SELECT COALESCE(json_agg(json_build_object(
                'weekday', a.weekday,
                'start', to_char(a.start_time,'HH24:MI'),
                'end', to_char(a.end_time,'HH24:MI')) ORDER BY a.weekday, a.start_time), '[]'::json)
             FROM doctor_availability a WHERE a.doctor_id = doc.id) AS hours
     FROM doctors doc
     JOIN users u ON u.id = doc.user_id AND u.is_active
     JOIN departments dep ON dep.id = doc.department_id AND dep.bookable
     LEFT JOIN feedback f ON f.doctor_id = doc.id
     WHERE ($1::int IS NULL OR dep.id = $1)
     GROUP BY doc.id, u.full_name, dep.id
     ORDER BY dep.name, u.full_name`,
    [deptId]
  );
  res.json(rows);
});

// Prescription check: the QR code on the PDF opens /verify/<code>, which asks this endpoint.
const verifyLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many checks. Please wait a moment.' } });
router.get('/verify/:code', verifyLimiter, async (req, res) => {
  const code = String(req.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  const r = code && (await query(
    `SELECT r.id, r.patient_id, a.appointment_date AS date, pu.full_name AS patient, du.full_name AS doctor, d.specialty, d.qualifications, dep.name AS department
     FROM medical_records r JOIN appointments a ON a.id = r.appointment_id
     JOIN patients p ON p.id = r.patient_id JOIN users pu ON pu.id = p.user_id
     JOIN doctors d ON d.id = r.doctor_id JOIN users du ON du.id = d.user_id JOIN departments dep ON dep.id = d.department_id
     WHERE r.verify_code = $1`, [code])).rows[0];
  if (!r) return res.json({ valid: false });
  const medicines = (await query(
    `SELECT m.name AS medicine, p.dosage, p.frequency, p.duration_days, p.quantity FROM prescriptions p JOIN medicines m ON m.id = p.medicine_id WHERE p.record_id = $1 ORDER BY p.id`, [r.id])).rows;
  await audit(req, { user: {}, action: 'verify_prescription', entity: 'medical_record', entityId: r.id, patientId: r.patient_id, details: 'Prescription checked with its QR code' });
  // Privacy: show only the first name and the initial of the last name
  const parts = String(r.patient).split(' ');
  res.json({ valid: true, clinic: 'AfyaCare Clinic', code, date: r.date, doctor: r.doctor, specialty: r.specialty, qualifications: r.qualifications,
    department: r.department, patient: parts[0] + (parts.length > 1 ? ' ' + parts[parts.length - 1][0] + '.' : ''), medicines });
});

module.exports = router;
