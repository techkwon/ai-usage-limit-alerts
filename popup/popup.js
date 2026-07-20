import { fetchUsage as fetchClaude } from '../providers/claude.js';
import { fetchUsage as fetchChatgpt } from '../providers/chatgpt.js';
import { fetchUsage as fetchGrok } from '../providers/grok.js';
import { fetchUsage as fetchGemini } from '../providers/gemini.js';

const i18n = globalThis.__aumI18n;
const refreshButton = document.getElementById('refresh');
const content = document.getElementById('content');
const footer = document.getElementById('footer');

i18n.setDocumentLanguage();
document.getElementById('title').textContent = chrome.i18n.getMessage('appName');
refreshButton.title = chrome.i18n.getMessage('refresh');
refreshButton.setAttribute('aria-label', chrome.i18n.getMessage('refresh'));
content.innerHTML = `<p class="muted">${chrome.i18n.getMessage('loading')}</p>`;

const PROVIDERS = [
  { id: 'claude', name: 'Claude', fetch: fetchClaude, storageKey: 'usage_claude', loginUrl: 'https://claude.ai' },
  { id: 'chatgpt', name: 'ChatGPT', fetch: fetchChatgpt, storageKey: 'usage_chatgpt', loginUrl: 'https://chatgpt.com' },
  { id: 'grok', name: 'Grok', fetch: fetchGrok, storageKey: 'usage_grok', loginUrl: 'https://grok.com' },
  { id: 'gemini', name: 'Gemini', fetch: fetchGemini, storageKey: 'usage_gemini', loginUrl: 'https://gemini.google.com' },
];

function windowHtml(w) {
  const label = globalThis.__aumEscapeHtml(i18n.localizeLabel(w.label));
  if (typeof w.utilization === 'number') {
    const cls = w.utilization >= 90 || w.severity === 'critical' ? 'crit'
      : w.utilization >= 70 || w.severity === 'warning' ? 'warn' : '';
    const right = w.total != null
      ? i18n.msg('remainingCountOfTotal', [String(w.remaining), String(w.total)])
      : `${w.utilization}%`;
    return `
    <div class="window">
      <div class="row"><span>${label}</span><span class="pct">${right}</span></div>
      <div class="bar ${cls}"><div style="width:${Math.min(w.utilization, 100)}%"></div></div>
      <div class="reset">${i18n.formatReset(w.resetsAt)}</div>
    </div>`;
  }
  const crit = w.remaining === 0 ? ' style="color:var(--red)"' : '';
  return `
  <div class="window">
    <div class="row"><span>${label}</span><span class="pct"${crit}>${i18n.msg('remainingCount', String(w.remaining ?? '?'))}</span></div>
    <div class="reset">${i18n.formatReset(w.resetsAt)}</div>
  </div>`;
}

function sectionHtml(p, result) {
  let body;
  if (!result) {
    body = `<p class="muted">${i18n.msg('loading')}</p>`;
  } else if (!result.ok) {
    body = {
      not_logged_in: `<p class="muted">${i18n.msg('loginRequired')} — <a href="${p.loginUrl}" target="_blank">${i18n.msg('openProvider', p.name)}</a></p>`,
      schema_changed: `<p class="error">${i18n.msg('schemaChanged')}</p>`,
      network: `<p class="error">${i18n.msg('networkError')}</p>`,
    }[result.error] || `<p class="error">${i18n.msg('unknownError')}</p>`;
  } else {
    const resetNote = typeof result.fullResets === 'number'
      ? `<p class="muted" style="margin:6px 0 0">${i18n.msg('fullResetCredits', String(result.fullResets))}</p>` : '';
    body = result.windows.map(windowHtml).join('') + resetNote;
  }
  return `<section class="${p.id}"><h2>${p.name}</h2>${body}</section>`;
}

function renderAll(results) {
  content.innerHTML = PROVIDERS.map((p) => sectionHtml(p, results[p.id])).join('');
  const t = Object.values(results).find((r) => r?.fetchedAt);
  footer.textContent = t ? i18n.msg('updatedAt', i18n.formatTime(t.fetchedAt)) : '';
}

async function loadCached() {
  const keys = PROVIDERS.map((p) => p.storageKey);
  const cache = await chrome.storage.local.get(keys);
  const results = {};
  for (const p of PROVIDERS) results[p.id] = cache[p.storageKey] || null;
  renderAll(results);
}

async function refreshDirect() {
  const results = {};
  await Promise.all(
    PROVIDERS.map(async (p) => {
      results[p.id] = await p.fetch();
    })
  );
  const store = {};
  for (const p of PROVIDERS) store[p.storageKey] = results[p.id];
  await chrome.storage.local.set(store);
  chrome.runtime.sendMessage({ type: 'report', results }).catch(() => {});
  return results;
}

async function refresh() {
  try {
    const results = await chrome.runtime.sendMessage({ type: 'refresh_all' });
    const hasAllProviders = results && PROVIDERS.every((p) => Object.hasOwn(results, p.id));
    if (!results || typeof results !== 'object' || Array.isArray(results) || !hasAllProviders) {
      throw new Error('invalid background refresh_all response');
    }
    renderAll(results);
    return;
  } catch (_) {
    const results = await refreshDirect();
    renderAll(results);
    return;
  }
}

refreshButton.addEventListener('click', refresh);
loadCached().then(() => refresh());
