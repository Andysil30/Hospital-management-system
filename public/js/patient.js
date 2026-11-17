// Patient portal logic (English / Kiswahili)
renderTopbar('Patient');

// ===================== DOCTOR DIRECTORY =====================
let doctors = [];

// "Mon-Fri 09:00-13:00, 14:00-17:00" (day names follow the chosen language)
function hoursText(hours) {
  const byDay = {};
  hours.forEach((h) => { (byDay[h.weekday] = byDay[h.weekday] || []).push(`${h.start}-${h.end}`); });
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => byDay[d]);
  const groups = [];
  order.forEach((d) => {
    const key = byDay[d].join(', ');
    const n = d === 0 ? 7 : d; // treat Sunday as day 7 so Sat->Sun can be grouped
    const last = groups[groups.length - 1];
    if (last && last.key === key && last.days[last.days.length - 1] === n - 1) last.days.push(n);
    else groups.push({ key, days: [n] });
  });
  return groups.map((g) => {
    const first = dayShort(g.days[0]);
    const lastD = dayShort(g.days[g.days.length - 1]);
    return `${g.days.length > 1 ? first + '-' + lastD : first} ${g.key}`;
  }).join(' · ') || t('hours.none');
}

async function loadDepartments() {
  const keep = $('#dept-filter').value;
  const deps = await api('/public/departments?bookable=1');
  $('#dept-filter').innerHTML = `<option value="">${esc(t('dept.all'))}</option>` +
    deps.map((d) => `<option value="${d.id}">${esc(d.name)} (${d.doctor_count})</option>`).join('');
  $('#dept-filter').value = keep;
}

const initials = (name) => String(name).replace(/^Dr\.?\s*/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function renderDoctors() {
  $('#doctor-cards').innerHTML = doctors.map((d) => `
    <div class="col-md-6 col-xl-4"><article class="doc-card">
      <div class="d-flex align-items-center gap-3 mb-2"><span class="avatar" aria-hidden="true">${esc(initials(d.full_name))}</span>
        <div><h3>${esc(d.full_name)}</h3><div class="spec">${esc(d.specialty)} · ${esc(d.department)}</div></div></div>
      <div class="my-2">${d.review_count ? `${stars(d.avg_rating)} <span class="small text-muted">${d.avg_rating} (${esc(reviewsText(d.review_count))})</span>` : `<span class="small text-muted">${esc(t('no.reviews'))}</span>`}</div>
      <div class="small mb-2">${esc(d.qualifications)}</div>
      <div class="hours grow">${esc(hoursText(d.hours))}</div>
      <div class="d-flex justify-content-between align-items-center mt-3">
        <strong>${money(d.consultation_fee)}</strong>
        <button class="btn btn-primary btn-sm" data-action="book" data-id="${d.id}">${esc(t('book.btn'))}</button></div>
    </article></div>`).join('') || `<div class="col-12">${empty(t('nodoc'))}</div>`;
}

async function loadDoctors() {
  doctors = await api('/public/doctors' + ($('#dept-filter').value ? '?department_id=' + $('#dept-filter').value : ''));
  renderDoctors();
}
$('#dept-filter').addEventListener('change', () => loadDoctors().catch((e) => toast(e.message, 'error')));

// ===================== BOOKING =====================
const bookModal = new bootstrap.Modal('#bookModal');
const bDate = $('#b-date');
let chosenTime = null;
let bookDoctor = null;
let lastBooked = null;

actions.book = (btn) => {
  const d = doctors.find((x) => x.id === Number(btn.dataset.id));
  bookDoctor = d;
  $('#bookTitle').textContent = t('book.with', { name: d.full_name });
  $('#b-doctor').value = d.id;
  $('#b-reason').value = '';
  bDate.min = todayISO();
  bDate.max = addDaysISO(todayISO(), 60);
  bDate.value = todayISO();
  bookModal.show();
  loadSlots();
};

async function loadSlots() {
  chosenTime = null;
  $('#b-confirm').disabled = true;
  if (!bDate.value) return;
  try {
    const r = await api(`/patient/doctors/${$('#b-doctor').value}/slots?date=${bDate.value}`);
    $('#b-slots').innerHTML = r.slots.map((s) =>
      `<button type="button" class="slot" data-action="pick-slot" data-time="${s.time}" ${s.available ? '' : 'disabled'}>${s.time}</button>`).join('');
    $('#b-note').textContent = r.note ? tr(r.note) : (r.slots.some((s) => s.available) ? '' : t('slots.full'));
  } catch (err) {
    $('#b-slots').innerHTML = '';
    $('#b-note').textContent = err.message;
  }
}
bDate.addEventListener('change', loadSlots);

actions['pick-slot'] = (btn) => {
  chosenTime = btn.dataset.time;
  $$('#b-slots .slot').forEach((s) => s.classList.toggle('selected', s === btn));
  $('#b-confirm').disabled = false;
};

const bookedModal = new bootstrap.Modal('#bookedModal');

function bubbles(messages) {
  return messages.map((m) => `<div class="${m.channel === 'whatsapp' ? 'wa-bubble' : 'sms-bubble'}"><span class="ch">${m.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</span>${esc(m.message)}</div>`).join('');
}

function showBooked(r) {
  lastBooked = { id: r.id, fee: r.fee, doctor: bookDoctor ? bookDoctor.full_name : '' };
  $('#booked-queue').textContent = t('booked.queue', { n: r.queue_no });
  $('#booked-msg-title').textContent = r.messages.length ? t('booked.msg') : t('booked.msg.off');
  $('#booked-msgs').innerHTML = bubbles(r.messages);
  $('#booked-pay').classList.toggle('d-none', !(r.fee > 0));
  bookedModal.show();
}

$('#book-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!chosenTime) return;
  run($('#b-confirm'), async () => {
    let booked;
    try {
      booked = await api('/patient/appointments', { method: 'POST', body: {
        doctor_id: $('#b-doctor').value, date: bDate.value, time: chosenTime, reason: $('#b-reason').value } });
    } catch (err) {
      await loadSlots(); // somebody else may have taken the slot - refresh the list
      throw err;
    }
    bookModal.hide();
    showBooked(booked);
    bootstrap.Tab.getOrCreateInstance($('#t-appts')).show();
  });
});
actions['pay-from-booked'] = () => { bookedModal.hide(); if (lastBooked) openPay(lastBooked); };

