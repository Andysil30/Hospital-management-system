// Fills the database with realistic DEMO data so the dashboards have
// something to show.  Run once after db:init:   npm run db:seed
// (To start over:  npm run db:reset && npm run db:seed)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const fmt = (d) => d.toISOString().slice(0, 10);

const DEPARTMENTS = [
  ['General Medicine', 'Primary care and everyday illnesses'],
  ['Paediatrics', 'Care for infants, children and teenagers'],
  ['Cardiology', 'Heart and blood-pressure care'],
  ['Dermatology', 'Skin, hair and nail conditions'],
  ['Orthopaedics', 'Bones, joints and sports injuries'],
  ['Gynaecology', "Women's health and maternity"],
];

// name, dept index, specialty, qualifications, fee (KES), typical rating
const DOCTORS = [
  ['Dr. Amina Wanjiru', 0, 'Family Medicine', 'MBChB (Nairobi), MMed Family Medicine', 2000, 4.7],
  ['Dr. Peter Otieno', 1, 'Paediatrics', 'MBChB (Moi), MMed Paediatrics', 2500, 4.5],
  ['Dr. Grace Mwangi', 2, 'Interventional Cardiology', 'MBChB, MMed Internal Medicine, Fellowship Cardiology', 4500, 4.8],
  ['Dr. Hassan Abdi', 3, 'Clinical Dermatology', 'MBChB (Nairobi), MMed Dermatology', 3000, 4.1],
  ['Dr. Lucy Kamau', 4, 'Orthopaedic Surgery', 'MBChB, MMed Orthopaedic Surgery', 4000, 4.3],
  ['Dr. Brian Njoroge', 5, 'Obstetrics & Gynaecology', 'MBChB (Nairobi), MMed Obs & Gynae', 3500, 3.9],
];

const FIRST = ['Mary', 'John', 'Faith', 'James', 'Esther', 'Daniel', 'Joyce', 'Samuel', 'Naomi', 'Kevin', 'Ann', 'Victor', 'Lilian', 'Collins', 'Mercy'];
const LAST = ['Odhiambo', 'Kiprop', 'Achieng', 'Mutua', 'Wafula', 'Chebet', 'Omondi', 'Njeri', 'Karanja', 'Barasa', 'Mwende', 'Kimani'];

// name, category, price, stock, reorder level, days until expiry
const MEDICINES = [
  ['Paracetamol 500mg', 'Analgesic', 5, 600, 100, 540], ['Ibuprofen 400mg', 'Analgesic', 8, 350, 80, 480],
  ['Amoxicillin 500mg', 'Antibiotic', 20, 40, 100, 300], ['Azithromycin 500mg', 'Antibiotic', 60, 220, 50, 400],
  ['Ciprofloxacin 500mg', 'Antibiotic', 25, 180, 50, 45], ['Metformin 500mg', 'Diabetes', 6, 700, 150, 600],
  ['Amlodipine 5mg', 'Cardiovascular', 9, 420, 100, 520], ['Atorvastatin 20mg', 'Cardiovascular', 18, 15, 60, 380],
  ['Losartan 50mg', 'Cardiovascular', 14, 260, 80, 450], ['Salbutamol Inhaler', 'Respiratory', 350, 60, 20, 350],
  ['Cetirizine 10mg', 'Antihistamine', 4, 500, 100, 700], ['Omeprazole 20mg', 'Gastro', 12, 310, 80, 30],
  ['ORS Sachets', 'Rehydration', 15, 400, 100, 420], ['Zinc 20mg', 'Supplement', 7, 280, 60, 365],
  ['Hydrocortisone Cream', 'Dermatology', 180, 70, 25, 280], ['Clotrimazole Cream', 'Dermatology', 150, 12, 25, 250],
  ['Diclofenac Gel', 'Analgesic', 220, 90, 30, 330], ['Folic Acid 5mg', 'Supplement', 3, 800, 150, 600],
  ['Ferrous Sulphate', 'Supplement', 5, 520, 100, 500], ['Artemether/Lumefantrine', 'Antimalarial', 120, 150, 60, 20],
  ['Loratadine 10mg', 'Antihistamine', 6, 240, 60, 600], ['Expired Test Syrup', 'Cough & Cold', 90, 25, 20, -15],
];

