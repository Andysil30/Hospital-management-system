// Prescription check page: asks the server whether the code in the address is a real prescription.
(async () => {
  const code = location.pathname.split('/').filter(Boolean).pop();
  const box = $('#verify-box');
  try {
    const r = await api('/public/verify/' + encodeURIComponent(code));
    if (!r.valid) {
      box.innerHTML = `<div class="verify-banner bad"><span class="mark"><span>!</span></span><div>Not found. This code does not match any prescription from AfyaCare Clinic. Do not dispense it.</div></div>
        <p class="text-muted mb-0">Check that the code was copied correctly, or ask the clinic.</p>`;
      return;
    }
    box.innerHTML = `<div class="verify-banner ok"><span class="mark"><span>&#10003;</span></span><div>Genuine prescription from ${esc(r.clinic)}</div></div>
      <div class="row g-3 mb-3">
        <div class="col-sm-6"><div class="small text-muted">Prescribed by</div><strong>${esc(r.doctor)}</strong><div class="small">${esc(r.specialty)}, ${esc(r.department)}</div><div class="small text-muted">${esc(r.qualifications)}</div></div>
        <div class="col-sm-6"><div class="small text-muted">Patient</div><strong>${esc(r.patient)}</strong><div class="small text-muted mt-2">Date</div><strong>${fmtDate(r.date)}</strong><div class="small text-muted mt-2">Code</div><strong>${esc(r.code)}</strong></div>
      </div>
      <div class="table-wrap"><table class="table align-middle mb-0"><thead><tr><th>Medicine</th><th>Dose</th><th>How often</th><th class="text-end">Days</th><th class="text-end">Qty</th></tr></thead><tbody>
      ${r.medicines.map((m) => `<tr><td>${esc(m.medicine)}</td><td>${esc(m.dosage)}</td><td>${esc(m.frequency)}</td><td class="text-end">${m.duration_days}</td><td class="text-end">${m.quantity}</td></tr>`).join('') || '<tr><td colspan="5" class="text-muted">No medicines were prescribed.</td></tr>'}
      </tbody></table></div>
      <p class="small text-muted mt-3 mb-0">For privacy only the patient's first name and last initial are shown.</p>`;
  } catch (e) {
    box.innerHTML = `<div class="verify-banner bad"><span class="mark"><span>!</span></span><div>${esc(e.message)}</div></div>`;
  }
})();