// ===================== M-PESA (SIMULATION) =====================
const payModal = new bootstrap.Modal('#payModal');
let payTarget = null;
const showPayStep = (step) => {
  ['form', 'wait', 'done'].forEach((x) => $('#pay-step-' + x).classList.toggle('d-none', x !== step));
  $('#pay-footer').classList.toggle('d-none', step !== 'done');
};

function openPay(info) {
  payTarget = info;
  $('#pay-amount').textContent = money(info.fee);
  $('#pay-for').textContent = t('pay.for', { name: info.doctor });
  $('#pay-error').classList.add('d-none');
  showPayStep('form');
  payModal.show();
}
actions['pay-open'] = (btn) => openPay({ id: Number(btn.dataset.id), fee: Number(btn.dataset.fee), doctor: btn.dataset.doctor });

$('#pay-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = $('#pay-phone').value.trim();
  if (!/^(?:\+?254|0)[17]\d{8}$/.test(phone.replace(/[\s-]/g, ''))) {
    $('#pay-error').textContent = tr('Enter a valid Safaricom number, for example 0712 345 678.');
    return $('#pay-error').classList.remove('d-none');
  }
  // The "STK push": the phone asks for the PIN. We pretend to wait 3 seconds for it.
  $('#pay-wait-text').textContent = t('pay.wait.d', { amount: money(payTarget.fee) });
  showPayStep('wait');
  await new Promise((r) => setTimeout(r, 3000));
  try {
    const r = await api(`/patient/appointments/${payTarget.id}/pay-mpesa`, { method: 'POST', body: { phone } });
    $('#pay-receipt').innerHTML = [
      [t('pay.receipt'), r.receipt], [t('pay.amount'), money(r.amount)], [t('pay.for', { name: r.doctor }), `${fmtDate(r.date)} ${r.time}`],
      ['M-Pesa', r.phone], [t('th.date'), new Date(r.paid_at).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' })],
    ].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    showPayStep('done');
    loadAppointments().catch(() => {});
  } catch (err) {
    $('#pay-error').textContent = err.message;
    $('#pay-error').classList.remove('d-none');
    showPayStep('form');
  }
});

