// Fills the database with realistic DEMO data so the dashboards have something to show.
//   npm run db:seed        (run once after db:init)
//   npm run db:reset && npm run db:seed     (to start over)
//
// It creates the full hospital structure (all departments, two doctors or staff each),
// 30 demo patients, a pharmacy stock list, 30 days of visits with payments and
// feedback that follow each doctor's real working days, and upcoming bookings.
// DEMO ONLY: all demo doctors share one known password. Do not use this on a public site.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');
const { applyOrganisation } = require('./org');

const DEMO_DOCTOR_PASSWORD = 'Doctor@123';
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const fmt = (d) => d.toISOString().slice(0, 10);

const FIRST = ['Mary', 'John', 'Faith', 'James', 'Esther', 'Daniel', 'Joyce', 'Samuel', 'Naomi', 'Kevin', 'Ann', 'Victor', 'Lilian', 'Collins', 'Mercy'];
const LAST = ['Odhiambo', 'Kiprop', 'Achieng', 'Mutua', 'Wafula', 'Chebet', 'Omondi', 'Njeri', 'Karanja', 'Barasa', 'Mwende', 'Kimani'];

// name, category, price, stock, reorder level, days until expiry
const MEDICINES = [
  ['Paracetamol 500mg', 'Pain & Inflammation', 5, 600, 100, 540], ['Ibuprofen 400mg', 'Pain & Inflammation', 8, 350, 80, 480],
  ['Amoxicillin 500mg', 'Antibiotics', 20, 40, 100, 300], ['Azithromycin 500mg', 'Antibiotics', 60, 220, 50, 400],
  ['Ciprofloxacin 500mg', 'Antibiotics', 25, 180, 50, 45], ['Metformin 500mg', 'Diabetes & Endocrine', 6, 700, 150, 600],
  ['Amlodipine 5mg', 'Cardiovascular', 9, 420, 100, 520], ['Atorvastatin 20mg', 'Cardiovascular', 18, 15, 60, 380],
  ['Losartan 50mg', 'Cardiovascular', 14, 260, 80, 450], ['Salbutamol Inhaler', 'Respiratory & Allergy', 350, 60, 20, 350],
  ['Cetirizine 10mg', 'Respiratory & Allergy', 4, 500, 100, 700], ['Omeprazole 20mg', 'Gastrointestinal', 12, 310, 80, 30],
  ['ORS Sachets', 'Gastrointestinal', 15, 400, 100, 420], ['Zinc 20mg', 'Vitamins & Supplements', 7, 280, 60, 365],
  ['Hydrocortisone Cream', 'Skin & Topical', 180, 70, 25, 280], ['Clotrimazole Cream', 'Skin & Topical', 150, 12, 25, 250],
  ['Diclofenac Gel', 'Pain & Inflammation', 220, 90, 30, 330], ['Folic Acid 5mg', 'Vitamins & Supplements', 3, 800, 150, 600],
  ['Ferrous Sulphate', 'Vitamins & Supplements', 5, 520, 100, 500], ['Artemether/Lumefantrine', 'Antimalarials & Antiparasitics', 120, 150, 60, 20],
  ['Loratadine 10mg', 'Respiratory & Allergy', 6, 240, 60, 600], ['Expired Test Syrup', 'Respiratory & Allergy', 90, 25, 20, -15],
];

const REASONS = ['Fever and headache', 'Routine check-up', 'Follow-up visit', 'Skin rash', 'Chest discomfort', 'Back pain', 'Cough for two weeks', 'Review of test results'];
const DIAGNOSES = ['Viral infection', 'Hypertension - controlled', 'Allergic dermatitis', 'Lower back strain', 'Upper respiratory infection', 'Malaria (uncomplicated)', 'Gastritis', 'Healthy - routine review'];
const COMMENTS = {
  5: ['Very caring and thorough.', 'Explained everything clearly.', 'Best consultation I have had.', 'Short wait and great care.'],
  4: ['Good doctor, little wait.', 'Professional and kind.', 'Helpful advice.'],
  3: ['Okay, but the visit felt rushed.', 'Average experience.'],
  2: ['Waited long and little explanation.'],
  1: ['Not satisfied with the visit.'],
};

