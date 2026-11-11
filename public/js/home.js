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
