// Front page. If you put a real photo of a doctor at public/img/hero-doctor.jpg
// (or .png / .webp) it replaces the drawn illustration automatically.
(function () {
  const photo = $('#hero-photo');
  const art = $('#hero-doctor');
  const names = ['hero-doctor.jpg', 'hero-doctor.jpeg', 'hero-doctor.png', 'hero-doctor.webp'];
  function tryNext(i) {
    if (i >= names.length) return;                      // no photo found: keep the illustration
    const probe = new Image();
    probe.onload = () => { photo.src = probe.src; photo.hidden = false; art.style.display = 'none'; $('#hero-art').classList.add('has-photo'); };
    probe.onerror = () => tryNext(i + 1);
    probe.src = '/assets/img/' + names[i];
  }
  tryNext(0);
})();

// The second hero card shows how many specialist doctors there are (real number from the database).
// If the list is empty or cannot be loaded it keeps the "24/7 Digital records" text.
let doctorCount = 0;
function renderTrustCard() {
  const title = $('#fc2-title'), desc = $('#fc2-desc');
  if (doctorCount >= 5) {
    title.removeAttribute('data-i18n'); desc.removeAttribute('data-i18n');
    title.textContent = `${Math.floor(doctorCount / 5) * 5}+ ${t('hero.card2.t')}`;
    desc.textContent = t('hero.card2.d');
  } else {
    title.dataset.i18n = 'hero.card2.fb.t'; desc.dataset.i18n = 'hero.card2.fb.d'; applyI18n();
  }
}
api('/public/doctors').then((d) => { doctorCount = d.length; renderTrustCard(); }).catch(() => {});
document.addEventListener('langchange', renderTrustCard);
