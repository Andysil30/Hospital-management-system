// Adds every hospital department and makes sure each one is staffed properly.
// Safe to run again at any time: it only adds what is missing.
//   npm run db:departments
// New doctors get a random password. The e-mails and passwords are saved to
//   db/staff-credentials.csv   (this file is private; it is ignored by Git)
// To give all NEW doctors the same starting password instead, set STAFF_PASSWORD (8+ characters).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');
const { applyOrganisation } = require('./org');
const { patternLabel } = require('../src/schedules');

(async () => {
  try {
    const { created, summary } = await applyOrganisation(pool, { password: process.env.STAFF_PASSWORD || null, log: console.log });
    console.log(`\nAdded ${summary.departments} department(s), ${summary.doctors} doctor/clinician account(s) and ${summary.personnel} support staff member(s).`);
    if (created.length) {
      const file = path.join(__dirname, 'staff-credentials.csv');
      const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
      const lines = ['name,email,password,department,working_pattern'].concat(
        created.map((c) => [c.name, c.email, c.password, c.department, patternLabel(c.schedule)].map(q).join(',')));
      fs.writeFileSync(file, lines.join('\n') + '\n');
      console.log(`Logins saved to ${file}`);
      console.log('Keep that file private, hand each doctor their own e-mail and password, then delete it.');
    }
  } catch (err) {
    console.error('Could not apply departments:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