// 30-minute start times that fit inside a doctor's working ranges on one weekday
const toMin = (t) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
function slotsFor(ranges) {
  const out = new Set();
  for (const r of ranges) for (let m = toMin(r.s); m + 30 <= toMin(r.e); m += 30) out.add(hhmm(m));
  return [...out].sort();
}

async function main() {
  const exists = await pool.query(`SELECT 1 FROM users WHERE email = 'admin@hospital.test'`);
  if (exists.rows.length) {
    console.log('Demo data already exists. Run "npm run db:reset" first if you want to start over.');
    return;
  }
  const hash = (pw) => bcrypt.hashSync(pw, 10);
  const today = (await pool.query('SELECT CURRENT_DATE::text AS d')).rows[0].d;
  const todayDate = new Date(today + 'T00:00:00Z');
  const addDays = (n) => fmt(new Date(todayDate.getTime() + n * 86400000));

  console.log('Creating the owner account...');
  await pool.query(`INSERT INTO users (full_name,email,password_hash,role) VALUES ('Hospital Owner','admin@hospital.test',$1,'admin')`, [hash('Admin@123')]);

  console.log('Creating departments, doctors and support staff...');
  const { summary } = await applyOrganisation(pool, { password: DEMO_DOCTOR_PASSWORD });
  console.log(`  ${summary.departments} departments, ${summary.doctors} doctors/clinicians, ${summary.personnel} support staff`);

  // Only doctors in departments patients can book get visit history
  const docs = (await pool.query(
    `SELECT d.id, d.consultation_fee AS fee, u.email FROM doctors d
     JOIN users u ON u.id = d.user_id JOIN departments dep ON dep.id = d.department_id
     WHERE dep.bookable ORDER BY d.id`)).rows;
  const avail = (await pool.query(
    `SELECT doctor_id, weekday, to_char(start_time,'HH24:MI') AS s, to_char(end_time,'HH24:MI') AS e FROM doctor_availability`)).rows;
  for (const d of docs) {
    d.rating = 3.7 + rnd(13) / 10; // each doctor has a typical rating between 3.7 and 4.9
    d.week = {};
    for (const a of avail.filter((x) => x.doctor_id === d.id)) (d.week[a.weekday] = d.week[a.weekday] || []).push(a);
  }

  console.log('Creating patients...');
  const patientIds = [];
  const patHash = hash('Patient@123');
  for (let i = 0; i < 30; i++) {
    const name = i === 0 ? 'Test Patient' : `${pick(FIRST)} ${pick(LAST)}`;
    const email = i === 0 ? 'patient@hospital.test' : `patient${i + 1}@hospital.test`;
    const u = await pool.query(`INSERT INTO users (full_name,email,password_hash,role,phone) VALUES ($1,$2,$3,'patient',$4) RETURNING id`, [name, email, patHash, '+2547111000' + String(i).padStart(2, '0')]);
    const dob = `${1955 + rnd(55)}-${String(1 + rnd(12)).padStart(2, '0')}-${String(1 + rnd(28)).padStart(2, '0')}`;
    const p = await pool.query(`INSERT INTO patients (user_id,date_of_birth,gender,blood_group,allergies) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [u.rows[0].id, dob, pick(['Female', 'Male']), pick(['O+', 'A+', 'B+', 'AB+', 'O-']), pick([null, null, 'Penicillin', 'Peanuts'])]);
    patientIds.push(p.rows[0].id);
  }

  console.log('Creating pharmacy stock...');
  const medIds = [];
  for (const [name, cat, price, stock, reorder, expDays] of MEDICINES) {
    medIds.push((await pool.query(
      `INSERT INTO medicines (name,category,unit_price,stock_qty,reorder_level,expiry_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [name, cat, price, stock, reorder, addDays(expDays)])).rows[0].id);
  }
  const usableMeds = medIds.slice(0, 21); // everything except the expired one

  console.log("Generating 30 days of visits, payments and feedback (on each doctor's working days)...");
  for (let back = 30; back >= 1; back--) {
    const date = addDays(-back);
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    for (const doc of docs) {
      const times = slotsFor(doc.week[dow] || []);
      if (!times.length) continue; // this doctor does not work today
      for (const time of shuffle(times).slice(0, 1 + rnd(3))) {
        const patientId = pick(patientIds);
        const roll = Math.random();
        const status = roll < 0.88 ? 'completed' : roll < 0.96 ? 'cancelled' : 'no_show';
        const appt = (await pool.query(
          `INSERT INTO appointments (patient_id,doctor_id,appointment_date,start_time,status,reason) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [patientId, doc.id, date, time, status, pick(REASONS)])).rows[0];
        if (status !== 'completed') continue;

        const rec = (await pool.query(
          `INSERT INTO medical_records (appointment_id,patient_id,doctor_id,diagnosis,notes,created_at) VALUES ($1,$2,$3,$4,$5,$6::timestamp) RETURNING id`,
          [appt.id, patientId, doc.id, pick(DIAGNOSES), 'Advised rest and hydration. Review if symptoms persist.', `${date} ${time}`])).rows[0];
        await pool.query(`INSERT INTO payments (appointment_id,patient_id,amount,type,method,paid_at) VALUES ($1,$2,$3,'consultation',$4,$5::timestamp)`,
          [appt.id, patientId, doc.fee, pick(['cash', 'mpesa', 'card']), `${date} ${time}`]);

        for (let k = rnd(3); k > 0; k--) {
          const medId = pick(usableMeds);
          const price = MEDICINES[medIds.indexOf(medId)][2];
          const qty = 5 + rnd(20);
          await pool.query(
            `INSERT INTO prescriptions (record_id,patient_id,doctor_id,medicine_id,dosage,frequency,duration_days,quantity,instructions,created_at)
             VALUES ($1,$2,$3,$4,'1 tablet','Twice daily',$5,$6,'Take after meals',$7::timestamp)`,
            [rec.id, patientId, doc.id, medId, 3 + rnd(5), qty, `${date} ${time}`]);
          await pool.query(`INSERT INTO payments (appointment_id,patient_id,amount,type,paid_at) VALUES ($1,$2,$3,'pharmacy',$4::timestamp)`,
            [appt.id, patientId, price * qty, `${date} ${time}`]);
        }

        if (Math.random() < 0.65) {
          const rating = Math.max(1, Math.min(5, Math.round(doc.rating + (Math.random() - 0.5) * 2)));
          await pool.query(`INSERT INTO feedback (appointment_id,patient_id,doctor_id,rating,comment,created_at) VALUES ($1,$2,$3,$4,$5,$6::timestamp)`,
            [appt.id, patientId, doc.id, rating, pick(COMMENTS[rating]), `${date} ${time}`]);
        }
      }
    }
  }

  console.log("Creating today's queue and upcoming bookings...");
  for (let ahead = 0; ahead <= 5; ahead++) {
    const date = addDays(ahead);
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    for (const doc of docs) {
      const times = slotsFor(doc.week[dow] || []);
      for (const time of shuffle(times).slice(0, 1 + rnd(3))) {
        await pool.query(`INSERT INTO appointments (patient_id,doctor_id,appointment_date,start_time,status,reason) VALUES ($1,$2,$3,$4,'booked',$5)`,
          [pick(patientIds), doc.id, date, time, pick(REASONS)]);
      }
    }
  }

  console.log('\nDemo data created. Log in with:');
  console.log('  Owner   : admin@hospital.test / Admin@123');
  console.log(`  Doctor  : ${docs[0].email} / ${DEMO_DOCTOR_PASSWORD}   (every demo doctor uses this password)`);
  console.log('  Patient : patient@hospital.test / Patient@123');
}

main()
  .catch((err) => { console.error('Seeding failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
