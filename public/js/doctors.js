// Doctors page: the public directory. Booking needs a patient account, so "Book a visit" goes to sign-in.
let doctors = [];

const initials = (name) => String(name).replace(/^Dr\.?\s*/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

// "Mon-Fri 09:00-13:00, 14:00-17:00" (day names follow the chosen language)
function hoursText(hours) {
  const byDay = {};
  hours.forEach((h) => { (byDay[h.weekday] = byDay[h.weekday] || []).push(`${h.start}-${h.end}`); });
  const order = [1, 2, 3, 4, 5, 6, 0].filter((d) => byDay[d]);
  const groups = [];
  order.forEach((d) => {
    const key = byDay[d].join(', ');
    const n = d === 0 ? 7 : d;
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

function renderDoctors() {
  $('#doctor-cards').innerHTML = doctors.map((d) => `
    <div class="col-md-6 col-xl-4"><article class="doc-card">
      <div class="d-flex align-items-center gap-3 mb-2"><span class="avatar" aria-hidden="true">${esc(initials(d.full_name))}</span>
        <div><h3>${esc(d.full_name)}</h3><div class="spec">${esc(d.specialty)}${d.department !== d.specialty ? ' · ' + esc(d.department) : ''}</div></div></div>
      ${d.review_count ? `<div class="my-1">${stars(d.avg_rating)} <span class="small text-muted">${d.avg_rating} (${esc(reviewsText(d.review_count))})</span></div>` : ''}
      <div class="small mb-2">${esc(d.qualifications)}</div>
      <div class="hours grow">${esc(hoursText(d.hours))}</div>
      <div class="d-flex justify-content-between align-items-center mt-3">
        <strong>${money(d.consultation_fee)}</strong>
        <a class="btn btn-primary btn-sm" href="/login/patient">${esc(t('docs.book'))}</a></div>
    </article></div>`).join('') || `<div class="col-12">${empty(t('nodoc'))}</div>`;
}

async function loadDoctors() {
  const id = $('#dept-filter').value;
  doctors = await api('/public/doctors' + (id ? '?department_id=' + id : ''));
  renderDoctors();
}

$('#dept-filter').addEventListener('change', () => loadDoctors().catch(() => {}));
loadDepartments().then(loadDoctors).catch(() => {});
document.addEventListener('langchange', () => { loadDepartments().catch(() => {}); renderDoctors(); });
