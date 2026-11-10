// Works out which time slots a doctor offers on a given date.
//   working hours (per weekday)  -> chopped into slot_minutes pieces
//   minus: off-days, past times, and slots already booked
const { query } = require('./db');

const MAX_DAYS_AHEAD = 60;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const toMinutes = (t) => {
  const [h, m] = String(t).split(':');
  return parseInt(h, 10) * 60 + parseInt(m, 10);
};
const toHHMM = (mins) =>
  String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');

async function getSlots(doctorId, date) {
  if (!DATE_RE.test(date)) return { error: 'Invalid date.' };

  const now = (await query(
    `SELECT CURRENT_DATE::text AS today, to_char(LOCALTIME, 'HH24:MI') AS now_time,
            ($1::date - CURRENT_DATE) AS days_ahead, EXTRACT(DOW FROM $1::date)::int AS dow`,
    [date]
  )).rows[0];

  if (now.days_ahead < 0) return { slots: [], note: 'This date has already passed.' };
  if (now.days_ahead > MAX_DAYS_AHEAD) return { slots: [], note: `Bookings open ${MAX_DAYS_AHEAD} days ahead.` };

  const doc = (await query(
    `SELECT d.slot_minutes, dep.bookable FROM doctors d JOIN departments dep ON dep.id = d.department_id WHERE d.id = $1`, [doctorId])).rows[0];
  if (!doc) return { error: 'Doctor not found.' };
  if (!doc.bookable) return { error: 'This department does not take online bookings.' };

  const off = await query('SELECT reason FROM doctor_off_days WHERE doctor_id = $1 AND off_date = $2', [doctorId, date]);
  if (off.rows.length) return { slots: [], note: 'The doctor is off on this day.' };

  const hours = await query(
    'SELECT start_time, end_time FROM doctor_availability WHERE doctor_id = $1 AND weekday = $2 ORDER BY start_time',
    [doctorId, now.dow]
  );
  const booked = await query(
    `SELECT to_char(start_time,'HH24:MI') AS t FROM appointments
     WHERE doctor_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled','no_show')`,
    [doctorId, date]
  );
  const taken = new Set(booked.rows.map((r) => r.t));

  const seen = new Set();
  const slots = [];
  for (const h of hours.rows) {
    for (let m = toMinutes(h.start_time); m + doc.slot_minutes <= toMinutes(h.end_time); m += doc.slot_minutes) {
      const t = toHHMM(m);
      if (seen.has(t)) continue;
      seen.add(t);
      if (now.days_ahead === 0 && t <= now.now_time) continue; // already past today
      slots.push({ time: t, available: !taken.has(t) });
    }
  }
  slots.sort((a, b) => a.time.localeCompare(b.time));
  return { slots, note: slots.length ? null : 'The doctor does not work on this day.' };
}

module.exports = { getSlots, toMinutes };