const REASONS = ['Fever and headache', 'Routine check-up', 'Follow-up visit', 'Skin rash', 'Chest discomfort', 'Back pain', 'Cough for two weeks', 'Child vaccination review'];
const DIAGNOSES = ['Viral infection', 'Hypertension - controlled', 'Allergic dermatitis', 'Lower back strain', 'Upper respiratory infection', 'Malaria (uncomplicated)', 'Gastritis', 'Healthy - routine review'];
const COMMENTS = {
  5: ['Very caring and thorough.', 'Explained everything clearly.', 'Best consultation I have had.', 'Short wait and great care.'],
  4: ['Good doctor, little wait.', 'Professional and kind.', 'Helpful advice.'],
  3: ['Okay, but the visit felt rushed.', 'Average experience.'],
  2: ['Waited long and little explanation.'],
  1: ['Not satisfied with the visit.'],
};

const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];

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

  console.log('Creating admin, departments, doctors, patients...');
  await pool.query(`INSERT INTO users (full_name,email,password_hash,role) VALUES ('Hospital Owner','admin@hospital.test',$1,'admin')`, [hash('Admin@123')]);

  const deptIds = [];
  for (const [name, desc] of DEPARTMENTS) {
    deptIds.push((await pool.query('INSERT INTO departments (name,description) VALUES ($1,$2) RETURNING id', [name, desc])).rows[0].id);
  }

  const doctors = [];
  const docHash = hash('Doctor@123');
  for (let i = 0; i < DOCTORS.length; i++) {
    const [name, dep, spec, qual, fee, rating] = DOCTORS[i];
    const u = await pool.query(`INSERT INTO users (full_name,email,password_hash,role,phone) VALUES ($1,$2,$3,'doctor',$4) RETURNING id`,
      [name, `doctor${i + 1}@hospital.test`, docHash, '+2547000000' + (10 + i)]);
    const d = await pool.query(
      `INSERT INTO doctors (user_id,department_id,specialty,qualifications,bio,consultation_fee) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [u.rows[0].id, deptIds[dep], spec, qual, `${name} has several years of experience in ${spec.toLowerCase()}.`, fee]);
    doctors.push({ id: d.rows[0].id, fee, rating });
    for (let day = 1; day <= 5; day++) {
      await pool.query(`INSERT INTO doctor_availability (doctor_id,weekday,start_time,end_time) VALUES ($1,$2,'09:00','13:00'),($1,$2,'14:00','17:00')`, [d.rows[0].id, day]);
    }
    if (i % 2 === 0) await pool.query(`INSERT INTO doctor_availability (doctor_id,weekday,start_time,end_time) VALUES ($1,6,'09:00','12:00')`, [d.rows[0].id]);
  }

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

  console.log('Generating 60 days of visit history, payments and feedback...');
  for (let back = 60; back >= 1; back--) {
    const date = addDays(-back);
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    if (dow === 0) continue; // closed Sundays
    for (const doc of doctors) {
      const count = 2 + rnd(5);
      const times = [...SLOTS].sort(() => Math.random() - 0.5).slice(0, count);
      for (const time of times) {
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

  console.log('Creating today\'s queue and upcoming bookings...');
  for (let ahead = 0; ahead <= 5; ahead++) {
    const date = addDays(ahead);
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    if (dow === 0 || dow === 6) continue;
    for (const doc of doctors) {
      const times = [...SLOTS].sort(() => Math.random() - 0.5).slice(0, 3 + rnd(3));
      for (const time of times) {
        await pool.query(`INSERT INTO appointments (patient_id,doctor_id,appointment_date,start_time,status,reason) VALUES ($1,$2,$3,$4,'booked',$5)`,
          [pick(patientIds), doc.id, date, time, pick(REASONS)]);
      }
    }
  }

  console.log('\nDemo data created. Log in with:');
  console.log('  Admin   : admin@hospital.test    / Admin@123');
  console.log('  Doctor  : doctor1@hospital.test  / Doctor@123   (doctor1 ... doctor6)');
  console.log('  Patient : patient@hospital.test  / Patient@123');
}

main()
  .catch((err) => { console.error('Seeding failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
