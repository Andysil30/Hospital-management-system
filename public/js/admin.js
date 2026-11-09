// Owner / Admin dashboard logic
renderTopbar('Owner');

const state = { period: 'daily', chartType: 'bar', stockFilter: 'all' };

// Make the clicked button in a button-group look "selected"
function markActive(groupId, value) {
  $$('#' + groupId + ' button').forEach((b) => {
    const on = b.dataset.value === value;
    b.classList.toggle('btn-primary', on);
    b.classList.toggle('btn-outline-primary', !on);
  });
}

// ===================== OVERVIEW =====================
async function loadKpis() {
  const s = await api('/admin/summary');
  const items = [
    [money(s.revenue_today), 'Revenue today'],
    [money(s.revenue_month), 'Revenue this month'],
    [s.appointments_today, 'Appointments today'],
    [s.patients_attended, 'Patients attended (all time)'],
    [s.active_doctors, 'Active doctors'],
    [s.low_stock, 'Medicines low on stock', s.low_stock > 0],
    [s.expiring_soon, 'Expiring within 90 days', s.expiring_soon > 0],
  ];
  $('#kpis').innerHTML = items.map(([num, lbl, warn]) =>
    `<div class="kpi ${warn ? 'warn' : ''}"><div class="num">${esc(num)}</div><div class="lbl">${esc(lbl)}</div></div>`).join('');
}

