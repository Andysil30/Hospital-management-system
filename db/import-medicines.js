// Adds the starter medicine catalogue (about 200 medicines) to the pharmacy.
//   npm run db:medicines              -> adds them with SAMPLE stock and SAMPLE expiry dates (good for demos)
//   npm run db:medicines -- --empty   -> adds names, groups and prices only (stock 0, no expiry date)
// Safe to run again: medicines that already exist are left untouched (their stock is never overwritten).
// Real expiry dates are printed on each box. Enter them in the Pharmacy tab (or import a CSV) when
// you receive real stock.
require('dotenv').config();
const { pool } = require('../src/db');
const { MEDICINES } = require('./medicines-data');

const emptyMode = process.argv.includes('--empty');
const rnd = (a, b) => a + Math.random() * (b - a);
const iso = (daysFromToday) => new Date(Date.now() + daysFromToday * 86400000).toISOString().slice(0, 10);

// Realistic mix: most stock is fine, a few items are low, a few expire soon, and a couple are already expired
function sample(m) {
  const r = Math.random();
  const stock = r < 0.08 ? Math.floor(m.reorder_level * rnd(0.05, 0.9)) : Math.round(m.reorder_level * rnd(1.4, 6));
  const e = Math.random();
  const days = e < 0.03 ? -Math.round(rnd(5, 60)) : e < 0.10 ? Math.round(rnd(5, 85)) : Math.round(rnd(100, 1100));
  return { stock, expiry: iso(days) };
}

// Older demo data used slightly different group names. Bring them in line with the catalogue.
const TIDY = {
  'Antibiotic': 'Antibiotics', 'Analgesic': 'Pain & Inflammation', 'Antihistamine': 'Respiratory & Allergy',
  'Respiratory': 'Respiratory & Allergy', 'Cough & Cold': 'Respiratory & Allergy', 'Diabetes': 'Diabetes & Endocrine',
  'Gastro': 'Gastrointestinal', 'Rehydration': 'Gastrointestinal', 'Supplement': 'Vitamins & Supplements',
  'Dermatology': 'Skin & Topical', 'Antimalarial': 'Antimalarials & Antiparasitics',
};

(async () => {
  try {
    for (const [from, to] of Object.entries(TIDY)) await pool.query('UPDATE medicines SET category = $2 WHERE category = $1', [from, to]);
    let added = 0, skipped = 0;
    for (const m of MEDICINES) {
      const s = emptyMode ? { stock: 0, expiry: null } : sample(m);
      const { rowCount } = await pool.query(
        `INSERT INTO medicines (name, category, unit_price, stock_qty, reorder_level, expiry_date)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (name) DO NOTHING`,
        [m.name, m.category, m.unit_price, s.stock, m.reorder_level, s.expiry]);
      if (rowCount) added++; else skipped++;
    }
    const total = (await pool.query('SELECT COUNT(*)::int AS n FROM medicines')).rows[0].n;
    console.log(`Added ${added} medicine(s); ${skipped} already existed and were left unchanged. The pharmacy now lists ${total} medicines.`);
    console.log(emptyMode
      ? 'Stock is 0 and no expiry dates are set. Enter real stock and the dates printed on the boxes in the Pharmacy tab.'
      : 'Stock levels and expiry dates are SAMPLE values for demonstration. Replace them with your real stock.');
  } catch (err) {
    console.error('Could not add the medicines:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