// ===================== MY APPOINTMENTS =====================
async function loadAppointments() {
  const rows = await api('/patient/appointments');
  $('#appt-table').innerHTML = rows.map((a) => {
    let action = '';
    if (a.can_cancel) action = `<button class="btn btn-sm btn-outline-danger" data-action="cancel" data-id="${a.id}">${esc(t('btn.cancel'))}</button>`;
    else if (a.status === 'completed') action = a.reviewed
      ? `<span class="text-muted small">${esc(t('thanks.fb'))}</span>`
      : `<button class="btn btn-sm btn-outline-primary" data-action="feedback" data-id="${a.id}" data-doctor="${esc(a.doctor)}">${esc(t('btn.rate'))}</button>`;
    const queue = a.ahead_in_queue != null
      ? `<div class="small text-muted">${esc(a.ahead_in_queue === 0 ? t('q.next') : t('q.ahead', { n: a.ahead_in_queue }))}</div>` : '';
    const pay = a.paid
      ? `<span class="chip ok">${esc(t('pay.paid'))}</span><div class="small text-muted">${esc(a.receipt || '')}</div>`
      : a.can_pay ? `<button class="btn btn-sm btn-mpesa" data-action="pay-open" data-id="${a.id}" data-fee="${a.fee}" data-doctor="${esc(a.doctor)}">${esc(t('pay.btn'))} · ${money(a.fee)}</button>` : '<span class="text-muted">-</span>';
    return `<tr><td>${fmtDate(a.date)}</td><td>${esc(a.time)}</td>
      <td>${esc(a.doctor)}<div class="small text-muted">${esc(a.department)}</div></td>
      <td>${chip(a.status)}${queue}</td><td>${pay}</td><td class="text-end">${action}</td></tr>`;
  }).join('') || `<tr><td colspan="6">${empty(t('empty.appts'))}</td></tr>`;
  loadCover().catch(() => {});
  loadMessages().catch(() => {});
}

// ---------- Insurance / SHA cover ----------
let coverInfo = null;
const maskNo = (n) => (n ? '\u2022'.repeat(Math.max(0, String(n).length - 3)) + String(n).slice(-3) : '');

async function loadCover() {
  coverInfo = await api('/patient/cover');
  const c = coverInfo;
  const status = c.status === 'verified' ? `<span class="chip ok">${esc(t('cover.verified'))}</span>` : c.status === 'not_found' ? `<span class="chip bad">${esc(t('cover.notfound'))}</span>` : '';
  $('#cover-box').innerHTML = `${c.provider ? `<div class="fw-semibold">${esc(c.provider)}</div><div class="text-muted small mb-2">${esc(maskNo(c.number))} ${status}</div>` : `<p class="text-muted">${esc(t('cover.none'))}</p>`}
    <button class="btn btn-sm btn-outline-primary" data-action="cover-open">${esc(t('cover.update'))}</button>`;
}

const coverModal = new bootstrap.Modal('#coverModal');
actions['cover-open'] = () => {
  $('#cv-provider').innerHTML = `<option value="">${esc(t('f.cover.none'))}</option>` + coverInfo.providers.map((p) => `<option>${esc(p)}</option>`).join('');
  $('#cv-provider').value = coverInfo.provider || '';
  $('#cv-number').value = coverInfo.number || '';
  coverModal.show();
};
$('#cover-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run($('button[type=submit]', e.target), async () => {
    await api('/patient/cover', { method: 'PUT', body: { provider: $('#cv-provider').value, number: $('#cv-number').value } });
    coverModal.hide();
    toast(t('cover.saved'));
    await loadCover();
  });
});

// ---------- Mock SMS / WhatsApp messages ----------
async function loadMessages() {
  const r = await api('/patient/messages');
  $('#rem-toggle').checked = r.reminders;
  $('#msg-list').innerHTML = r.messages.map((m) => bubbles([m]) + `<div class="msg-time mb-2">${esc(new Date(m.created_at).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' }))}</div>`).join('')
    || empty(t('msg.empty'));
}
$('#rem-toggle').addEventListener('change', (e) => {
  api('/patient/reminders', { method: 'PUT', body: { enabled: e.target.checked } }).catch((err) => toast(err.message, 'error'));
});

actions.cancel = (btn) => {
  if (!confirm(t('confirm.cancel'))) return;
  run(btn, async () => {
    await api(`/patient/appointments/${btn.dataset.id}/cancel`, { method: 'POST' });
    toast(t('toast.cancelled'));
    await loadAppointments();
  });
};

