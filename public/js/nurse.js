// Nurse portal: triage queue and vitals
renderTopbar('Nurse');
let queue = [];

const vitalsText = (a) => {
  const parts = [];
  if (a.bp_systolic) parts.push(`BP ${a.bp_systolic}/${a.bp_diastolic}`);
  if (a.temperature_c) parts.push(`${a.temperature_c}&deg;C`);
  if (a.pulse) parts.push(`${a.pulse} bpm`);
  if (a.weight_kg) parts.push(`${a.weight_kg} kg`);
  if (a.spo2) parts.push(`SpO2 ${a.spo2}%`);
  return parts.join(' · ');
};

async function load() {
  queue = await api('/nurse/queue');
  const done = queue.filter((a) => a.has_vitals).length;
  $('#n-kpis').innerHTML = [
    ['clipboard', "Patients today", queue.length, 'on the list'],
    ['check', 'Vitals recorded', done, `of ${queue.length}`],
    ['users', 'Still to triage', queue.length - done, 'waiting for the nurse'],
  ].map(([i, l, n, s]) => `<div class="kpi"><div class="lbl">${esc(l)}</div><div class="num">${esc(n)}</div><div class="sub">${esc(s)}</div></div>`).join('');
  $('#n-table').innerHTML = queue.map((a) => `
    <tr><td><strong>${esc(a.time)}</strong></td>
    <td>${esc(a.patient)}<div class="small text-muted">${a.age != null ? a.age + ' yrs' : ''} ${esc(a.gender || '')}${a.insurance_status === 'verified' ? ' · <span class="chip ok">Cover verified</span>' : ''}</div>
      <div class="small text-muted">${esc(a.reason || '')}</div></td>
    <td>${esc(a.doctor)}<div class="small text-muted">${esc(a.department)}</div></td>
    <td>${chip(a.status)}</td>
    <td class="small">${a.has_vitals ? vitalsText(a) : '<span class="text-muted">Not recorded</span>'}</td>
    <td class="text-end"><button class="btn btn-sm ${a.has_vitals ? 'btn-outline-primary' : 'btn-primary'}" data-action="vitals-open" data-id="${a.id}">${a.has_vitals ? 'Edit vitals' : 'Record vitals'}</button></td></tr>`).join('')
    || `<tr><td colspan="6">${empty('No patients on the list for today.')}</td></tr>`;
}

const vitalsModal = new bootstrap.Modal('#vitalsModal');
actions['vitals-open'] = (btn) => {
  const a = queue.find((x) => x.id === Number(btn.dataset.id));
  $('#vitalsTitle').textContent = `Vitals for ${a.patient}`;
  $('#v-appt').value = a.id;
  $('#v-sys').value = a.bp_systolic ?? ''; $('#v-dia').value = a.bp_diastolic ?? ''; $('#v-temp').value = a.temperature_c ?? '';
  $('#v-pulse').value = a.pulse ?? ''; $('#v-kg').value = a.weight_kg ?? ''; $('#v-spo2').value = a.spo2 ?? ''; $('#v-notes').value = '';
  vitalsModal.show();
};

$('#vitals-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run($('button[type=submit]', e.target), async () => {
    await api('/nurse/vitals', { method: 'POST', body: {
      appointment_id: $('#v-appt').value, bp_systolic: $('#v-sys').value, bp_diastolic: $('#v-dia').value, temperature_c: $('#v-temp').value,
      pulse: $('#v-pulse').value, weight_kg: $('#v-kg').value, spo2: $('#v-spo2').value, notes: $('#v-notes').value } });
    vitalsModal.hide();
    toast('Vitals saved. The doctor can see them now.');
    await load();
  });
});

load().catch((e) => toast(e.message, 'error'));
setInterval(() => { if (!document.hidden && !document.querySelector('.modal.show')) load().catch(() => {}); }, 30000);
