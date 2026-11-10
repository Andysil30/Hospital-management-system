// Front page: shows real numbers, departments and top-rated doctors from the database.
let depts = [];
let docs = [];

const initials = (name) => String(name).replace(/^Dr\.?\s*/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

function renderStats() {
  $('#st-doctors').textContent = docs.length;
  $('#st-depts').textContent = depts.length;
  const reviews = docs.reduce((n, d) => n + d.review_count, 0);
  const sum = docs.reduce((n, d) => n + d.avg_rating * d.review_count, 0);
  $('#st-rating').innerHTML = reviews ? `${(sum / reviews).toFixed(1)}<span class="star"> ★</span>` : '-';
}

const CATS = ['emergency', 'specialist', 'surgical', 'diagnostic'];

function deptTag(d) {
  if (d.bookable) return `<span class="count">${esc(d.doctor_count === 1 ? t('svc.doc1') : t('svc.docN', { n: d.doctor_count }))}</span>`;
  return `<span class="count alt">${esc(t(d.category === 'emergency' ? 'tag.walkin' : 'tag.referral'))}</span>`;
}

function renderDepts() {
  $('#dept-grid').innerHTML = CATS.map((cat) => {
    const list = depts.filter((d) => d.category === cat);
    if (!list.length) return '';
    return `<div class="col-12"><h3 class="cat-title">${esc(t('cat.' + cat))}</h3></div>` + list.map((d) => `
      <div class="col-sm-6 col-lg-4"><div class="dept-card">
        <h3>${esc(d.name)}</h3>
        <p>${esc(d.description || '')}</p>
        ${deptTag(d)}
      </div></div>`).join('');
  }).join('');
}

function renderTeam() {
  const ranked = [...docs].sort((a, b) => (b.avg_rating - a.avg_rating) || (b.review_count - a.review_count));
  // Show up to three doctors, each from a different department
  const seen = new Set();
  const best = [];
  for (const d of ranked) {
    if (seen.has(d.department_id)) continue;
    seen.add(d.department_id);
    best.push(d);
    if (best.length === 3) break;
  }
  // "Top-rated" is only honest once patients have left reviews
  const anyReviews = ranked.some((d) => d.review_count > 0);
  $('#docs-title').dataset.i18n = anyReviews ? 'docs.title' : 'docs.title.alt';
  $('#docs-sub').dataset.i18n = anyReviews ? 'docs.sub' : 'docs.sub.alt';
  applyI18n();

  $('#team-grid').innerHTML = best.map((d) => `
    <div class="col-md-4"><article class="team-card">
      <div class="avatar" aria-hidden="true">${esc(initials(d.full_name))}</div>
      <h3>${esc(d.full_name)}</h3>
      <div class="spec">${esc(d.specialty)}</div>
      ${d.review_count ? `<div class="my-2">${stars(d.avg_rating)} <span class="small text-muted">${d.avg_rating} (${esc(reviewsText(d.review_count))})</span></div>` : ''}
      ${d.department !== d.specialty ? `<div class="small text-muted mb-3">${esc(d.department)}</div>` : '<div class="mb-3"></div>'}
      <a class="btn btn-outline-primary btn-sm" href="/login/patient">${esc(t('docs.book'))}</a>
    </article></div>`).join('') || `<div class="col-12">${empty(t('docs.empty'))}</div>`;
}

const renderAll = () => { renderStats(); renderDepts(); renderTeam(); };

Promise.all([api('/public/departments'), api('/public/doctors')])
  .then(([d, c]) => { depts = d; docs = c; renderAll(); })
  .catch(() => { /* the page still works without live numbers */ });

document.addEventListener('langchange', renderAll);
