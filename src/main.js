import './style.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ROLES, getRole, suggestRoles, validateRole } from './roles.js';
import { MODEL, buildSystemPrompt, streamChat, verifyApiKey } from './gemini.js';

marked.setOptions({ gfm: true, breaks: true });

const KEY_STORAGE = 'interview-bot:gemini-key';
const ROLE_STORAGE = 'interview-bot:role';

const makeStore = (getArea) => ({
  get(k) {
    try { return getArea().getItem(k); } catch { return null; }
  },
  set(k, v) {
    try { getArea().setItem(k, v); } catch { /* ignore */ }
  },
  remove(k) {
    try { getArea().removeItem(k); } catch { /* ignore */ }
  },
});
const store = makeStore(() => localStorage);
const session = makeStore(() => sessionStorage);

const state = {
  apiKey: session.get(KEY_STORAGE) || store.get(KEY_STORAGE) || '',
  role: getRole(store.get(ROLE_STORAGE)) || null,
  histories: Object.fromEntries(ROLES.map((r) => [r.id, []])), // per-role conversations
  streaming: null, // AbortController while a reply is streaming
};

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const md = (text) => DOMPurify.sanitize(marked.parse(text));

/* ---------------------------------------------------------------- theme --- */

function applyTheme(role) {
  const root = document.documentElement;
  root.style.setProperty('--hue', role ? role.hue : 225);
  root.style.setProperty('--sat', role ? '62%' : '14%');
  root.dataset.role = role ? role.id : '';
}

/* --------------------------------------------------------------- layout --- */

const app = $('#app');
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#" data-action="home" aria-label="Interview Bot home">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>Interview<b>Bot</b></span>
    </a>
    <div class="topbar-search" id="topSearch"></div>
    <button class="key-btn" data-action="key" type="button" title="Gemini API key">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7a4 4 0 1 0-3.9 5H12l2 2h2v2h2v2h3v-3l-6.1-6.1A4 4 0 0 0 15 7Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
      <span class="key-label">API key</span>
      <span class="key-dot" aria-hidden="true"></span>
    </button>
  </header>
  <main id="view"></main>
  <div class="modal-backdrop" id="keyModal" hidden></div>
