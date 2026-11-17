// Doctor workspace logic
renderTopbar('Doctor');

const apptCache = new Map(); // id -> appointment (filled by the dashboard and the queue)
let medicines = [];

// ===================== SCHEDULE / QUEUE =====================
const dateInput = $('#sched-date');
dateInput.value = todayISO();

async function loadSchedule() {
  const d = await api('/doctor/schedule?date=' + dateInput.value);
  d.appointments.forEach((a) => apptCache.set(a.id, a));
  $('#sched-summary').textContent = `${d.summary.total} booked · ${d.summary.waiting} waiting · ${d.summary.completed} completed`;
  $('#sched-table').innerHTML = d.appointments.map((a) => {
    const live = ['booked', 'checked_in', 'awaiting_lab'].includes(a.status);
    const buttons = live
      ? `${a.status === 'booked' ? `<button class="btn btn-sm btn-outline-primary" data-action="checkin" data-id="${a.id}">Patient arrived</button> ` : ''}
         <button class="btn btn-sm btn-primary" data-action="consult" data-id="${a.id}">Start consultation</button>
         <button class="btn btn-sm btn-outline-secondary" data-action="noshow" data-id="${a.id}">No-show</button>
         <button class="btn btn-sm btn-outline-danger" data-action="cancel-appt" data-id="${a.id}">Cancel</button>`
      : a.has_record ? `<a class="btn btn-sm btn-outline-primary" href="/api/doctor/records/${a.record_id}/prescription.pdf" target="_blank" rel="noopener">Prescription PDF</a>` : '';
    return `<tr>
      <td>${a.queue_no ? '#' + a.queue_no : '-'}</td><td><strong>${esc(a.time)}</strong></td>
      <td>${esc(a.patient)}<div class="text-muted small">${a.age != null ? a.age + ' yrs' : ''} ${esc(a.gender || '')}</div></td>
      <td>${esc(a.reason || '')}</td><td>${chip(a.status)}${triageBadges(a)}</td><td class="text-end">${buttons}</td></tr>`;
  }).join('') || `<tr><td colspan="6">${empty('No appointments on this date.')}</td></tr>`;
}
// Small badges next to the status: vitals recorded, lab progress
const triageBadges = (a) => ' ' + [
  a.has_vitals ? '<span class="chip ok" title="Vitals recorded by the nurse">Vitals</span>' : '',
  a.lab_pending ? `<span class="chip awaiting_lab">Lab ${a.lab_done}/${a.lab_done + a.lab_pending}</span>` : (a.lab_done ? '<span class="chip ok">Lab ready</span>' : ''),
].join(' ');

const refresh = () => loadSchedule().catch((e) => toast(e.message, 'error'));

dateInput.addEventListener('change', refresh);
actions['day-prev'] = () => { dateInput.value = addDaysISO(dateInput.value, -1); refresh(); };
actions['day-next'] = () => { dateInput.value = addDaysISO(dateInput.value, 1); refresh(); };
actions['day-today'] = () => { dateInput.value = todayISO(); refresh(); };

const setStatus = (btn, status, msg) => run(btn, async () => {
  await api(`/doctor/appointments/${btn.dataset.id}/status`, { method: 'POST', body: { status } });
  toast(msg);
  await Promise.all([loadSchedule(), loadDashboard()]);
});
actions.checkin = (b) => setStatus(b, 'checked_in', 'Patient marked as arrived.');
actions.noshow = (b) => { if (confirm('Mark this patient as a no-show? Their slot will reopen.')) setStatus(b, 'no_show', 'Marked as no-show.'); };
actions['cancel-appt'] = (b) => { if (confirm('Cancel this appointment? The patient will see it as cancelled.')) setStatus(b, 'cancelled', 'Appointment cancelled.'); };

// ===================== CONSULTATION (EMR) =====================
const consultModal = new bootstrap.Modal('#consultModal');

