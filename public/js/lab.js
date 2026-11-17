// Laboratory portal: pending tests and results
renderTopbar('Laboratory');
let pending = [];
const when = (iso) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

async function loadPending() {
  pending = await api('/lab/requests');
  $('#l-kpis').innerHTML = `<div class="kpi"><div class="lbl">Tests waiting</div><div class="num">${pending.length}</div><div class="sub">oldest first</div></div>
    <div class="kpi"><div class="lbl">Patients waiting</div><div class="num">${new Set(pending.map((r) => r.patient)).size}</div><div class="sub">with at least one test</div></div>`;
  $('#l-pending').innerHTML = pending.map((r) => `
    <tr><td class="small">${esc(when(r.requested_at))}</td>
    <td>${esc(r.patient)}<div class="small text-muted">${r.age != null ? r.age + ' yrs' : ''} ${esc(r.gender || '')}</div></td>
    <td><strong>${esc(r.test)}</strong><div class="small text-muted">${esc(r.category || '')}</div></td>
    <td>${esc(r.doctor)}</td><td class="small">${esc(r.clinical_notes || '')}</td>
    <td class="text-end"><button class="btn btn-sm btn-primary" data-action="result-open" data-id="${r.id}">Enter result</button></td></tr>`).join('')
    || `<tr><td colspan="6">${empty('No tests are waiting. Well done.')}</td></tr>`;
}

async function loadDone() {
  const rows = await api('/lab/requests?status=completed');
  $('#l-done').innerHTML = rows.map((r) => `
    <tr><td class="small">${esc(when(r.completed_at))}</td><td>${esc(r.patient)}</td><td>${esc(r.test)}</td>
    <td class="small">${esc(r.result_text)}</td><td>${r.result_flag === 'abnormal' ? '<span class="chip bad">Abnormal</span>' : '<span class="chip ok">Normal</span>'}</td></tr>`).join('')
    || `<tr><td colspan="5">${empty('No completed tests yet.')}</td></tr>`;
}

const resultModal = new bootstrap.Modal('#resultModal');
actions['result-open'] = (btn) => {
  const r = pending.find((x) => x.id === Number(btn.dataset.id));
  $('#resultTitle').textContent = r.test;
  $('#r-id').value = r.id;
  $('#r-info').textContent = `${r.patient}, requested by ${r.doctor}${r.clinical_notes ? '. Note: ' + r.clinical_notes : ''}`;
  $('#r-text').value = '';
  $('#f-normal').checked = true;
  resultModal.show();
};

$('#result-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run($('button[type=submit]', e.target), async () => {
    const r = await api(`/lab/requests/${$('#r-id').value}/result`, { method: 'POST', body: {
      result_text: $('#r-text').value, result_flag: $('input[name=flag]:checked').value } });
    resultModal.hide();
    toast(r.all_done ? 'Saved. All tests for this patient are done, so the doctor has been notified.' : 'Result saved.');
    await loadPending();
  });
});

onTab('t-done', () => loadDone().catch((e) => toast(e.message, 'error')));
loadPending().catch((e) => toast(e.message, 'error'));
setInterval(() => { if (!document.hidden && !document.querySelector('.modal.show')) loadPending().catch(() => {}); }, 30000);
