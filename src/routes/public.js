// Public hospital information (no private data).
const express = require('express');
const { query } = require('../db');

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

module.exports = router;
