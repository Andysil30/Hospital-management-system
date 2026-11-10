// The hospital's departments and who staffs them.
//   applyOrganisation() is safe to run many times: it adds missing departments and
//   only creates the people that are missing (it never duplicates or deletes).
//
// Staffing rules:
//   pair 'split'  -> 2 people: one works Mon-Wed, the other completes the week (Thu-Sun)
//   pair 'shift'  -> 2 people: one on the day shift, one on the night shift (24-hour services)
//   pair 'single' -> exactly 1 person (Human Resources)
//   kind 'doctor'    -> clinicians WITH a login (e-mail + password of at least 8 characters)
//   kind 'personnel' -> support / non-clinical staff listed for the owner (no login)
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { PAIRS, applyPattern } = require('../src/schedules');

// cat: emergency | specialist | surgical | diagnostic | admin
const DEPARTMENTS = [
  // ---- 1. Emergency & critical care (walk-in, not booked online) ----
  { cat: 'emergency', name: 'Emergency Department', book: false, kind: 'doctor', pair: 'shift', title: 'Dr.', specialty: 'Emergency Medicine', quals: 'MBChB, MMed Emergency Medicine', fee: 3500, desc: 'Fast-paced frontline care for trauma, accidents and sudden severe illness, open 24 hours.' },
  { cat: 'emergency', name: 'Intensive Care Unit (ICU)', book: false, kind: 'doctor', pair: 'shift', title: 'Dr.', specialty: 'Critical Care Medicine', quals: 'MBChB, MMed Anaesthesia and Critical Care', fee: 5000, desc: 'Constant life support and monitoring for critically ill patients.' },
  { cat: 'emergency', name: 'Neonatal Intensive Care Unit (NICU)', book: false, kind: 'doctor', pair: 'shift', title: 'Dr.', specialty: 'Neonatology', quals: 'MBChB, MMed Paediatrics, Neonatology fellowship', fee: 5000, desc: 'Specialised care for premature or critically ill newborns.' },
  { cat: 'emergency', name: 'High Dependency Unit (HDU)', book: false, kind: 'doctor', pair: 'shift', title: 'Dr.', specialty: 'Critical Care Medicine', quals: 'MBChB, MMed Internal Medicine', fee: 4500, desc: 'Close monitoring for patients who are not yet in intensive care.' },

  // ---- 2. Specialised clinical & medical departments (booked online) ----
  { cat: 'specialist', name: 'General Medicine', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Family Medicine', quals: 'MBChB, MMed Family Medicine', fee: 2000, desc: 'Primary care and everyday illnesses' },
  { cat: 'specialist', name: 'Cardiology', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Cardiology', quals: 'MBChB, MMed Internal Medicine, Fellowship Cardiology', fee: 4500, desc: 'Heart and blood-pressure care' },
  { cat: 'specialist', name: 'Oncology', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Oncology', quals: 'MBChB, MMed Internal Medicine, Fellowship Oncology', fee: 5000, desc: 'Cancer diagnosis, chemotherapy and radiation planning' },
  { cat: 'specialist', name: 'Paediatrics', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Paediatrics', quals: 'MBChB, MMed Paediatrics', fee: 2500, desc: 'Care for infants, children and teenagers' },
  { cat: 'specialist', name: 'Obstetrics & Gynaecology', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Obstetrics & Gynaecology', quals: 'MBChB, MMed Obstetrics and Gynaecology', fee: 3500, desc: "Women's health, pregnancy and childbirth" },
  { cat: 'specialist', name: 'Orthopaedics', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Orthopaedic Surgery', quals: 'MBChB, MMed Orthopaedic Surgery', fee: 4000, desc: 'Bones, joints and sports injuries' },
  { cat: 'specialist', name: 'Neurology', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Neurology', quals: 'MBChB, MMed Internal Medicine, Fellowship Neurology', fee: 4500, desc: 'Disorders of the brain, spinal cord and nerves' },
  { cat: 'specialist', name: 'Dermatology', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Clinical Dermatology', quals: 'MBChB, MMed Dermatology', fee: 3000, desc: 'Skin, hair and nail conditions' },
  { cat: 'specialist', name: 'ENT (Ear, Nose and Throat)', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Otolaryngology', quals: 'MBChB, MMed Otorhinolaryngology', fee: 3500, desc: 'Ear, nose, throat and hearing problems' },
  { cat: 'specialist', name: 'Ophthalmology (Eye Care)', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Ophthalmology', quals: 'MBChB, MMed Ophthalmology', fee: 3500, desc: 'Eye tests, infections and vision care' },
  { cat: 'specialist', name: 'Dental & Oral Health', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Dentistry', quals: 'BDS (Bachelor of Dental Surgery)', fee: 2500, desc: 'Check-ups, fillings, extractions and oral care' },
  { cat: 'specialist', name: 'Psychiatry & Mental Health', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Psychiatry', quals: 'MBChB, MMed Psychiatry', fee: 3500, desc: 'Mental health assessment, therapy and treatment' },
  { cat: 'specialist', name: 'Urology', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Urology', quals: 'MBChB, MMed Surgery, Fellowship Urology', fee: 4000, desc: 'Kidney, bladder and urinary tract care' },
  { cat: 'specialist', name: 'Gastroenterology', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Gastroenterology', quals: 'MBChB, MMed Internal Medicine, Fellowship Gastroenterology', fee: 4000, desc: 'Stomach, bowel and liver conditions' },
  { cat: 'specialist', name: 'Endocrinology & Diabetes', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Endocrinology', quals: 'MBChB, MMed Internal Medicine, Fellowship Endocrinology', fee: 4000, desc: 'Diabetes, thyroid and hormone disorders' },
  { cat: 'specialist', name: 'Pulmonology (Chest & Lung)', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Pulmonology', quals: 'MBChB, MMed Internal Medicine, Fellowship Pulmonology', fee: 4000, desc: 'Asthma, chest infections and lung disease' },

  // ---- 3. Surgical departments ----
  { cat: 'surgical', name: 'General Surgery', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'General Surgery', quals: 'MBChB, MMed Surgery', fee: 4500, desc: 'Consultation and surgery for abdominal and general conditions' },
  { cat: 'surgical', name: 'Plastic & Reconstructive Surgery', book: true, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Plastic Surgery', quals: 'MBChB, MMed Surgery, Fellowship Plastic Surgery', fee: 5000, desc: 'Reconstruction after injury, burns and surgery' },
  { cat: 'surgical', name: 'Anaesthesiology', book: false, kind: 'doctor', pair: 'shift', title: 'Dr.', specialty: 'Anaesthesia', quals: 'MBChB, MMed Anaesthesia', fee: 0, desc: 'Anaesthesia and pain control before, during and after operations' },
  { cat: 'surgical', name: 'Operating Theatre (Perioperative Services)', book: false, kind: 'personnel', pair: 'shift', jobs: ['Theatre Nurse (Day)', 'Theatre Nurse (Night)'], desc: 'Sterile theatres where minor and major operations are performed' },

  // ---- 4. Diagnostic & support departments ----
  { cat: 'diagnostic', name: 'Radiology & Diagnostic Imaging', book: false, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Radiology', quals: 'MBChB, MMed Radiology', fee: 0, desc: 'X-rays, CT scans, MRIs and ultrasounds' },
  { cat: 'diagnostic', name: 'Pathology Laboratory', book: false, kind: 'doctor', pair: 'split', title: 'Dr.', specialty: 'Pathology', quals: 'MBChB, MMed Pathology', fee: 0, desc: 'Analysis of blood, tissue and fluid samples' },
  { cat: 'diagnostic', name: 'Pharmacy', book: false, kind: 'personnel', pair: 'shift', jobs: ['Pharmacist (Day)', 'Pharmacist (Night)'], desc: 'Prepares and dispenses prescribed medicines' },
  { cat: 'diagnostic', name: 'Physical Therapy & Rehabilitation', book: true, kind: 'doctor', pair: 'split', title: '', specialty: 'Physiotherapy', quals: 'BSc Physiotherapy, Registered Physiotherapist', fee: 2500, desc: 'Recovery of mobility, strength and function after injury or surgery' },
  { cat: 'diagnostic', name: 'Nutrition & Dietetics', book: true, kind: 'doctor', pair: 'split', title: '', specialty: 'Clinical Nutrition', quals: 'BSc Nutrition and Dietetics, Registered Dietitian', fee: 2000, desc: 'Diet plans for diabetes, weight, pregnancy and recovery' },

  // ---- 5. Non-clinical & administrative departments (staff only, not public) ----
  { cat: 'admin', name: 'Reception & Patient Services', book: false, kind: 'personnel', pair: 'split', jobs: ['Receptionist', 'Receptionist'], desc: 'Front desk, enquiries and patient guidance' },
  { cat: 'admin', name: 'Medical Records (Health Information Management)', book: false, kind: 'personnel', pair: 'split', jobs: ['Health Records Officer', 'Health Records Officer'], desc: 'Secures patient charts, histories and legal compliance' },
  { cat: 'admin', name: 'Billing & Finance', book: false, kind: 'personnel', pair: 'split', jobs: ['Accounts Clerk', 'Accounts Clerk'], desc: 'Invoices, payments and insurance claims' },
  { cat: 'admin', name: 'Human Resources', book: false, kind: 'personnel', pair: 'single', max: 1, jobs: ['HR Manager'], desc: 'Hiring, payroll, onboarding and staff training' },
  { cat: 'admin', name: 'IT Support', book: false, kind: 'personnel', pair: 'split', jobs: ['IT Support Officer', 'IT Support Officer'], desc: 'Keeps the hospital systems and network running' },
];

const FIRST = ['Amina', 'Peter', 'Grace', 'Hassan', 'Lucy', 'Brian', 'Faith', 'James', 'Esther', 'Daniel', 'Joyce', 'Samuel', 'Naomi', 'Kevin', 'Mercy', 'Collins', 'Lilian', 'Victor', 'Ann', 'Joseph', 'Ruth', 'Patrick', 'Beatrice', 'Dennis', 'Caroline', 'Moses', 'Sharon', 'Francis', 'Judith', 'Isaac', 'Rose', 'Stephen', 'Winnie', 'Kennedy', 'Mary', 'George', 'Susan', 'Paul', 'Eunice', 'Martin', 'Alice', 'Simon', 'Purity', 'Felix', 'Gladys', 'Anthony', 'Rehema', 'Oscar', 'Zawadi', 'Nelson'];
const LAST = ['Kithinji', 'Mwiti', 'Murithi', 'Njeru', 'Kirimi', 'Gitonga', 'Muriungi', 'Mutwiri', 'Mugambi', 'Ntoiti', 'Wanjiru', 'Otieno', 'Mwangi', 'Abdi', 'Kamau', 'Njoroge', 'Kiprop', 'Achieng', 'Mutua', 'Wafula', 'Chebet', 'Omondi', 'Njeri', 'Karanja', 'Barasa', 'Mwende', 'Kimani', 'Muthoni', 'Kariuki', 'Ochieng', 'Wekesa', 'Cheruiyot', 'Mugo', 'Maina', 'Nyaga', 'Kinyua', 'Mbogo', 'Muchiri', 'Gitari', 'Kaburu'];

// Random password that is easy to read out (no 0/O or 1/l/I confusion)
function randomPassword(len = 12) {
  const set = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < len - 2; i++) out += set[crypto.randomInt(set.length)];
  return out + '#' + crypto.randomInt(10);
}

async function applyOrganisation(db, opts = {}) {
  const log = opts.log || (() => {});
  const fixedPassword = opts.password || null;
  if (fixedPassword && fixedPassword.length < 8) throw new Error('The staff password must be at least 8 characters.');

  // Older installs called this department "Gynaecology".
  await db.query(`UPDATE departments SET name = 'Obstetrics & Gynaecology'
                  WHERE name = 'Gynaecology' AND NOT EXISTS (SELECT 1 FROM departments WHERE name = 'Obstetrics & Gynaecology')`);

  // Name generator that never repeats an e-mail already in the database
  const taken = new Set((await db.query('SELECT email FROM users')).rows.map((r) => r.email));
  let counter = 0;
  const nextPerson = () => {
    const first = FIRST[counter % FIRST.length];
    const last = LAST[(counter * 3 + Math.floor(counter / FIRST.length)) % LAST.length];
    counter++;
    let email = `${first}.${last}`.toLowerCase() + '@gmail.com';
    let n = 1;
    while (taken.has(email)) email = `${first}.${last}${++n}`.toLowerCase() + '@gmail.com';
    taken.add(email);
    return { first, last, email };
  };
  const phone = () => '+2547' + String(crypto.randomInt(10000000, 99999999));

  const created = []; // credentials of the doctors created in this run
  const summary = { departments: 0, doctors: 0, personnel: 0 };

  for (const d of DEPARTMENTS) {
    const dep = (await db.query(
      `INSERT INTO departments (name, description, category, bookable, max_staff)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, bookable = EXCLUDED.bookable,
         max_staff = EXCLUDED.max_staff, description = COALESCE(departments.description, EXCLUDED.description)
       RETURNING id, (xmax = 0) AS inserted`, [d.name, d.desc, d.cat, d.book, d.max || null])).rows[0];
    if (dep.inserted) { summary.departments++; log(`+ department: ${d.name}`); }
    const patterns = PAIRS[d.pair];

    if (d.kind === 'doctor') {
      const existing = (await db.query('SELECT id FROM doctors WHERE department_id = $1 ORDER BY id', [dep.id])).rows;
      // People already there get the first working pattern(s), so the pair completes the week.
      if (existing.length < patterns.length) {
        for (let i = 0; i < existing.length; i++) await applyPattern(db, existing[i].id, patterns[i]);
      }
      for (let i = existing.length; i < patterns.length; i++) {
        const p = nextPerson();
        const password = fixedPassword || randomPassword();
        const fullName = `${d.title ? d.title + ' ' : ''}${p.first} ${p.last}`;
        const hash = await bcrypt.hash(password, 10);
        const u = await db.query(`INSERT INTO users (full_name, email, password_hash, role, phone) VALUES ($1,$2,$3,'doctor',$4) RETURNING id`,
          [fullName, p.email, hash, phone()]);
        const doc = await db.query(
          `INSERT INTO doctors (user_id, department_id, specialty, qualifications, bio, consultation_fee)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [u.rows[0].id, dep.id, d.specialty, d.quals, `${fullName} has several years of experience in ${d.specialty.toLowerCase()}.`, d.fee]);
        await applyPattern(db, doc.rows[0].id, patterns[i]);
        created.push({ name: fullName, email: p.email, password, department: d.name, schedule: patterns[i] });
        summary.doctors++;
      }
    } else {
      const have = (await db.query('SELECT COUNT(*)::int AS n FROM staff_members WHERE department_id = $1 AND is_active', [dep.id])).rows[0].n;
      for (let i = have; i < patterns.length; i++) {
        const p = nextPerson();
        await db.query(`INSERT INTO staff_members (full_name, job_title, department_id, phone, schedule) VALUES ($1,$2,$3,$4,$5)`,
          [`${p.first} ${p.last}`, d.jobs[i], dep.id, phone(), patterns[i]]);
        summary.personnel++;
      }
    }
  }
  return { created, summary };
}

module.exports = { DEPARTMENTS, applyOrganisation, randomPassword };
