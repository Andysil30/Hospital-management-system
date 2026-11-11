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
let medAll = [];
let medPage = 1;
const MED_PAGE = 25;

async function loadMedicines() {
  medAll = await api('/admin/medicines?filter=' + state.stockFilter);
  const keep = $('#med-cat').value;
  const cats = [...new Set(medAll.map((m) => m.category).filter(Boolean))].sort();
  $('#med-cat').innerHTML = '<option value="">All groups</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  if (cats.includes(keep)) $('#med-cat').value = keep;
  renderMedicines();
}

function renderMedicines() {
  const q = $('#med-search').value.trim().toLowerCase();
  const cat = $('#med-cat').value;
  const list = medAll.filter((m) => (!cat || m.category === cat) && (!q || m.name.toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(list.length / MED_PAGE));
  medPage = Math.min(Math.max(1, medPage), pages);
  const slice = list.slice((medPage - 1) * MED_PAGE, medPage * MED_PAGE);

  $('#med-table').innerHTML = slice.map((m) => {
    let alert = '<span class="chip ok">OK</span>';
    if (m.expired) alert = '<span class="chip bad">Expired</span>';
    else if (m.low_stock) alert = '<span class="chip bad">Low stock</span>';
    else if (m.expiring_soon) alert = '<span class="chip checked_in">Expires soon</span>';
    if (m.low_stock && (m.expired || m.expiring_soon)) alert += ' <span class="chip bad">Low stock</span>';
    return `<tr><td>${esc(m.name)}</td><td>${esc(m.category || '')}</td><td class="text-end">${money(m.unit_price)}</td>
      <td class="text-end">${m.stock_qty}</td><td class="text-end">${m.reorder_level}</td>
      <td>${m.expiry_date ? fmtDate(m.expiry_date) : '-'}</td><td>${alert}</td>
      <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-action="med-edit" data-id="${m.id}">Edit / restock</button></td></tr>`;
  }).join('') || `<tr><td colspan="8">${empty('No medicines match.')}</td></tr>`;
  $('#med-count').textContent = `Showing ${slice.length} of ${list.length} medicine${list.length === 1 ? '' : 's'}`;
  $('#med-pager').textContent = `Page ${medPage} of ${pages}`;
}

$('#med-search').addEventListener('input', () => { medPage = 1; renderMedicines(); });
$('#med-cat').addEventListener('change', () => { medPage = 1; renderMedicines(); });
actions['med-prev'] = () => { medPage--; renderMedicines(); };
actions['med-next'] = () => { medPage++; renderMedicines(); };
actions.stockfilter = (btn) => { state.stockFilter = btn.dataset.value; medPage = 1; markActive('stock-filter', state.stockFilter); loadMedicines().catch((e) => toast(e.message, 'error')); };

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
actions['med-edit'] = (btn) => openMed(medAll.find((m) => m.id === Number(btn.dataset.id)));

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

// ---------- Import medicines from a CSV file ----------
const importModal = new bootstrap.Modal('#importModal');
let importRows = [];

// Reads CSV text (handles quoted cells, commas inside quotes, semicolon or tab separated files)
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = [',', ';', '\t'].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const FIELD_NAMES = {
  name: ['name', 'medicine', 'medicine name', 'drug', 'drug name', 'product', 'item'],
  category: ['category', 'group', 'class', 'type'],
  unit_price: ['unit_price', 'unit price', 'price', 'cost', 'selling price'],
  stock_qty: ['stock_qty', 'stock', 'quantity', 'qty', 'in stock'],
  reorder_level: ['reorder_level', 'reorder level', 'reorder', 'minimum', 'min stock'],
  expiry_date: ['expiry_date', 'expiry date', 'expiry', 'expires', 'exp', 'exp date', 'expiration date'],
};

// 30/06/2027, 30-6-2027, 06/2027 and 2027-06 are all turned into 2027-06-30 style dates
function toISODate(v) {
  v = String(v || '').trim();
  if (!v) return '';
  let m;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if ((m = v.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const lastDay = (y, mo) => String(new Date(Date.UTC(+y, +mo, 0)).getUTCDate()).padStart(2, '0');
  if ((m = v.match(/^(\d{1,2})[\/.-](\d{4})$/))) return `${m[2]}-${m[1].padStart(2, '0')}-${lastDay(m[2], m[1])}`;
  if ((m = v.match(/^(\d{4})[\/.-](\d{1,2})$/))) return `${m[1]}-${m[2].padStart(2, '0')}-${lastDay(m[1], m[2])}`;
  return v;
}

actions['med-import'] = () => {
  $('#imp-file').value = '';
  $('#imp-preview').innerHTML = '';
  $('#imp-result').innerHTML = '';
  $('#imp-go').disabled = true;
  importRows = [];
  importModal.show();
};

actions['csv-template'] = () => {
  const csv = 'name,category,unit_price,stock_qty,reorder_level,expiry_date\n'
    + 'Paracetamol 500mg,Pain & Inflammation,5,600,150,2027-06-30\n'
    + 'Amoxicillin Syrup 125mg/5ml,Antibiotics,180,40,20,2026-12-31\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'medicines-template.csv';
  a.click();
  URL.revokeObjectURL(a.href);
};

$('#imp-file').addEventListener('change', async (e) => {
  importRows = [];
  $('#imp-go').disabled = true;
  $('#imp-result').innerHTML = '';
  const file = e.target.files[0];
  if (!file) return;
  const table = parseCSV(await file.text());
  if (table.length < 2) { $('#imp-preview').innerHTML = '<div class="alert alert-danger">The file needs a header row and at least one medicine.</div>'; return; }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [field, names] of Object.entries(FIELD_NAMES)) col[field] = header.findIndex((h) => names.includes(h));
  if (col.name < 0) { $('#imp-preview').innerHTML = '<div class="alert alert-danger">No "name" column was found in the first row. Check the column names (see the template).</div>'; return; }

  importRows = table.slice(1).map((cells, i) => {
    const get = (f) => (col[f] >= 0 ? String(cells[col[f]] ?? '').trim() : '');
    return { line: i + 2, name: get('name'), category: get('category'), unit_price: get('unit_price').replace(/,/g, ''), stock_qty: get('stock_qty').replace(/,/g, ''), reorder_level: get('reorder_level'), expiry_date: toISODate(get('expiry_date')) };
  });
  const found = Object.keys(FIELD_NAMES).filter((f) => col[f] >= 0).join(', ');
  $('#imp-preview').innerHTML = `<div class="alert alert-success py-2">${importRows.length} row${importRows.length === 1 ? '' : 's'} found. Columns used: ${esc(found)}.</div>
    <div class="table-wrap"><table class="table table-sm mb-0"><thead><tr><th>Name</th><th>Group</th><th>Price</th><th>Stock</th><th>Expiry</th></tr></thead><tbody>
    ${importRows.slice(0, 5).map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td>${esc(r.unit_price)}</td><td>${esc(r.stock_qty)}</td><td>${esc(r.expiry_date)}</td></tr>`).join('')}
    </tbody></table></div>${importRows.length > 5 ? '<div class="small text-muted mt-1">First 5 rows shown.</div>' : ''}`;
  $('#imp-go').disabled = false;
});

actions['csv-go'] = (btn) => run(btn, async () => {
  const mode = $('#imp-mode').value;
  const total = { added: 0, updated: 0, skipped: 0, errors: [] };
  for (let i = 0; i < importRows.length; i += 250) {
    $('#imp-result').innerHTML = `<div class="text-muted">Importing ${Math.min(i + 250, importRows.length)} of ${importRows.length}...</div>`;
    const r = await api('/admin/medicines/import', { method: 'POST', body: { mode, rows: importRows.slice(i, i + 250) } });
    total.added += r.added; total.updated += r.updated; total.skipped += r.skipped; total.errors.push(...r.errors);
  }
  $('#imp-result').innerHTML = `<div class="alert ${total.errors.length ? 'alert-warning' : 'alert-success'}">
    <strong>Done.</strong> Added ${total.added}, updated ${total.updated}, skipped ${total.skipped}${total.errors.length ? `, ${total.errors.length} row(s) had problems` : ''}.
    ${total.errors.length ? `<ul class="mb-0 mt-2 small">${total.errors.slice(0, 20).map((e) => `<li>Line ${e.line}: ${esc(e.error)}</li>`).join('')}${total.errors.length > 20 ? '<li>...and more</li>' : ''}</ul>` : ''}</div>`;
  btn.disabled = true;
  await loadMedicines();
});

// ===================== STAFF =====================
const GROUPS = { emergency: 'Emergency and critical care', specialist: 'Specialist clinics', surgical: 'Surgery', diagnostic: 'Diagnostics and support', admin: 'Administrative' };

function deptOptions(depts) {
  return Object.keys(GROUPS).map((cat) => {
    const list = depts.filter((d) => d.category === cat);
    return list.length ? `<optgroup label="${esc(GROUPS[cat])}">${list.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}

async function loadStaff() {
  const [docs, depts, cover, people, patterns] = await Promise.all([
    api('/admin/doctors'), api('/admin/departments'), api('/admin/coverage'), api('/admin/personnel'), api('/admin/schedule-patterns'),
  ]);
  const keepD = $('#d-dept').value, keepP = $('#p-dept').value;
  $('#d-dept').innerHTML = deptOptions(depts);
  $('#p-dept').innerHTML = deptOptions(depts);
  if (keepD) $('#d-dept').value = keepD;
  if (keepP) $('#p-dept').value = keepP;
  const patOpts = patterns.map((p) => `<option value="${p.key}">${esc(p.label)}</option>`).join('');
  if (!$('#d-pattern').options.length) { $('#d-pattern').innerHTML = patOpts; $('#p-pattern').innerHTML = patOpts; }

  const badge = { ok: '<span class="chip ok">OK</span>', short: '<span class="chip bad">Needs more staff</span>', over: '<span class="chip bad">Over the limit</span>' };
  $('#coverage-table').innerHTML = cover.map((c) => `
    <tr><td>${esc(c.name)}${c.max_staff ? ` <span class="text-muted small">(limit ${c.max_staff})</span>` : ''}</td><td>${esc(GROUPS[c.category])}</td>
    <td class="text-end">${c.clinicians}</td><td class="text-end">${c.personnel}</td><td>${badge[c.status]}</td></tr>`).join('');

  $('#doctor-table').innerHTML = docs.map((d) => `
    <tr><td>${esc(d.full_name)}<div class="text-muted small">${esc(d.email)}</div></td><td>${esc(d.department)}</td>
    <td class="small">${esc(d.schedule_label)}</td><td class="text-end">${money(d.consultation_fee)}</td>
    <td>${d.is_active ? '<span class="chip ok">Active</span>' : '<span class="chip bad">Disabled</span>'}</td>
    <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-action="doc-toggle" data-id="${d.id}" data-active="${d.is_active}">${d.is_active ? 'Disable' : 'Enable'}</button></td></tr>`).join('')
    || `<tr><td colspan="6">${empty('No doctors yet.')}</td></tr>`;

  $('#personnel-table').innerHTML = people.map((m) => `
    <tr><td>${esc(m.full_name)}</td><td>${esc(m.department)}</td><td>${esc(m.job_title)}</td><td class="small">${esc(m.schedule_label)}</td>
    <td>${m.is_active ? '<span class="chip ok">Active</span>' : '<span class="chip bad">Inactive</span>'}</td>
    <td class="text-end"><button class="btn btn-sm btn-outline-primary" data-action="staff-toggle" data-id="${m.id}" data-active="${m.is_active}">${m.is_active ? 'Disable' : 'Enable'}</button></td></tr>`).join('')
    || `<tr><td colspan="6">${empty('No personnel yet.')}</td></tr>`;
}

actions['doc-toggle'] = (btn) => run(btn, async () => {
  await api(`/admin/doctors/${btn.dataset.id}/active`, { method: 'POST', body: { is_active: btn.dataset.active !== 'true' } });
  toast('Doctor updated.');
  await loadStaff();
});
actions['staff-toggle'] = (btn) => run(btn, async () => {
  await api(`/admin/personnel/${btn.dataset.id}/active`, { method: 'POST', body: { is_active: btn.dataset.active !== 'true' } });
  toast('Staff member updated.');
  await loadStaff();
});

$('#doctor-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('#d-email').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return toast('Enter a valid e-mail address, for example example@gmail.com.', 'error');
  if ($('#d-pass').value.length < 8) return toast('The password must be at least 8 characters.', 'error');
  run($('button[type=submit]', e.target), async () => {
    await api('/admin/doctors', {
      method: 'POST',
      body: {
        full_name: $('#d-name').value, email, password: $('#d-pass').value,
        department_id: $('#d-dept').value, schedule: $('#d-pattern').value, consultation_fee: $('#d-fee').value,
        specialty: $('#d-spec').value, qualifications: $('#d-qual').value,
      },
    });
    e.target.reset();
    toast('Doctor account created. Share the e-mail and password privately.');
    await loadStaff();
  });
});

$('#personnel-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run($('button[type=submit]', e.target), async () => {
    await api('/admin/personnel', {
      method: 'POST',
      body: { full_name: $('#p-name').value, job_title: $('#p-title').value, department_id: $('#p-dept').value, schedule: $('#p-pattern').value, phone: $('#p-phone').value },
    });
    e.target.reset();
    toast('Personnel added.');
    await loadStaff();
  });
});

$('#dept-form').addEventListener('submit', (e) => {
  e.preventDefault();
  run($('button[type=submit]', e.target), async () => {
    await api('/admin/departments', { method: 'POST', body: { name: $('#dep-name').value, category: $('#dep-cat').value } });
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