function renderHistory(data) {
  const p = data.profile;
  $('#c-profile').innerHTML = `
    <div><strong>${esc(p.full_name)}</strong>${p.age != null ? ', ' + p.age + ' yrs' : ''} ${esc(p.gender || '')}</div>
    <div class="small text-muted">Blood group: ${esc(p.blood_group || 'not recorded')} · ${esc(p.phone || 'no phone')}</div>
    <div class="small ${p.allergies ? 'text-danger fw-semibold' : 'text-muted'}">Allergies: ${esc(p.allergies || 'none recorded')}</div>`;
  $('#c-history').innerHTML = data.records.map((r) => `
    <div class="visit"><div class="when">${fmtDate(r.date)} · ${esc(r.doctor)}</div>
      <div><strong>${esc(r.diagnosis)}</strong></div><div class="small">${esc(r.notes || '')}</div>
      ${r.prescriptions.map((x) => `<div class="rx-line">${esc(x.medicine)}: ${esc(x.dosage)}, ${esc(x.frequency)}, ${x.duration_days} days</div>`).join('')}
    </div>`).join('') || empty('No previous visits recorded.');
}

let labTests = null;       // the catalogue of tests, loaded once
let currentClinical = null; // triage + lab info for the open consultation

const flagChip = (f) => (f === 'abnormal' ? '<span class="chip bad">Abnormal</span>' : '<span class="chip ok">Normal</span>');

function renderClinical(c) {
  currentClinical = c;
  const v = c.vitals;
  const hi = (bad, txt) => `<span class="chip ${bad ? 'bad' : 'ok'}">${txt}</span>`;
  $('#c-triage').innerHTML = (v
    ? `<div class="d-flex flex-wrap gap-1 mb-1">
        ${v.bp_systolic ? hi(v.bp_systolic >= 140 || v.bp_diastolic >= 90 || v.bp_systolic < 90, `BP ${v.bp_systolic}/${v.bp_diastolic}`) : ''}
        ${v.temperature_c ? hi(v.temperature_c >= 38 || v.temperature_c < 35.5, `${v.temperature_c} &deg;C`) : ''}
        ${v.pulse ? hi(v.pulse > 110 || v.pulse < 50, `Pulse ${v.pulse}`) : ''}
        ${v.spo2 ? hi(v.spo2 < 95, `SpO2 ${v.spo2}%`) : ''}
        ${v.weight_kg ? `<span class="chip">${v.weight_kg} kg</span>` : ''}</div>
       <div class="small text-muted">Recorded by ${esc(v.by || 'nurse')} at ${esc(v.at)}${v.notes ? '. Note: ' + esc(v.notes) : ''}</div>`
    : '<div class="small text-muted">No vitals recorded yet. The nurse records them at triage.</div>')
    + `<div class="small mt-2">Cover: ${c.cover && c.cover.insurance_provider ? esc(c.cover.insurance_provider) + ' ' + esc(c.cover.insurance_number || '') + (c.cover.insurance_status === 'verified' ? ' <span class="chip ok">verified</span>' : ' <span class="chip bad">not verified</span>') + ' <span class="text-muted">(demo check)</span>' : '<span class="text-muted">Not provided</span>'}</div>`;

  const pending = c.labs.filter((l) => l.status === 'requested').length;
  $('#c-labs').innerHTML = c.labs.map((l) => `
    <div class="py-1 border-top small"><strong>${esc(l.test)}</strong> ${l.status === 'requested' ? '<span class="chip awaiting_lab">Awaiting result</span>' : flagChip(l.result_flag)}
    ${l.result_text ? `<div>${esc(l.result_text)}</div>` : ''}</div>`).join('') || '<div class="small text-muted">No tests requested for this visit.</div>';
  $('#c-lab-form').classList.add('d-none');
  // The server refuses to complete a visit while results are pending; make that obvious here too
  const save = $('#consult-form button[type=submit]');
  save.disabled = pending > 0;
  save.title = pending > 0 ? 'Wait for the laboratory results first' : '';
}

