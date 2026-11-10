// Module A - Owner / Administrator portal (executive dashboard).
const express = require('express');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('admin'));

// ---------- KPI cards ------------------------------------------------
router.get('/summary', async (req, res) => {
  const { rows } = await query(
    `SELECT
       (SELECT COUNT(*) FROM patients) AS total_patients,
       (SELECT COUNT(*) FROM doctors d JOIN users u ON u.id = d.user_id WHERE u.is_active) AS active_doctors,
       (SELECT COUNT(*) FROM appointments WHERE appointment_date = CURRENT_DATE AND status <> 'cancelled') AS appointments_today,
       (SELECT COUNT(DISTINCT patient_id) FROM appointments WHERE status = 'completed') AS patients_attended,
       (SELECT COALESCE(SUM(amount),0) FROM payments WHERE paid_at::date = CURRENT_DATE) AS revenue_today,
       (SELECT COALESCE(SUM(amount),0) FROM payments WHERE date_trunc('month', paid_at) = date_trunc('month', now())) AS revenue_month,
       (SELECT COUNT(*) FROM medicines WHERE stock_qty <= reorder_level) AS low_stock,
       (SELECT COUNT(*) FROM medicines WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + 90) AS expiring_soon`
  );
  res.json(rows[0]);
});

// ---------- Financial tracking (daily / weekly / monthly) -------------
// The unit / count / format come from this fixed list - never from user
// input - so it is safe to place them inside the SQL text.
const PERIODS = {
  daily:   { unit: 'day',   back: 13, fmt: 'DD Mon' },
  weekly:  { unit: 'week',  back: 11, fmt: 'DD Mon' },
  monthly: { unit: 'month', back: 11, fmt: 'Mon YYYY' },
};
router.get('/revenue', async (req, res) => {
  const p = PERIODS[req.query.period] || PERIODS.daily;
  // generate_series makes one row per bucket so days with no income show as 0.
  const { rows } = await query(
    `SELECT to_char(b.bucket, '${p.fmt}') AS label,
            COALESCE(SUM(pay.amount) FILTER (WHERE pay.type = 'consultation'), 0) AS consultation,
            COALESCE(SUM(pay.amount) FILTER (WHERE pay.type = 'pharmacy'), 0)     AS pharmacy
     FROM generate_series(date_trunc('${p.unit}', now()) - interval '${p.back} ${p.unit}',
                          date_trunc('${p.unit}', now()), interval '1 ${p.unit}') AS b(bucket)
     LEFT JOIN payments pay ON date_trunc('${p.unit}', pay.paid_at) = b.bucket
     GROUP BY b.bucket ORDER BY b.bucket`
  );
  res.json({
    labels: rows.map((r) => r.label),
    consultation: rows.map((r) => r.consultation),
    pharmacy: rows.map((r) => r.pharmacy),
  });
});

// ---------- Hospital performance -------------------------------------
router.get('/department-volume', async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
  const { rows } = await query(
    `SELECT dep.name, COUNT(a.id) AS patients
     FROM departments dep
     LEFT JOIN doctors d ON d.department_id = dep.id
     LEFT JOIN appointments a ON a.doctor_id = d.id AND a.status = 'completed'
                             AND a.appointment_date > CURRENT_DATE - $1::int
     GROUP BY dep.id ORDER BY patients DESC, dep.name`, [days]);
  res.json(rows);
});

router.get('/staff-activity', async (req, res) => {
  const { rows } = await query(
    `SELECT u.full_name, dep.name AS department, u.is_active, u.last_login,
            COUNT(a.id) FILTER (WHERE a.status = 'completed' AND a.appointment_date > CURRENT_DATE - 30) AS visits_30d,
            COUNT(a.id) FILTER (WHERE a.appointment_date = CURRENT_DATE AND a.status <> 'cancelled') AS booked_today,
            (SELECT COUNT(*) FROM medical_records r WHERE r.doctor_id = d.id AND r.created_at > now() - interval '30 days') AS records_30d
     FROM doctors d
     JOIN users u ON u.id = d.user_id
     JOIN departments dep ON dep.id = d.department_id
     LEFT JOIN appointments a ON a.doctor_id = d.id
     GROUP BY d.id, u.id, dep.name ORDER BY visits_30d DESC`);
  res.json(rows);
});