// ===================== FEEDBACK =====================
const fbModal = new bootstrap.Modal('#fbModal');
actions.feedback = (btn) => {
  $('#fbTitle').textContent = t('fb.title', { name: btn.dataset.doctor });
  $('#f-appt').value = btn.dataset.id;
  $('#f-comment').value = '';
  $$('input[name=rating]').forEach((r) => (r.checked = false));
  fbModal.show();
};
$('#fb-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const picked = $('input[name=rating]:checked');
  if (!picked) return toast(t('fb.pick'), 'error');
  run($('button[type=submit]', e.target), async () => {
    await api('/patient/feedback', { method: 'POST', body: {
      appointment_id: $('#f-appt').value, rating: picked.value, comment: $('#f-comment').value } });
    fbModal.hide();
    toast(t('toast.fb'));
    await loadAppointments();
  });
});

// ===================== HISTORY & PRESCRIPTIONS =====================
const rxLine = (p) => `${esc(p.medicine)}: ${esc(p.dosage)}, ${esc(p.frequency)}, ${esc(t('days.n', { n: p.duration_days }))}`;

async function loadHistory() {
  const [visits, rx, labs] = await Promise.all([api('/patient/history'), api('/patient/prescriptions'), api('/patient/lab-results')]);
  $('#lab-list').innerHTML = labs.map((l) => `<div class="py-2 border-bottom"><div class="d-flex justify-content-between"><strong>${esc(l.test)}</strong>
      ${l.status === 'requested' ? `<span class="chip awaiting_lab">${esc(t('lab.pending'))}</span>` : (l.result_flag === 'abnormal' ? `<span class="chip bad">${esc(t('lab.abnormal'))}</span>` : `<span class="chip ok">${esc(t('lab.normal'))}</span>`)}</div>
      <div class="small text-muted">${fmtDate(l.date)} · ${esc(l.doctor)}</div>${l.result_text ? `<div class="small">${esc(l.result_text)}</div>` : ''}</div>`).join('') || empty(t('lab.empty'));
  $('#visit-list').innerHTML = visits.map((v) => `
    <div class="visit"><div class="when">${fmtDate(v.date)} · ${esc(v.doctor)} · ${esc(v.department)}</div>
      <div><strong>${esc(v.diagnosis)}</strong></div>${v.notes ? `<div class="small">${esc(v.notes)}</div>` : ''}
      ${v.prescriptions.map((p) => `<div class="rx-line">${rxLine(p)}</div>`).join('')}
      ${v.prescriptions.length ? `<a class="small d-inline-block mt-1" href="/api/patient/records/${v.id}/prescription.pdf" target="_blank" rel="noopener">${esc(t('rx.pdf'))}</a>` : ''}
    </div>`).join('') || empty(t('empty.visits'));
  $('#rx-list').innerHTML = rx.map((p) => `
    <div class="py-2 border-bottom"><div class="d-flex justify-content-between"><strong>${esc(p.medicine)}</strong>
      ${p.active ? `<span class="chip ok">${esc(t('rx.active'))}</span>` : `<span class="chip">${esc(t('rx.finished'))}</span>`}</div>
      <div class="small">${esc(p.dosage)}, ${esc(p.frequency)}</div>
      <div class="small text-muted">${esc(p.active ? t('rx.until', { date: fmtDate(p.ends_on) }) : t('rx.prescribed', { date: fmtDate(p.prescribed_on) }))} · ${esc(p.doctor)}</div>
      ${p.instructions ? `<div class="small">${esc(p.instructions)}</div>` : ''}</div>`).join('') || empty(t('empty.rx'));
}

const fail = (e) => toast(e.message, 'error');
onTab('t-doctors', () => loadDoctors().catch(fail));
onTab('t-appts', () => loadAppointments().catch(fail));
onTab('t-history', () => loadHistory().catch(fail));
loadDepartments().then(loadDoctors).catch(fail);

// Redraw whatever is on screen when the language is switched
document.addEventListener('langchange', () => {
  const active = $('.app-tabs .nav-link.active');
  const loader = { 't-doctors': () => loadDepartments().then(renderDoctors), 't-appts': loadAppointments, 't-history': loadHistory }[active && active.id];
  if (loader) loader().catch(fail);
});