actions.consult = (btn) => run(btn, async () => {
  const appt = apptCache.get(Number(btn.dataset.id));
  const [history, meds, clinical] = await Promise.all([
    api(`/doctor/patients/${appt.patient_id}/history`), api('/doctor/medicines'), api(`/doctor/appointments/${appt.id}/clinical`)]);
  if (!labTests) labTests = await api('/doctor/lab-tests');
  medicines = meds;
  $('#consultTitle').textContent = `Consultation · ${appt.patient} · ${appt.time}`;
  $('#c-appt').value = appt.id;
  $('#c-diag').value = ''; $('#c-notes').value = ''; $('#rx-rows').innerHTML = '';
  renderHistory(history);
  renderClinical(clinical);
  consultModal.show();
});

// Choose tests (grouped by type) and send them to the laboratory
actions['lab-toggle'] = () => {
  const form = $('#c-lab-form');
  if (form.classList.contains('d-none')) {
    const groups = {};
    labTests.forEach((t) => { (groups[t.category || 'Other'] = groups[t.category || 'Other'] || []).push(t); });
    $('#c-lab-list').innerHTML = Object.keys(groups).map((g) => `<div class="fw-semibold small mt-2">${esc(g)}</div>` + groups[g].map((t) => `
      <div class="form-check"><input class="form-check-input lab-pick" type="checkbox" id="lt-${t.id}" value="${t.id}"><label class="form-check-label small" for="lt-${t.id}">${esc(t.name)} <span class="text-muted">${money(t.price)}</span></label></div>`).join('')).join('');
  }
  form.classList.toggle('d-none');
};

actions['lab-send'] = (btn) => run(btn, async () => {
  const ids = $$('.lab-pick:checked').map((c) => Number(c.value));
  if (!ids.length) return toast('Tick at least one test.', 'error');
  await api('/doctor/lab-requests', { method: 'POST', body: { appointment_id: $('#c-appt').value, test_ids: ids, notes: $('#c-lab-note').value } });
  consultModal.hide();
  toast('Sent to the laboratory. The patient now shows as awaiting lab.');
  await Promise.all([loadSchedule(), loadDashboard()]);
});

// Medicines grouped by type (Antibiotics, Cardiovascular...) so a long list stays easy to scan
function medOptions() {
  const groups = {};
  medicines.forEach((m) => { (groups[m.category || 'Other'] = groups[m.category || 'Other'] || []).push(m); });
  return Object.keys(groups).sort().map((g) =>
    `<optgroup label="${esc(g)}">${groups[g].map((m) => `<option value="${m.id}">${esc(m.name)} (${m.stock_qty} left)</option>`).join('')}</optgroup>`).join('');
}

actions['rx-add'] = () => {
  const row = document.createElement('div');
  row.className = 'row g-2 mb-2 rx-row align-items-end';
  row.innerHTML = `
    <div class="col-12 col-md-4"><label class="form-label small mb-0">Medicine</label>
      <select class="form-select form-select-sm rx-med">${medOptions()}</select></div>
    <div class="col-6 col-md-2"><label class="form-label small mb-0">Dose</label><input class="form-control form-control-sm rx-dose" placeholder="1 tablet"></div>
    <div class="col-6 col-md-2"><label class="form-label small mb-0">How often</label><input class="form-control form-control-sm rx-freq" placeholder="Twice daily"></div>
    <div class="col-4 col-md-1"><label class="form-label small mb-0">Days</label><input class="form-control form-control-sm rx-days" type="number" min="1" value="5"></div>
    <div class="col-4 col-md-2"><label class="form-label small mb-0">Qty to dispense</label><input class="form-control form-control-sm rx-qty" type="number" min="1" value="10"></div>
    <div class="col-4 col-md-1"><button type="button" class="btn btn-sm btn-outline-danger w-100" data-action="rx-remove" aria-label="Remove medicine">X</button></div>`;
  $('#rx-rows').appendChild(row);
};
actions['rx-remove'] = (btn) => btn.closest('.rx-row').remove();

