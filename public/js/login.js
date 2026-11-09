// Sign-in pages (patient / doctor / owner) + patient registration with a confirmation step.
const portal = document.body.dataset.portal; // set by the server: patient | doctor | owner

const msg = $('#msg');
const showError = (text) => { msg.textContent = text; msg.classList.remove('d-none'); };
const clearError = () => msg.classList.add('d-none');

// Fill in the texts that are specific to this portal (they follow the chosen language).
function applyPortalText() {
  $$('[data-pi18n]').forEach((el) => { el.textContent = t(`portal.${portal}.${el.dataset.pi18n}`); });
}
applyPortalText();

// Which heading to show: 'login' | 'register' | 'review'
function setView(v) {
  const title = $('#auth-title'), sub = $('#auth-sub');
  if (v === 'login') {
    title.removeAttribute('data-i18n'); title.dataset.pi18n = 'title';
    sub.dataset.i18n = 'login.sub';
  } else {
    title.removeAttribute('data-pi18n');
    title.dataset.i18n = v === 'register' ? 'create.title' : 'review.title';
    sub.dataset.i18n = v === 'register' ? 'create.sub' : 'review.sub';
  }
  applyI18n(); applyPortalText();
}

async function submit(button, path, payload) {
  clearError();
  button.disabled = true;
  try {
    const result = await api(path, { method: 'POST', body: payload });
    location.href = result.redirect; // the server tells us which dashboard to open
  } catch (err) {
    showError(err.message);
    button.disabled = false;
  }
}

$('#login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  submit($('button[type=submit]', e.target), '/auth/login',
    { email: $('#l-email').value, password: $('#l-pass').value, portal });
});

// ---------- Patient registration: step 1 = fill in, step 2 = review and confirm ----------
let pending = null;

$('#register-form').addEventListener('submit', (e) => {
  e.preventDefault();
  clearError();
  const data = {
    full_name: $('#r-name').value.trim(),
    email: $('#r-email').value.trim(),
    date_of_birth: $('#r-dob').value || null,
    gender: $('#r-gender').value || null,
    phone: $('#r-phone').value.trim(),
    password: $('#r-pass').value,
  };
  if (data.full_name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.password.length < 8) {
    return showError(t('err.fillrequired'));
  }
  pending = data;
  showReview();
});

function reviewValues() {
  $('#rv-name').textContent = pending.full_name;
  $('#rv-email').textContent = pending.email;
  $('#rv-dob').textContent = pending.date_of_birth ? fmtDate(pending.date_of_birth) : t('f.notprovided');
  $('#rv-gender').textContent = pending.gender ? t(pending.gender === 'Female' ? 'f.female' : 'f.male') : t('f.notprovided');
  $('#rv-phone').textContent = pending.phone || t('f.notprovided');
}

function showReview() {
  reviewValues();
  $('#rv-ok').checked = false;
  $('#rv-confirm').disabled = true;
  $('#register-form').classList.add('d-none');
  $('#review-pane').classList.remove('d-none');
  setView('review');
}

$('#rv-ok').addEventListener('change', (e) => { $('#rv-confirm').disabled = !e.target.checked; });
$('#rv-edit').addEventListener('click', () => {
  clearError();
  $('#review-pane').classList.add('d-none');
  $('#register-form').classList.remove('d-none');
  setView('register');
});
$('#rv-confirm').addEventListener('click', (e) => {
  if (!pending || !$('#rv-ok').checked) return showError(tr('Please confirm that your details are correct.'));
  submit(e.target, '/auth/register', { ...pending, confirmed: true });
});

// ---------- Tabs, show/hide password, language ----------
$('#tab-login').addEventListener('shown.bs.tab', () => { clearError(); setView('login'); });
$('#tab-register').addEventListener('shown.bs.tab', () => {
  clearError();
  setView($('#review-pane').classList.contains('d-none') ? 'register' : 'review');
});

// A link like /login/patient#register opens the registration tab directly
if (portal === 'patient' && location.hash === '#register') bootstrap.Tab.getOrCreateInstance($('#tab-register')).show();

actions['toggle-pass'] = (btn) => {
  const input = document.getElementById(btn.dataset.target);
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.dataset.i18n = show ? 'f.hide' : 'f.show';
  btn.textContent = t(btn.dataset.i18n);
};

document.addEventListener('langchange', () => {
  clearError();
  applyPortalText();
  if (pending && !$('#review-pane').classList.contains('d-none')) reviewValues();
});
