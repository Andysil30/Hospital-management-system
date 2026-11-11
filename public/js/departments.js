// Departments page: every public department, grouped (administrative ones are never shown).
let depts = [];
const CATS = ['emergency', 'specialist', 'surgical', 'diagnostic'];

function deptTag(d) {
  if (d.bookable) return `<span class="count">${esc(d.doctor_count === 1 ? t('svc.doc1') : t('svc.docN', { n: d.doctor_count }))}</span>`;
  return `<span class="count alt">${esc(t(d.category === 'emergency' ? 'tag.walkin' : 'tag.referral'))}</span>`;
}

function renderDepts() {
  $('#dept-grid').innerHTML = CATS.map((cat) => {
    const list = depts.filter((d) => d.category === cat);
    if (!list.length) return '';
    return `<div class="col-12"><h2 class="cat-title">${esc(t('cat.' + cat))}</h2></div>` + list.map((d) => `
      <div class="col-sm-6 col-lg-4"><div class="dept-card">
        <h3>${esc(d.name)}</h3>
        <p>${esc(d.description || '')}</p>
        ${deptTag(d)}
      </div></div>`).join('');
  }).join('');
}

api('/public/departments').then((d) => { depts = d; renderDepts(); }).catch(() => {});
document.addEventListener('langchange', renderDepts);