$('#consult-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const prescriptions = $$('.rx-row').map((r) => ({
    medicine_id: $('.rx-med', r).value, dosage: $('.rx-dose', r).value.trim(), frequency: $('.rx-freq', r).value.trim(),
    duration_days: $('.rx-days', r).value, quantity: $('.rx-qty', r).value,
  }));
  run($('button[type=submit]', e.target), async () => {
    await api('/doctor/records', { method: 'POST', body: {
      appointment_id: $('#c-appt').value, diagnosis: $('#c-diag').value, notes: $('#c-notes').value, prescriptions } });
    consultModal.hide();
    toast('Visit saved and completed.');
    await Promise.all([loadSchedule(), loadDashboard()]);
  });
});

// ===================== AVAILABILITY =====================
let hours = [];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function renderWeek() {
  $('#week-grid').innerHTML = WEEK_ORDER.map((day) => {
    const ranges = hours.map((h, i) => ({ ...h, i })).filter((h) => h.weekday === day);
    return `<div class="d-flex flex-wrap align-items-center gap-2 py-2 border-bottom">
      <div style="width:7rem"><strong>${DAYS[day]}</strong></div>
      <div class="flex-grow-1 d-flex flex-wrap gap-2">
        ${ranges.map((r) => `<span class="d-inline-flex align-items-center gap-1">
          <input type="time" class="form-control form-control-sm w-auto" data-i="${r.i}" data-field="start" value="${r.start}" aria-label="${DAYS[day]} start">
          to <input type="time" class="form-control form-control-sm w-auto" data-i="${r.i}" data-field="end" value="${r.end}" aria-label="${DAYS[day]} end">
          <button class="btn btn-sm btn-outline-danger" data-action="range-del" data-i="${r.i}" aria-label="Remove period">X</button></span>`).join('') || '<span class="text-muted">Day off</span>'}
      </div>
      <button class="btn btn-sm btn-outline-primary" data-action="range-add" data-day="${day}">Add hours</button></div>`;
  }).join('');
}
$('#week-grid').addEventListener('change', (e) => {
  const el = e.target.closest('[data-field]');
  if (el) hours[Number(el.dataset.i)][el.dataset.field] = el.value;
});
actions['range-add'] = (btn) => { hours.push({ weekday: Number(btn.dataset.day), start: '09:00', end: '17:00' }); renderWeek(); };
actions['range-del'] = (btn) => { hours.splice(Number(btn.dataset.i), 1); renderWeek(); };

actions['save-avail'] = (btn) => run(btn, async () => {
  await api('/doctor/availability', { method: 'PUT', body: { slot_minutes: $('#slot-min').value, hours } });
  toast('Working hours saved.');
});

async function loadAvailability() {
  const a = await api('/doctor/availability');
  hours = a.hours;
  $('#slot-min').value = String(a.slot_minutes);
  renderWeek();
  $('#off-list').innerHTML = a.off_days.map((o) => `
    <li class="d-flex justify-content-between align-items-center py-2 border-bottom">
      <span>${fmtDate(o.off_date)}<span class="text-muted small d-block">${esc(o.reason || '')}</span></span>
      <button class="btn btn-sm btn-outline-danger" data-action="off-del" data-id="${o.id}">Remove</button></li>`).join('')
    || '<li class="text-muted">No upcoming off-days.</li>';
}
$('#off-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run($('button[type=submit]', e.target), async () => {
    await api('/doctor/off-days', { method: 'POST', body: { off_date: $('#off-date').value, reason: $('#off-reason').value } });
    e.target.reset();
    toast('Off-day added.');
    await loadAvailability();
  });
});
actions['off-del'] = (btn) => run(btn, async () => {
  await api('/doctor/off-days/' + btn.dataset.id, { method: 'DELETE' });
  await loadAvailability();
});