`;

/* --------------------------------------------------------------- search --- */

/**
 * Role search combobox with autocomplete + validation.
 * Calls onSelect(role) only for a validated role.
 */
function createSearch(container, { large = false, placeholder } = {}) {
  const id = `s${Math.random().toString(36).slice(2, 8)}`;
  container.innerHTML = `
    <form class="search ${large ? 'search-lg' : ''}" autocomplete="off" novalidate>
      <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <input type="text" role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-autocomplete="list"
        aria-label="Search for a job role" placeholder="${placeholder || 'Search a job role…'}" />
      <button type="submit" class="search-go">${large ? 'Start prep' : 'Switch'}</button>
      <ul class="search-list" id="${id}-list" role="listbox" hidden></ul>
      <p class="search-msg" role="alert" hidden></p>
    </form>`;

  const form = $('form', container);
  const input = $('input', form);
  const list = $('.search-list', form);
  const msg = $('.search-msg', form);
  let items = [];
  let active = -1;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    active = -1;
  };
  const showMsg = (html) => {
    msg.innerHTML = html;
    msg.hidden = !html;
  };

  const render = () => {
    const q = input.value;
    items = suggestRoles(q).map((s) => s.role);
    if (!items.length) {
      list.innerHTML = `<li class="search-empty">No matching AI role</li>`;
    } else {
      list.innerHTML = items
        .map(
          (r, i) => `<li role="option" id="${id}-o${i}" data-id="${r.id}" aria-selected="${i === active}"
              style="--h:${r.hue}" class="${i === active ? 'active' : ''}">
              <span class="opt-dot"></span>
              <span class="opt-title">${esc(r.title)}</span>
              <span class="opt-short">${esc(r.short)}</span>
            </li>`,
        )
        .join('');
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', active >= 0 ? `${id}-o${active}` : '');
  };

  const choose = (role) => {
    input.value = '';
    close();
    showMsg('');
    input.blur();
    selectRole(role);
  };

  input.addEventListener('input', () => {
    active = -1;
    showMsg('');
    render();
  });
  input.addEventListener('focus', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) render();
      if (!items.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      render();
    } else if (e.key === 'Escape') {
      close();
    } else if (e.key === 'Enter' && active >= 0 && items[active]) {
      e.preventDefault();
      choose(items[active]);
    }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-id]');
    if (!li) return;
    e.preventDefault();
    choose(getRole(li.dataset.id));
  });
  input.addEventListener('blur', () => setTimeout(close, 120));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = validateRole(input.value);
    if (result.valid) return choose(result.role);
    close();
    showMsg(
      `${esc(result.reason)}${
        result.suggestion
          ? ` <button type="button" class="link" data-suggest="${result.suggestion.id}">Did you mean ${esc(result.suggestion.title)}?</button>`
          : ''
      }`,
    );
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
  });
  msg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-suggest]');
    if (b) choose(getRole(b.dataset.suggest));
  });
}

/* ----------------------------------------------------------------- views --- */

function renderHome() {
  const view = $('#view');
  view.className = 'home';
  view.innerHTML = `
    <section class="hero">
      <p class="eyebrow">AI interview coach · powered by Gemini</p>
      <h1>Prepare for your next <span class="grad">AI role</span> interview.</h1>
      <p class="sub">Search the role you're interviewing for. Every answer, mock question and piece of feedback is tailored to that role's interview loop.</p>
      <div id="heroSearch"></div>
    </section>
    <section class="role-grid" aria-label="Supported roles">
      ${ROLES.map(
        (r) => `
        <button class="role-card" type="button" data-role="${r.id}" style="--h:${r.hue}">
          <span class="role-chip">${esc(r.short)}</span>
          <h3>${esc(r.title)}</h3>
          <p>${esc(r.tagline)}</p>
          <ul>${r.focus.slice(0, 4).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
          <span class="role-cta">Start preparing →</span>
        </button>`,
      ).join('')}
    </section>`;
  createSearch($('#heroSearch'), { large: true, placeholder: 'e.g. AI Product Manager, FDE, Research Scientist…' });
  view.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => selectRole(getRole(b.dataset.role))));
  $('#topSearch').hidden = true;
}

function renderChat() {
  const role = state.role;
  const view = $('#view');
  view.className = 'chat-view';
  view.innerHTML = `
    <section class="chat" aria-label="${esc(role.title)} interview chat">
      <div class="chat-head">
        <div class="role-badge" aria-hidden="true">${esc(role.badge)}</div>
        <div class="chat-head-text">
          <p class="eyebrow">Interviewing for</p>
          <h2>${esc(role.title)}</h2>
        </div>
        <button class="ghost-btn" data-action="clear" type="button" title="Clear this conversation">New chat</button>
      </div>
      <div class="focus-row">${role.focus.map((f) => `<span>${esc(f)}</span>`).join('')}</div>
      <div class="messages" id="messages" aria-live="polite"></div>
      <form class="composer" id="composer">
        <textarea id="prompt" rows="1" placeholder="Ask anything about the ${esc(role.title)} interview…" aria-label="Message"></textarea>
        <button type="submit" class="send" id="sendBtn" aria-label="Send">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </form>
      <p class="fineprint">Model: <code>${esc(MODEL)}</code> · Responses may be inaccurate — verify important details.</p>
    </section>`;

  $('#topSearch').hidden = false;
  renderMessages();

  const ta = $('#prompt');
  const autosize = () => {
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  };
  ta.addEventListener('input', autosize);
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $('#composer').requestSubmit();
    }
  });
  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.streaming) return stopStreaming();
    const text = ta.value.trim();
    if (!text) return;
    ta.value = '';
    autosize();
    send(text);
  });
  ta.focus();
}

function renderMessages() {
  const role = state.role;
  const box = $('#messages');
  const history = state.histories[role.id];
  if (!history.length) {
    box.innerHTML = `
      <div class="welcome">
        <p class="welcome-title">Hi! I'm your <b>${esc(role.title)}</b> interview coach.</p>
        <p>${esc(role.tagline)} Pick a starting point or ask your own question.</p>
        <div class="starters">
          ${role.starters.map((s) => `<button type="button" class="starter" data-starter="${esc(s)}">${esc(s)}</button>`).join('')}
        </div>
      </div>`;
    box.querySelectorAll('[data-starter]').forEach((b) => b.addEventListener('click', () => send(b.dataset.starter)));
    return;
  }
  box.innerHTML = history.map((m) => messageHTML(m)).join('');
  box.scrollTop = box.scrollHeight;
}

function messageHTML(m) {
  const cls = m.role === 'user' ? 'msg user' : `msg bot${m.error ? ' error' : ''}`;
  const body = m.role === 'user' ? `<p>${esc(m.text).replace(/\n/g, '<br>')}</p>` : md(m.text);
  return `<div class="${cls}"><div class="bubble">${body}</div></div>`;
}

/* ------------------------------------------------------------------ chat --- */

function setSendMode(streaming) {
  const btn = $('#sendBtn');
  if (!btn) return;
  btn.classList.toggle('stop', streaming);
  btn.setAttribute('aria-label', streaming ? 'Stop generating' : 'Send');
  btn.innerHTML = streaming
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function stopStreaming() {
  state.streaming?.abort();
}

async function send(text) {
  if (!state.apiKey) return openKeyModal();
  if (state.streaming) return;
  const role = state.role;
  const history = state.histories[role.id];
  history.push({ role: 'user', text });
  renderMessages();

  const box = $('#messages');
  const wrap = document.createElement('div');
  wrap.className = 'msg bot';
  wrap.innerHTML = `<div class="bubble"><span class="typing"><i></i><i></i><i></i></span></div>`;
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
  const bubble = $('.bubble', wrap);

  const controller = new AbortController();
  state.streaming = controller;
  setSendMode(true);

  let text_ = '';
  let frame = 0;
  const paint = () => {
    frame = 0;
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    bubble.innerHTML = md(text_);
    if (nearBottom) box.scrollTop = box.scrollHeight;
  };

  try {
    await streamChat({
      apiKey: state.apiKey,
      system: buildSystemPrompt(role),
      history: history.filter((m) => !m.error).map(({ role: r, text: t }) => ({ role: r, text: t })),
      signal: controller.signal,
      onToken: (chunk) => {
        text_ += chunk;
        if (!frame) frame = requestAnimationFrame(paint);
      },
    });
    if (!text_.trim()) text_ = '_No response was returned. Try rephrasing your question._';
    history.push({ role: 'model', text: text_ });
  } catch (err) {
    if (err.name === 'AbortError') {
      history.push({ role: 'model', text: (text_ || '') + '\n\n_— stopped —_' });
    } else {
      history.push({ role: 'model', text: `**Something went wrong.** ${err.message || err}`, error: true });
      if ([400, 401, 403].includes(err.status)) setTimeout(openKeyModal, 400);
    }
  } finally {
    if (frame) cancelAnimationFrame(frame);
    state.streaming = null;
    // Only repaint if the user is still looking at this role.
    if (state.role?.id === role.id && $('#messages')) {
      renderMessages();
      setSendMode(false);
    }
  }
}

/* ----------------------------------------------------------------- role --- */

function selectRole(role) {
  if (!role) return;
  if (state.streaming) stopStreaming();
  state.role = role;
  store.set(ROLE_STORAGE, role.id);
  applyTheme(role);
  renderChat();
  if (!state.apiKey) openKeyModal();
}

function goHome() {
  if (state.streaming) stopStreaming();
  state.role = null;
  store.remove(ROLE_STORAGE);
  applyTheme(null);
  renderHome();
}

/* -------------------------------------------------------------- API key --- */

function updateKeyIndicator() {
  const btn = $('.key-btn');
  btn.classList.toggle('has-key', !!state.apiKey);
  $('.key-label', btn).textContent = state.apiKey ? 'Key set' : 'Add API key';
}

function openKeyModal() {
  const modal = $('#keyModal');
  const remembered = !!store.get(KEY_STORAGE);
  modal.hidden = false;
  modal.innerHTML = `
    <form class="modal" role="dialog" aria-modal="true" aria-labelledby="keyTitle" novalidate>
      <div class="modal-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M15 7a4 4 0 1 0-3.9 5H12l2 2h2v2h2v2h3v-3l-6.1-6.1A4 4 0 0 0 15 7Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
      </div>
      <h2 id="keyTitle">Enter your Gemini API key</h2>
      <p class="muted">The bot uses <code>${esc(MODEL)}</code>. Your key stays in this browser and is sent only to Google's Gemini API.
        Get one at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>.</p>
      <label class="field">
        <span>API key</span>
        <div class="key-input">
          <input id="keyInput" type="password" placeholder="AIza…" value="${esc(state.apiKey)}" spellcheck="false" autocomplete="off" />
          <button type="button" class="link" id="toggleKey">Show</button>
        </div>
      </label>
      <label class="check"><input type="checkbox" id="rememberKey" ${remembered || !state.apiKey ? 'checked' : ''}/> Remember on this device</label>
      <p class="modal-msg" role="alert" hidden></p>
      <div class="modal-actions">
        ${state.apiKey ? '<button type="button" class="ghost-btn danger" id="forgetKey">Remove key</button>' : '<span></span>'}
        <div class="right">
          ${state.apiKey ? '<button type="button" class="ghost-btn" id="cancelKey">Cancel</button>' : ''}
          <button type="submit" class="primary-btn" id="saveKey">Save & continue</button>
        </div>
      </div>
    </form>`;

  const form = $('form', modal);
  const input = $('#keyInput');
  const msg = $('.modal-msg', modal);
  const close = () => {
    modal.hidden = true;
    modal.innerHTML = '';
    $('#prompt')?.focus();
  };
  input.focus();

  $('#toggleKey').addEventListener('click', (e) => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    e.target.textContent = show ? 'Hide' : 'Show';
  });
  $('#cancelKey')?.addEventListener('click', close);
  $('#forgetKey')?.addEventListener('click', () => {
    state.apiKey = '';
    store.remove(KEY_STORAGE);
    session.remove(KEY_STORAGE);
    updateKeyIndicator();
    openKeyModal();
  });
  modal.onkeydown = (e) => {
    if (e.key === 'Escape' && state.apiKey) close();
  };
  modal.onmousedown = (e) => {
    if (e.target === modal && state.apiKey) close();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = input.value.trim();
    if (!key) {
      msg.textContent = 'Please paste your Gemini API key.';
      msg.hidden = false;
      return;
    }
    const btn = $('#saveKey');
    btn.disabled = true;
    btn.textContent = 'Verifying…';
    msg.hidden = true;
    try {
      await verifyApiKey(key);
    } catch (err) {
      msg.textContent = err.message || 'Could not verify the key.';
      msg.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Save & continue';
      return;
    }
    state.apiKey = key;
    session.set(KEY_STORAGE, key);
    if ($('#rememberKey').checked) store.set(KEY_STORAGE, key);
    else store.remove(KEY_STORAGE);
    updateKeyIndicator();
    close();
  });
}

/* ----------------------------------------------------------------- boot --- */

document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'home') {
    e.preventDefault();
    goHome();
  } else if (action === 'key') {
    openKeyModal();
  } else if (action === 'clear' && state.role) {
    if (state.streaming) stopStreaming();
    state.histories[state.role.id] = [];
    renderMessages();
    setSendMode(false);
  }
});

createSearch($('#topSearch'), { placeholder: 'Switch role…' });
updateKeyIndicator();
applyTheme(state.role);
if (state.role) renderChat();
else renderHome();
if (!state.apiKey) openKeyModal();