// ---------- Best performing doctor (patient feedback) ----------------
// Score = weighted average. A doctor with 2 perfect reviews should not beat
// one with 40 reviews averaging 4.8, so we blend each doctor's average with
// the hospital-wide average (a "Bayesian average"):
//     score = (n / (n + m)) * avg  +  (m / (n + m)) * hospital_avg      (m = 3)
const AWARD_PERIODS = { month: 30, quarter: 90, year: 365, all: null };
router.get('/top-doctors', async (req, res) => {
  const days = AWARD_PERIODS[req.query.period] === undefined ? 30 : AWARD_PERIODS[req.query.period];
  const since = days ? new Date(Date.now() - days * 86400000) : new Date(0);
  const { rows } = await query(
    `WITH f AS (
       SELECT doctor_id, AVG(rating)::float AS avg_rating, COUNT(*) AS reviews
       FROM feedback WHERE created_at >= $1 GROUP BY doctor_id),
     g AS (SELECT COALESCE(AVG(rating), 0)::float AS hospital_avg FROM feedback WHERE created_at >= $1)
     SELECT d.id, u.full_name, dep.name AS department, ROUND(f.avg_rating::numeric, 2) AS avg_rating, f.reviews,
            ROUND(((f.reviews / (f.reviews + 3.0)) * f.avg_rating + (3.0 / (f.reviews + 3.0)) * g.hospital_avg)::numeric, 2) AS score
     FROM f CROSS JOIN g
     JOIN doctors d ON d.id = f.doctor_id
     JOIN users u ON u.id = d.user_id
     JOIN departments dep ON dep.id = d.department_id
     ORDER BY score DESC, f.reviews DESC LIMIT 10`, [since]);
  res.json(rows);
});

// ---------- Inventory & pharmacy -------------------------------------
router.get('/medicines', async (req, res) => {
  const filter = req.query.filter;
  const { rows } = await query(
    `SELECT id, name, category, unit_price, stock_qty, reorder_level, expiry_date,
            (stock_qty <= reorder_level) AS low_stock,
            (expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE) AS expired,
            (expiry_date IS NOT NULL AND expiry_date > CURRENT_DATE AND expiry_date <= CURRENT_DATE + 90) AS expiring_soon
     FROM medicines
     WHERE ($1 <> 'low' OR stock_qty <= reorder_level)
       AND ($1 <> 'expiring' OR (expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + 90))
     ORDER BY name`, [filter === 'low' || filter === 'expiring' ? filter : 'all']);
  res.json(rows);
});

function readMedicine(body) {
  const name = String(body.name || '').trim();
  const price = Number(body.unit_price);
  const stock = parseInt(body.stock_qty, 10);
  const reorder = parseInt(body.reorder_level, 10);
  if (!name) return { error: 'Medicine name is required.' };
  if (!(price >= 0)) return { error: 'Enter a valid unit price.' };
  if (!(stock >= 0)) return { error: 'Enter a valid stock quantity.' };
  if (!(reorder >= 0)) return { error: 'Enter a valid reorder level.' };
  return { value: [name, String(body.category || '').trim() || null, price, stock, reorder, body.expiry_date || null] };
}

router.post('/medicines', async (req, res) => {
  const m = readMedicine(req.body);
  if (m.error) return res.status(400).json({ error: m.error });
  try {
    await query('INSERT INTO medicines (name, category, unit_price, stock_qty, reorder_level, expiry_date) VALUES ($1,$2,$3,$4,$5,$6)', m.value);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A medicine with that name already exists.' });
    throw err;
  }
  res.status(201).json({ ok: true });
});

router.put('/medicines/:id', async (req, res) => {
  const m = readMedicine(req.body);
  if (m.error) return res.status(400).json({ error: m.error });
  const { rowCount } = await query(
    'UPDATE medicines SET name=$1, category=$2, unit_price=$3, stock_qty=$4, reorder_level=$5, expiry_date=$6 WHERE id=$7',
    [...m.value, parseInt(req.params.id, 10)]);
  if (!rowCount) return res.status(404).json({ error: 'Medicine not found.' });
  res.json({ ok: true });
});