// ===================== FEEDBACK =====================
async function loadFeedback() {
  const f = await api('/doctor/feedback');
  $('#fb-head').innerHTML = f.total
    ? `<h2>Your rating</h2><div class="d-flex align-items-center gap-3"><span class="display-6 brand">${f.avg_rating}</span> ${stars(f.avg_rating)} <span class="text-muted">from ${f.total} reviews</span></div>`
    : '<h2>Your rating</h2>';
  $('#fb-list').innerHTML = f.recent.map((r) => `
    <div class="py-2 border-top">${stars(r.rating)} <span class="text-muted small ms-2">${fmtDate(r.date)}</span>
    <div>${esc(r.comment || 'No comment left.')}</div></div>`).join('') || empty('No feedback yet. Patients can rate you after a completed visit.');
}

// ===================== DASHBOARD =====================
const IC = {
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
};
const kpiIcon = (n) => `<span class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg></span>`;
const roleColor = (v) => getComputedStyle(document.body).getPropertyValue(v).trim();

let dashDate = todayISO();

async function loadDashboard() {
  const o = await api('/doctor/overview');

  // Lab results are back: tell the doctor
  o.labReady.forEach((r) => apptCache.set(r.id, { id: r.id, patient_id: r.patient_id, patient: r.patient, time: r.time }));
  $('#lab-alert').innerHTML = o.labReady.length
    ? `<div class="alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2"><div><strong>Lab results are ready</strong> for ${o.labReady.map((r) => `${esc(r.patient)} (${r.tests} test${r.tests === 1 ? '' : 's'}${r.abnormal ? ', ' + r.abnormal + ' abnormal' : ''})`).join('; ')}</div>
        <div class="d-flex gap-2">${o.labReady.map((r) => `<button class="btn btn-sm btn-primary" data-action="consult" data-id="${r.id}">Open ${esc(r.patient.split(' ')[0])}</button>`).join('')}</div></div>`
    : '';

  // Summary cards (the first one is highlighted)
  const cards = [
    ['cal', "Today's appointments", o.today.total, `${o.today.waiting} waiting`],
    ['check', 'Completed today', o.today.completed, `of ${o.today.total} booked`],
    ['users', 'Patients this month', o.month, 'different patients seen'],
    ['star', 'My rating', o.rating.total ? o.rating.avg + ' / 5' : '-', o.rating.total ? `${o.rating.total} review${o.rating.total === 1 ? '' : 's'}` : 'No reviews yet'],
  ];
  $('#dash-kpis').innerHTML = cards.map(([i, lbl, num, sub]) =>
    `<div class="kpi">${kpiIcon(i)}<div class="lbl">${esc(lbl)}</div><div class="num">${esc(num)}</div><div class="sub">${esc(sub)}</div></div>`).join('');

  // Two smooth lines: patients seen (past) and patients booked (upcoming)
  const dark = roleColor('--role-dark'), mint = '#3fbf9a';
  drawChart('doctorChart', {
    type: 'line',
    data: {
      labels: o.series.map((r) => r.label),
      datasets: [
        { label: 'Patients seen', data: o.series.map((r) => r.seen), borderColor: dark, backgroundColor: dark, borderWidth: 3, tension: 0.4, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'Booked (upcoming)', data: o.series.map((r) => r.upcoming), borderColor: mint, backgroundColor: mint, borderWidth: 3, tension: 0.4, pointRadius: 0, pointHoverRadius: 5 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#edf1ee' } } },
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
    },
  });

  // Next patient
  if (o.next) {
    apptCache.set(o.next.id, { id: o.next.id, patient_id: o.next.patient_id, patient: o.next.patient, time: o.next.time });
    const when = o.next.date === todayISO() ? 'Today' : fmtDate(o.next.date);
    $('#next-card').innerHTML = `<div class="next-card">
      <div class="lbl">Next patient</div><div class="big">${esc(o.next.time)}</div>
      <div class="lbl">${esc(when)}</div>
      <div class="mt-3"><strong>${esc(o.next.patient)}</strong></div>
      <div class="lbl">${esc(o.next.reason || 'No reason given')}</div>
      <button class="btn btn-light mt-3" data-action="consult" data-id="${o.next.id}">Start consultation</button></div>`;
  } else {
    $('#next-card').innerHTML = `<div class="panel h-100"><h2>Next patient</h2>${empty('No upcoming appointments.')}</div>`;
  }

  // Rating breakdown (doughnut) and recent comments
  const r = o.rating;
  if (r.total) {
    $('#rating-sub').textContent = `${r.avg} average from ${r.total} review${r.total === 1 ? '' : 's'}`;
    $('#ratingChart').style.display = '';
    drawChart('ratingChart', {
      type: 'doughnut',
      data: { labels: ['5 stars', '4 stars', '3 stars', '2 stars', '1 star'], datasets: [{ data: [r.r5, r.r4, r.r3, r.r2, r.r1], backgroundColor: [dark, '#4fa3b8', '#9bcad6', '#e6c36a', '#c65a3a'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8 } } } },
    });
  } else {
    $('#rating-sub').textContent = 'Patients can rate you after a completed visit.';
    $('#ratingChart').style.display = 'none';
  }
  $('#dash-feedback').innerHTML = o.recent.map((f) => `
    <div class="py-2 border-top">${stars(f.rating)} <span class="text-muted small ms-1">${fmtDate(f.date)}</span>
    <div class="small">${esc(f.comment || 'No comment left.')}</div></div>`).join('') || empty('No feedback yet.');

  renderStrip();
  await loadDashSchedule();
}

// The day strip: today and the next six days
function renderStrip() {
  const days = [];
  for (let i = 0; i < 7; i++) days.push(addDaysISO(todayISO(), i));
  $('#day-strip').innerHTML = days.map((d) => {
    const dt = new Date(d + 'T00:00:00Z');
    return `<button type="button" class="day-pill ${d === dashDate ? 'on' : ''}" data-action="dash-day" data-date="${d}">
      ${dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}<strong>${dt.getUTCDate()}</strong></button>`;
  }).join('');
}

async function loadDashSchedule() {
  const d = await api('/doctor/schedule?date=' + dashDate);
  d.appointments.forEach((a) => apptCache.set(a.id, a));
  $('#dash-date-label').textContent = dashDate === todayISO() ? 'Today' : fmtDate(dashDate);
  $('#dash-timeline').innerHTML = d.appointments.map((a) => {
    const live = ['booked', 'checked_in', 'awaiting_lab'].includes(a.status);
    const cls = a.status === 'completed' ? 'done' : (a.status === 'cancelled' || a.status === 'no_show') ? 'cancelled' : '';
    const actions = live ? `<div class="tl-actions">
      ${a.status === 'booked' ? `<button class="btn btn-sm btn-outline-primary" data-action="checkin" data-id="${a.id}">Arrived</button>` : ''}
      <button class="btn btn-sm btn-primary" data-action="consult" data-id="${a.id}">Start</button></div>` : '';
    return `<div class="tl-item"><div class="tl-time">${esc(a.time)}</div>
      <div class="tl-card ${cls}"><strong>${esc(a.patient)}</strong><div class="small">${esc(a.reason || 'No reason given')}</div>
      <div class="mt-1">${chip(a.status)}${triageBadges(a)}${a.record_id ? ` <a class="small ms-1" href="/api/doctor/records/${a.record_id}/prescription.pdf" target="_blank" rel="noopener">PDF</a>` : ''}</div>${actions}</div></div>`;
  }).join('') || empty('No appointments on this day.');
}

actions['dash-day'] = (btn) => {
  dashDate = btn.dataset.date;
  renderStrip();
  loadDashSchedule().catch((e) => toast(e.message, 'error'));
};

onTab('t-dash', () => loadDashboard().catch((e) => toast(e.message, 'error')));
onTab('t-schedule', refresh);
onTab('t-avail', () => loadAvailability().catch((e) => toast(e.message, 'error')));
onTab('t-feedback', () => loadFeedback().catch((e) => toast(e.message, 'error')));
loadDashboard().catch((e) => toast(e.message, 'error'));
refresh();
