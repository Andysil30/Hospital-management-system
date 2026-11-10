// Working patterns. Every doctor / staff member is given one of these.
// weekday numbers: 0 = Sunday ... 6 = Saturday.
const OFFICE = [['08:00', '13:00'], ['14:00', '17:00']];
const build = (days, ranges) => days.flatMap((d) => ranges.map(([s, e]) => ({ weekday: d, start: s, end: e })));
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const PATTERNS = {
  mon_wed:  { label: 'Mon-Wed, day (08:00-13:00 and 14:00-17:00)', rows: build([1, 2, 3], OFFICE) },
  thu_sun:  { label: 'Thu-Sun, day (Thu-Fri 08:00-17:00, Sat morning, Sun 09:00-12:00)',
              rows: [...build([4, 5], OFFICE), ...build([6], [['08:00', '13:00']]), ...build([0], [['09:00', '12:00']])] },
  day_7:    { label: 'Every day, day shift (07:00-19:00)', rows: build(ALL_DAYS, [['07:00', '19:00']]) },
  // A night shift crosses midnight, so it is stored as two ranges per day.
  night_7:  { label: 'Every day, night shift (19:00-07:00)', rows: build(ALL_DAYS, [['00:00', '07:00'], ['19:00', '23:59']]) },
  office_5: { label: 'Mon-Fri, office hours (08:00-17:00)', rows: build([1, 2, 3, 4, 5], [['08:00', '17:00']]) },
};

// Departments with two people use one of these pairs, so the pair covers the whole week.
const PAIRS = {
  split:  ['mon_wed', 'thu_sun'],   // one works Mon-Wed, the other completes the week
  shift:  ['day_7', 'night_7'],     // one by day, one by night (24-hour services)
  single: ['office_5'],             // exactly one person (Human Resources)
};

// db can be a pool or a transaction client.
async function applyPattern(db, doctorId, key) {
  const p = PATTERNS[key];
  if (!p) throw new Error('Unknown working pattern: ' + key);
  await db.query('DELETE FROM doctor_availability WHERE doctor_id = $1', [doctorId]);
  const params = [doctorId];
  const values = p.rows.map((r, i) => {
    params.push(r.weekday, r.start, r.end);
    return `($1,$${i * 3 + 2},$${i * 3 + 3},$${i * 3 + 4})`;
  });
  await db.query(`INSERT INTO doctor_availability (doctor_id, weekday, start_time, end_time) VALUES ${values.join(',')}`, params);
  await db.query('UPDATE doctors SET schedule = $1 WHERE id = $2', [key, doctorId]);
}

const patternLabel = (key) => (PATTERNS[key] ? PATTERNS[key].label : 'Custom hours');

module.exports = { PATTERNS, PAIRS, applyPattern, patternLabel };