// ---------- Departments, doctors and personnel ------------------------
const { PATTERNS, applyPattern, patternLabel } = require('../schedules');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;           // e.g. example@gmail.com
const CATEGORIES = ['emergency', 'specialist', 'surgical', 'diagnostic', 'admin'];
const CAT_ORDER = `CASE d.category WHEN 'emergency' THEN 1 WHEN 'specialist' THEN 2 WHEN 'surgical' THEN 3 WHEN 'diagnostic' THEN 4 ELSE 5 END`;

router.get('/schedule-patterns', (req, res) => {
  res.json(Object.entries(PATTERNS).map(([key, p]) => ({ key, label: p.label })));
});

router.get('/departments', async (req, res) => {
  res.json((await query(`SELECT d.id, d.name, d.category, d.bookable, d.max_staff FROM departments d ORDER BY ${CAT_ORDER}, d.name`)).rows);
});

router.post('/departments', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const category = CATEGORIES.includes(req.body.category) ? req.body.category : 'specialist';
  if (!name) return res.status(400).json({ error: 'Department name is required.' });
  try {
    await query('INSERT INTO departments (name, description, category, bookable) VALUES ($1,$2,$3,$4)',
      [name, String(req.body.description || '').trim() || null, category, category === 'specialist']);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That department already exists.' });
    throw err;
  }
  res.status(201).json({ ok: true });
});

// Who is working in each department? Every department should have at least two people
// (different days or shifts); Human Resources must have exactly one.
router.get('/coverage', async (req, res) => {
  const { rows } = await query(
    `SELECT d.id, d.name, d.category, d.max_staff,
            (SELECT COUNT(*) FROM doctors x JOIN users u ON u.id = x.user_id AND u.is_active WHERE x.department_id = d.id) AS clinicians,
            (SELECT COUNT(*) FROM staff_members s WHERE s.department_id = d.id AND s.is_active) AS personnel
     FROM departments d ORDER BY ${CAT_ORDER}, d.name`);
  res.json(rows.map((r) => {
    const total = r.clinicians + r.personnel;
    const required = r.max_staff ? Math.min(r.max_staff, 2) : 2;
    let status = 'ok';
    if (r.max_staff && total > r.max_staff) status = 'over';
    else if (total < required) status = 'short';
    return { ...r, total, required, status };
  }));
});

router.get('/doctors', async (req, res) => {
  const { rows } = await query(
    `SELECT d.id, u.id AS user_id, u.full_name, u.email, u.is_active, dep.name AS department,
            d.specialty, d.consultation_fee, d.schedule
     FROM doctors d JOIN users u ON u.id = d.user_id JOIN departments dep ON dep.id = d.department_id
     ORDER BY dep.name, u.full_name`);
  res.json(rows.map((r) => ({ ...r, schedule_label: patternLabel(r.schedule) })));
});

// Is there room in this department? (Human Resources allows only one person.)
async function checkCapacity(db, departmentId) {
  const dep = (await db.query('SELECT name, max_staff FROM departments WHERE id = $1 FOR UPDATE', [departmentId])).rows[0];
  if (!dep) throw Object.assign(new Error('Department not found.'), { http: 400 });
  if (dep.max_staff) {
    const n = (await db.query(
      `SELECT (SELECT COUNT(*) FROM doctors x JOIN users u ON u.id = x.user_id AND u.is_active WHERE x.department_id = $1)
            + (SELECT COUNT(*) FROM staff_members s WHERE s.department_id = $1 AND s.is_active) AS n`, [departmentId])).rows[0].n;
    if (n >= dep.max_staff) {
      throw Object.assign(new Error(`${dep.name} allows only ${dep.max_staff} person${dep.max_staff > 1 ? 's' : ''}.`), { http: 409 });
    }
  }
}

