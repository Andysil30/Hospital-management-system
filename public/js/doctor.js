// Doctor workspace logic
renderTopbar('Doctor');

let apptCache = [];
let medicines = [];

// ===================== SCHEDULE / QUEUE =====================
const dateInput = $('#sched-date');
dateInput.value = todayISO();

async function loadSchedule() {
  const d = await api('/doctor/schedule?date=' + dateInput.value);
  apptCache = d.appointments;
  $('#sched-summary').textContent = `${d.summary.total} booked · ${d.summary.waiting} waiting · ${d.summary.completed} completed`;
  $('#sched-table').innerHTML = d.appointments.map((a) => {
    const live = a.status === 'booked' || a.status === 'checked_in';
    const buttons = live
      ? `${a.status === 'booked' ? `<button class="btn btn-sm btn-outline-primary" data-action="checkin" data-id="${a.id}">Patient arrived</button> ` : ''}
         <button class="btn btn-sm btn-primary" data-action="consult" data-id="${a.id}">Start consultation</button>
         <button class="btn btn-sm btn-outline-secondary" data-action="noshow" data-id="${a.id}">No-show</button>
         <button class="btn btn-sm btn-outline-danger" data-action="cancel-appt" data-id="${a.id}">Cancel</button>`
      : a.has_record ? `<button class="btn btn-sm btn-outline-primary" data-action="view-history" data-id="${a.id}">View record</button>` : '';
    return `<tr>
      <td>${a.queue_no ? '#' + a.queue_no : '-'}</td><td><strong>${esc(a.time)}</strong></td>
      <td>${esc(a.patient)}<div class="text-muted small">${a.age != null ? a.age + ' yrs' : ''} ${esc(a.gender || '')}</div></td>
      <td>${esc(a.reason || '')}</td><td>${chip(a.status)}</td><td class="text-end">${buttons}</td></tr>`;
  }).join('') || `<tr><td colspan="6">${empty('No appointments on this date.')}</td></tr>`;
}
const refresh = () => loadSchedule().catch((e) => toast(e.message, 'error'));

dateInput.addEventListener('change', refresh);
actions['day-prev'] = () => { dateInput.value = addDaysISO(dateInput.value, -1); refresh(); };
actions['day-next'] = () => { dateInput.value = addDaysISO(dateInput.value, 1); refresh(); };
actions['day-today'] = () => { dateInput.value = todayISO(); refresh(); };

const setStatus = (btn, status, msg) => run(btn, async () => {
  await api(`/doctor/appointments/${btn.dataset.id}/status`, { method: 'POST', body: { status } });
  toast(msg);
  await loadSchedule();
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

actions.consult = (btn) => run(btn, async () => {
  const appt = apptCache.find((a) => a.id === Number(btn.dataset.id));
  const [history, meds] = await Promise.all([api(`/doctor/patients/${appt.patient_id}/history`), api('/doctor/medicines')]);
  medicines = meds;
  $('#consultTitle').textContent = `Consultation · ${appt.patient} · ${appt.time}`;
  $('#c-appt').value = appt.id;
  $('#c-diag').value = ''; $('#c-notes').value = ''; $('#rx-rows').innerHTML = '';
  renderHistory(history);
  consultModal.show();
});

actions['view-history'] = (btn) => run(btn, async () => {
  const appt = apptCache.find((a) => a.id === Number(btn.dataset.id));
  const h = await api(`/doctor/patients/${appt.patient_id}/history`);
  const last = h.records.find(() => true);
  toast(last ? `${fmtDate(last.date)}: ${last.diagnosis}` : 'No record found.');
});

actions['rx-add'] = () => {
  const row = document.createElement('div');
  row.className = 'row g-2 mb-2 rx-row align-items-end';
  row.innerHTML = `
    <div class="col-12 col-md-4"><label class="form-label small mb-0">Medicine</label>
      <select class="form-select form-select-sm rx-med">${medicines.map((m) => `<option value="${m.id}">${esc(m.name)} (${m.stock_qty} left)</option>`).join('')}</select></div>
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
    await loadSchedule();
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

onTab('t-schedule', refresh);
onTab('t-avail', () => loadAvailability().catch((e) => toast(e.message, 'error')));
onTab('t-feedback', () => loadFeedback().catch((e) => toast(e.message, 'error')));
refresh();
