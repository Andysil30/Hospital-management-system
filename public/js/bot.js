// Floating assistant: a button in the corner that opens a small chat window.
// Messages are added with textContent (never innerHTML), so nothing typed or
// returned can inject HTML into the page.
(function () {
  const hasPageSwitch = !!document.querySelector('[data-lang-switch]');

  const root = document.createElement('div');
  root.id = 'bot';
  root.innerHTML = `
    <button type="button" class="bot-fab" id="bot-fab" aria-expanded="false" aria-controls="bot-panel">
      <span class="bot-fab-icon" aria-hidden="true">?</span><span data-i18n="bot.open"></span>
    </button>
    <section class="bot-panel" id="bot-panel" role="dialog" aria-labelledby="bot-title" hidden>
      <header class="bot-head">
        <strong id="bot-title" data-i18n="bot.title"></strong>
        <span class="bot-head-tools">
          ${hasPageSwitch ? '' : '<span class="lang-switch" data-lang-switch></span>'}
          <button type="button" class="bot-x" id="bot-close" data-i18n-aria="bot.close" aria-label="Close">&times;</button>
        </span>
      </header>
      <div class="bot-msgs" id="bot-msgs" aria-live="polite"></div>
      <div class="bot-chips" id="bot-chips"></div>
      <p class="bot-note" data-i18n="bot.note"></p>
      <form class="bot-form" id="bot-form" autocomplete="off">
        <input id="bot-input" maxlength="300" data-i18n-ph="bot.ph" data-i18n-aria="bot.ph" required>
        <button type="submit" class="btn btn-primary" data-i18n="bot.send"></button>
      </form>
    </section>`;
  document.body.appendChild(root);

  const fab = document.getElementById('bot-fab');
  const panel = document.getElementById('bot-panel');
  const msgs = document.getElementById('bot-msgs');
  const chips = document.getElementById('bot-chips');
  const input = document.getElementById('bot-input');
  let started = false;

  if (typeof buildLangSwitches === 'function') buildLangSwitches();
  applyI18n(root);

  function addMsg(text, who) {
    const el = document.createElement('div');
    el.className = 'bot-msg ' + who;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function setChips(list) {
    chips.innerHTML = '';
    (list || []).forEach((text) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'bot-chip';
      b.textContent = text;
      b.addEventListener('click', () => ask(text));
      chips.appendChild(b);
    });
  }

  async function ask(text, silent) {
    if (text && !silent) addMsg(text, 'me');
    const typing = silent ? null : addMsg(t('bot.typing'), 'bot typing');
    try {
      const r = await api('/bot/ask', { method: 'POST', body: { message: text || '', lang: getLang() } });
      if (typing) typing.remove();
      if (!silent) addMsg(r.reply, 'bot');
      setChips(r.suggestions);
    } catch (err) {
      if (typing) typing.remove();
      addMsg(err.message || t('bot.error'), 'bot');
    }
  }

  function open() {
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    fab.classList.add('is-open');
    if (!started) { started = true; ask('', false); }
    input.focus();
  }
  function close() {
    panel.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    fab.classList.remove('is-open');
    fab.focus();
  }

  fab.addEventListener('click', () => (panel.hidden ? open() : close()));
  document.getElementById('bot-close').addEventListener('click', close);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  document.getElementById('bot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    chips.innerHTML = '';
    ask(text);
  });

  // When the language changes, refresh the suggestion buttons in the new language.
  document.addEventListener('langchange', () => {
    applyI18n(root);
    if (started) ask('', true);
  });
})();