router.post('/doctors', async (req, res) => {
  const b = req.body;
  const email = String(b.email || '').trim().toLowerCase();
  const name = String(b.full_name || '').trim();
  const deptId = parseInt(b.department_id, 10);
  const fee = Number(b.consultation_fee);
  const pattern = PATTERNS[b.schedule] ? b.schedule : 'office_5';
  if (name.length < 2) return res.status(400).json({ error: "Enter the doctor's full name." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid e-mail address, for example example@gmail.com.' });
  if (!b.password || String(b.password).length < 8) return res.status(400).json({ error: 'The password must be at least 8 characters.' });
  if (String(b.password).length > 72) return res.status(400).json({ error: 'The password must be at most 72 characters.' });
  if (!deptId) return res.status(400).json({ error: 'Choose a department.' });
  if (!String(b.specialty || '').trim() || !String(b.qualifications || '').trim()) return res.status(400).json({ error: 'Specialty and qualifications are required.' });
  if (!(fee >= 0)) return res.status(400).json({ error: 'Enter a valid consultation fee.' });

  const hash = await bcrypt.hash(String(b.password), 10);
  try {
    await withTransaction(async (db) => {
      await checkCapacity(db, deptId);
      const u = await db.query(
        `INSERT INTO users (full_name, email, password_hash, role, phone) VALUES ($1,$2,$3,'doctor',$4) RETURNING id`,
        [name, email, hash, b.phone || null]);
      const d = await db.query(
        `INSERT INTO doctors (user_id, department_id, specialty, qualifications, bio, consultation_fee)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [u.rows[0].id, deptId, String(b.specialty).trim(), String(b.qualifications).trim(), b.bio || null, fee]);
      await applyPattern(db, d.rows[0].id, pattern);
    });
  } catch (err) {
    if (err.http) return res.status(err.http).json({ error: err.message });
    if (err.code === '23505') return res.status(409).json({ error: 'That e-mail is already registered.' });
    throw err;
  }
  res.status(201).json({ ok: true });
});

// Disable / re-enable a doctor's login (does not delete any records)
router.post('/doctors/:id/active', async (req, res) => {
  const active = req.body.is_active === true;
  const { rowCount } = await query(
    `UPDATE users SET is_active = $1 WHERE id = (SELECT user_id FROM doctors WHERE id = $2)`,
    [active, parseInt(req.params.id, 10)]);
  if (!rowCount) return res.status(404).json({ error: 'Doctor not found.' });
  res.json({ ok: true });
});

// Support / non-clinical personnel (no login)
router.get('/personnel', async (req, res) => {
  const { rows } = await query(
    `SELECT s.id, s.full_name, s.job_title, s.phone, s.schedule, s.is_active, dep.name AS department
     FROM staff_members s JOIN departments dep ON dep.id = s.department_id
     ORDER BY dep.name, s.full_name`);
  res.json(rows.map((r) => ({ ...r, schedule_label: patternLabel(r.schedule) })));
});

router.post('/personnel', async (req, res) => {
  const b = req.body;
  const name = String(b.full_name || '').trim();
  const job = String(b.job_title || '').trim();
  const deptId = parseInt(b.department_id, 10);
  const pattern = PATTERNS[b.schedule] ? b.schedule : 'office_5';
  if (name.length < 2) return res.status(400).json({ error: 'Enter the full name.' });
  if (!job) return res.status(400).json({ error: 'Enter the job title.' });
  if (!deptId) return res.status(400).json({ error: 'Choose a department.' });
  try {
    await withTransaction(async (db) => {
      await checkCapacity(db, deptId);
      await db.query(`INSERT INTO staff_members (full_name, job_title, department_id, phone, schedule) VALUES ($1,$2,$3,$4,$5)`,
        [name, job, deptId, String(b.phone || '').trim() || null, pattern]);
    });
  } catch (err) {
    if (err.http) return res.status(err.http).json({ error: err.message });
    if (err.code === '23503') return res.status(400).json({ error: 'Department not found.' });
    throw err;
  }
  res.status(201).json({ ok: true });
});

router.post('/personnel/:id/active', async (req, res) => {
  const active = req.body.is_active === true;
  const id = parseInt(req.params.id, 10);
  try {
    await withTransaction(async (db) => {
      const m = (await db.query('SELECT department_id FROM staff_members WHERE id = $1', [id])).rows[0];
      if (!m) throw Object.assign(new Error('Staff member not found.'), { http: 404 });
      if (active) await checkCapacity(db, m.department_id);   // re-enabling must not break the limit
      await db.query('UPDATE staff_members SET is_active = $1 WHERE id = $2', [active, id]);
    });
  } catch (err) {
    if (err.http) return res.status(err.http).json({ error: err.message });
    throw err;
  }
  res.json({ ok: true });
});

module.exports = router;
