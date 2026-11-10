// Helpers shared by every page.
// NOTE: the server's security policy forbids inline <script> and onclick="..."
// attributes, so buttons use data-action="name" and are wired up below.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Escape text before putting it into HTML (stops "script injection").
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Talk to the server. Throws an Error with the server's message on failure.
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'X-Requested-With': 'fetch', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (res.status === 401 && !path.startsWith('/auth/login')) { location.href = '/'; throw new Error('Please log in.'); }
  if (!res.ok) throw new Error(tr((data && data.error) || 'Something went wrong.'));
  return data;
}

const money = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 });
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(String(iso).slice(0, 10) + 'T00:00:00Z')
    .toLocaleDateString(typeof dateLocale === 'function' ? dateLocale() : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}
const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const addDaysISO = (iso, n) => new Date(new Date(iso + 'T00:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);

const stars = (n) => {
  const r = Math.round(Number(n) || 0);
  return `<span class="stars" aria-label="${r} out of 5">${'★'.repeat(r)}<span class="off">${'★'.repeat(5 - r)}</span></span>`;
};
const chip = (status) => {
  const label = pageTranslated() && DICT.en['status.' + status] ? t('status.' + status) : String(status).replace('_', ' ');
  return `<span class="chip ${esc(status)}">${esc(label)}</span>`;
};
const empty = (msg) => `<div class="empty">${esc(msg)}</div>`;

// Small pop-up messages
function toast(message, type = 'success') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
  const el = document.createElement('div');
  el.className = 'toast-msg ' + (type === 'error' ? 'error' : '');
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), type === 'error' ? 6000 : 3500);
}

// Run an async action, show errors as toasts, and disable the button meanwhile.
async function run(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); }
  catch (err) { toast(err.message, 'error'); }
  finally { if (btn) btn.disabled = false; }
}

// Click delegation: <button data-action="save"> calls actions.save(button, event)
const actions = {
  async logout() {
    try { await api('/auth/logout', { method: 'POST' }); } finally { location.href = '/'; }
  },
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (el && actions[el.dataset.action]) actions[el.dataset.action](el, e);
});

// Call a loader the first time a tab is shown (and optionally every time).
function onTab(buttonId, loader) {
  const btn = document.getElementById(buttonId);
  btn.addEventListener('shown.bs.tab', () => loader());
}

// Draw (or redraw) a Chart.js chart on a canvas.
const charts = {};
function drawChart(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}
const CHART_COLORS = { primary: '#0f6b52', teal: '#7dbfa7', accent: '#c65a3a', gold: '#c98a0b', grey: '#a9b5ae' };

// Shared page header + personal greeting
let _me = null;
function renderGreeting() {
  const g = $('#greeting');
  if (!g || !_me) return;
  const h = new Date().getHours();
  const key = h < 12 ? 'greet.morning' : h < 17 ? 'greet.afternoon' : 'greet.evening';
  const word = pageTranslated() ? t(key) : DICT.en[key];
  const name = _me.role === 'patient' ? String(_me.name).split(' ')[0] : _me.name;
  g.textContent = `${word}, ${name}`;
  const d = $('#today');
  if (d) d.textContent = new Date().toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function renderTopbar(role) {
  api('/auth/me').then((u) => {
    _me = u;
    $('#who').textContent = u.name;
    const av = $('#avatar');
    if (av) av.textContent = String(u.name).replace(/^Dr\.?\s*/i, '').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    renderGreeting();
  });
}
document.addEventListener('langchange', renderGreeting);

// <button data-action="goto-tab" data-tab="t-appts"> switches to that tab
actions['goto-tab'] = (btn) => bootstrap.Tab.getOrCreateInstance(document.getElementById(btn.dataset.tab)).show();