async function loadRevenue() {
  const d = await api('/admin/revenue?period=' + state.period);
  const total = d.consultation.map((v, i) => v + d.pharmacy[i]);
  const isBar = state.chartType === 'bar';
  const datasets = [
    { label: 'Consultations', data: d.consultation, backgroundColor: CHART_COLORS.primary, borderColor: CHART_COLORS.primary, tension: .3 },
    { label: 'Pharmacy', data: d.pharmacy, backgroundColor: CHART_COLORS.accent, borderColor: CHART_COLORS.accent, tension: .3 },
  ];
  if (!isBar) datasets.push({ label: 'Total', data: total, borderColor: CHART_COLORS.gold, backgroundColor: CHART_COLORS.gold, borderWidth: 3, tension: .3 });

  drawChart('revenueChart', {
    type: state.chartType,
    data: { labels: d.labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: { stacked: isBar, grid: { display: false } },
        y: { stacked: isBar, beginAtZero: true, ticks: { callback: (v) => v.toLocaleString('en-KE') } },
      },
      plugins: { tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${money(c.parsed.y)}` } } },
    },
  });
}

async function loadDepartments() {
  const rows = await api('/admin/department-volume?days=30');
  drawChart('deptChart', {
    type: 'bar',
    data: { labels: rows.map((r) => r.name), datasets: [{ label: 'Patients', data: rows.map((r) => r.patients), backgroundColor: CHART_COLORS.primary }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
    },
  });
}

async function loadStaffActivity() {
  const rows = await api('/admin/staff-activity');
  $('#staff-activity').innerHTML = rows.map((r) => `
    <tr><td>${esc(r.full_name)}</td><td>${esc(r.department)}</td>
    <td class="text-end">${r.visits_30d}</td><td class="text-end">${r.booked_today}</td>
    <td>${r.last_login ? esc(new Date(r.last_login).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })) : '<span class="text-muted">never</span>'}</td></tr>`).join('')
    || `<tr><td colspan="5">${empty('No doctors yet.')}</td></tr>`;
}

const loadOverview = () => Promise.all([loadKpis(), loadRevenue(), loadDepartments(), loadStaffActivity()]).catch((e) => toast(e.message, 'error'));

actions.period = (btn) => { state.period = btn.dataset.value; markActive('period-group', state.period); loadRevenue(); };
actions.charttype = (btn) => { state.chartType = btn.dataset.value; markActive('type-group', state.chartType); loadRevenue(); };

// ===================== DOCTOR AWARDS =====================
async function loadAwards() {
  const rows = await api('/admin/top-doctors?period=' + $('#award-period').value);
  const box = $('#award-winner');
  if (!rows.length) {
    box.innerHTML = '';
    $('#award-table').innerHTML = `<tr><td colspan="6">${empty('No patient feedback in this period yet.')}</td></tr>`;
    drawChart('awardChart', { type: 'bar', data: { labels: [], datasets: [] } });
    return;
  }
  const w = rows[0];
  box.innerHTML = `
    <div class="award d-flex flex-wrap justify-content-between align-items-center gap-3">
      <div>
        <div class="meta">Doctor of the period</div>
        <p class="title">${esc(w.full_name)}</p>
        <div class="meta">${esc(w.department)} · ${stars(w.avg_rating)} ${w.avg_rating} average from ${w.reviews} reviews</div>
      </div>
      <div class="text-end"><div class="score">${w.score}</div><div class="meta">award score</div></div>
    </div>`;

  drawChart('awardChart', {
    type: 'bar',
    data: {
      labels: rows.map((r) => r.full_name),
      datasets: [
        { label: 'Award score', data: rows.map((r) => r.score), backgroundColor: rows.map((_, i) => (i === 0 ? CHART_COLORS.gold : CHART_COLORS.primary)) },
        { label: 'Plain average', data: rows.map((r) => r.avg_rating), backgroundColor: CHART_COLORS.grey },
      ],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: { x: { min: 0, max: 5, title: { display: true, text: 'Rating out of 5' } }, y: { grid: { display: false } } },
      plugins: { tooltip: { callbacks: { afterLabel: (c) => `${rows[c.dataIndex].reviews} reviews` } } },
    },
  });

  $('#award-table').innerHTML = rows.map((r, i) => `
    <tr><td>${i === 0 ? '<strong>1 (winner)</strong>' : i + 1}</td><td>${esc(r.full_name)}</td><td>${esc(r.department)}</td>
    <td>${stars(r.avg_rating)} ${r.avg_rating}</td><td class="text-end">${r.reviews}</td><td class="text-end"><strong>${r.score}</strong></td></tr>`).join('');
}
$('#award-period').addEventListener('change', () => loadAwards().catch((e) => toast(e.message, 'error')));

// ===================== PHARMACY =====================
let medCache = [];
async function loadMedicines() {
  medCache = await api('/admin/medicines?filter=' + state.stockFilter);
  $('#med-table').innerHTML = medCache.map((m) => {
    let alert = '<span class="chip ok">OK</span>';
    if (m.expired) alert = '<span class="chip bad">Expired</span>';
    else if (m.low_stock) alert = '<span class="chip bad">Low stock</span>';
    else if (m.expiring_soon) alert = '<span class="chip checked_in">Expires soon</span>';
    if (m.low_stock && (m.expired || m.expiring_soon)) alert += ' <span class="chip bad">Low stock</span>';
    return `<tr><td>${esc(m.name)}</td><td>${esc(m.category || '')}</td><td class="text-end">${money(m.unit_price)}</td>
      <td class="text-end">${m.stock_qty}</td><td class="text-end">${m.reorder_level}</td>
      <td>${m.expiry_date ? fmtDate(m.expiry_date) : '-'}</td><td>${alert}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-action="med-edit" data-id="${m.id}">Edit / restock</button></td></tr>`;
  }).join('') || `<tr><td colspan="8">${empty('Nothing to show for this filter.')}</td></tr>`;
}

actions.stockfilter = (btn) => { state.stockFilter = btn.dataset.value; markActive('stock-filter', state.stockFilter); loadMedicines().catch((e) => toast(e.message, 'error')); };

const medModal = new bootstrap.Modal('#medModal');
function openMed(m) {
  $('#medModalTitle').textContent = m ? 'Edit ' + m.name : 'Add medicine';
  $('#m-id').value = m ? m.id : '';
  $('#m-name').value = m ? m.name : '';
  $('#m-cat').value = m ? m.category || '' : '';
  $('#m-price').value = m ? m.unit_price : '';
  $('#m-stock').value = m ? m.stock_qty : 0;
  $('#m-reorder').value = m ? m.reorder_level : 20;
  $('#m-expiry').value = m && m.expiry_date ? m.expiry_date : '';
  medModal.show();
}
actions['med-new'] = () => openMed(null);
actions['med-edit'] = (btn) => openMed(medCache.find((m) => m.id === Number(btn.dataset.id)));

$('#med-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = $('#m-id').value;
  run($('button[type=submit]', e.target), async () => {
    await api(id ? '/admin/medicines/' + id : '/admin/medicines', {
      method: id ? 'PUT' : 'POST',
      body: {
        name: $('#m-name').value, category: $('#m-cat').value, unit_price: $('#m-price').value,
        stock_qty: $('#m-stock').value, reorder_level: $('#m-reorder').value, expiry_date: $('#m-expiry').value || null,
      },
    });
    medModal.hide();
    toast('Medicine saved.');
    await loadMedicines();
  });
});

// ===================== STAFF =====================
async function loadStaff() {
  const [docs, depts] = await Promise.all([api('/admin/doctors'), api('/admin/departments')]);
  $('#d-dept').innerHTML = depts.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  $('#doctor-table').innerHTML = docs.map((d) => `
    <tr><td>${esc(d.full_name)}<div class="text-muted small">${esc(d.email)}</div></td><td>${esc(d.department)}</td>
    <td class="text-end">${money(d.consultation_fee)}</td>
    <td>${d.is_active ? '<span class="chip ok">Active</span>' : '<span class="chip bad">Disabled</span>'}</td>
    <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-action="doc-toggle" data-id="${d.id}" data-active="${d.is_active}">${d.is_active ? 'Disable' : 'Enable'}</button></td></tr>`).join('');
}

actions['doc-toggle'] = (btn) => run(btn, async () => {
  await api(`/admin/doctors/${btn.dataset.id}/active`, { method: 'POST', body: { is_active: btn.dataset.active !== 'true' } });
  toast('Doctor updated.');
  await loadStaff();
});

$('#doctor-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run($('button[type=submit]', e.target), async () => {
    await api('/admin/doctors', {
      method: 'POST',
      body: {
        full_name: $('#d-name').value, email: $('#d-email').value, password: $('#d-pass').value,
        department_id: $('#d-dept').value, consultation_fee: $('#d-fee').value,
        specialty: $('#d-spec').value, qualifications: $('#d-qual').value,
      },
    });
    e.target.reset();
    toast('Doctor account created. Share the temporary password privately.');
    await loadStaff();
  });
});

$('#dept-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run($('button[type=submit]', e.target), async () => {
    await api('/admin/departments', { method: 'POST', body: { name: $('#dep-name').value } });
    e.target.reset();
    toast('Department added.');
    await loadStaff();
  });
});

// ===================== Tab wiring =====================
onTab('t-overview', loadOverview);
onTab('t-awards', () => loadAwards().catch((e) => toast(e.message, 'error')));
onTab('t-pharmacy', () => loadMedicines().catch((e) => toast(e.message, 'error')));
onTab('t-staff', () => loadStaff().catch((e) => toast(e.message, 'error')));
loadOverview();
