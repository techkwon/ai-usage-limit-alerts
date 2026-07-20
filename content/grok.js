// AI Usage Meter — grok.com 오버레이 content script
// 입력창(.query-bar) 하단 바(한 줄, 상세 토글) + 사이드바 카드(프로필 위).
// 데이터(주간 공유 풀 + 모델별 한도)는 provider(background)에서 온다.

(() => {
  const REFRESH_MS = 60 * 1000;
  const REINJECT_MS = 1500;
  const i18n = globalThis.__aumI18n;
  let lastResult = null;
  let expanded = false;

  async function getUsage() {
    try {
      const r = await chrome.runtime.sendMessage({ type: 'refresh', provider: 'grok' });
      if (r) return r;
    } catch (_) { /* 캐시 폴백 */ }
    const { usage_grok } = await chrome.storage.local.get('usage_grok');
    return usage_grok || null;
  }

  function sevCls(w) {
    return w.utilization >= 90 || w.severity === 'critical' ? 'crit'
      : w.utilization >= 70 || w.severity === 'warning' ? 'warn' : '';
  }

  function itemHtml(w) {
    const right = w.total != null
      ? i18n.msg('remainingCountOfTotal', [String(w.remaining), String(w.total)])
      : `${w.utilization}%`;
    const reset = w.resetsAt ? `<span class="aum-muted">${i18n.formatReset(w.resetsAt)}</span>` : '';
    return `<span class="aum-item">${globalThis.__aumEscapeHtml(i18n.localizeLabel(w.label))} <span class="aum-pct">${right}</span>` +
      `<span class="aum-track"><span class="aum-fill ${sevCls(w)}" style="width:${Math.min(w.utilization, 100)}%; display:block"></span></span>` +
      `${reset}</span>`;
  }

  // ---------- 입력창 하단 바 (한 줄, 나머지는 상세 토글) ----------

  function findComposerAnchor() {
    const qb = document.querySelector('.query-bar');
    if (qb) return qb;
    const ta = document.querySelector('textarea');
    return ta ? ta.closest('form') : null;
  }

  function renderComposerBar() {
    const anchor = findComposerAnchor();
    if (!anchor) return;
    let bar = document.getElementById('aum-composer-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'aum-composer-bar';
      bar.className = 'aum-composer-bar aum-grok';
      anchor.insertAdjacentElement('afterend', bar);
      bar.addEventListener('click', (e) => {
        if (e.target.closest('.aum-toggle')) { expanded = !expanded; renderComposerBar(); }
      });
    }
    if (!lastResult || !lastResult.ok || !lastResult.windows.length) { bar.style.display = 'none'; return; }
    bar.style.display = '';
    const ws = lastResult.windows;
    const primary = ws[0];               // 주간 한도(있으면) 또는 첫 항목
    const extras = ws.slice(1);
    let html = itemHtml(primary);
    if (extras.length) {
      html += `<button class="aum-toggle" type="button">${expanded ? i18n.msg('collapseDetails') : i18n.msg('expandDetails')}</button>`;
      if (expanded) html += '<span class="aum-extra">' + extras.map(itemHtml).join('<span class="aum-muted">·</span>') + '</span>';
    }
    bar.innerHTML = html;
  }

  // ---------- 사이드바 카드 (프로필/footer 위) ----------

  function findSidebarAnchor() {
    const footer = document.querySelector('[data-sidebar="footer"]');
    if (footer) return { mode: 'before', el: footer };
    return null;
  }

  function renderSidebarCard() {
    const found = findSidebarAnchor();
    if (!found) return;
    let card = document.getElementById('aum-sidebar-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'aum-sidebar-card';
      card.className = 'aum-sidebar-card aum-grok';
      found.el.insertAdjacentElement('beforebegin', card);
    }
    if (!lastResult || !lastResult.ok || !lastResult.windows.length) {
      card.innerHTML = `<div class="aum-title">${i18n.msg('usageTitle')}</div><div class="aum-muted">${i18n.msg('loadFailed')}</div>`;
      return;
    }
    card.innerHTML =
      '<div class="aum-title"><span>' + i18n.msg('usageTitle') + '</span><span class="aum-time">' +
      i18n.formatTime(lastResult.fetchedAt, { hour: '2-digit', minute: '2-digit' }) +
      '</span></div>' +
      lastResult.windows.map((w) => {
        const right = w.total != null
          ? i18n.msg('remainingCountOfTotal', [String(w.remaining), String(w.total)])
          : `${w.utilization}%`;
        const reset = w.resetsAt ? `<div class="aum-reset">${i18n.formatReset(w.resetsAt)}</div>` : '';
        return `<div class="aum-row">
          <div class="aum-row-head"><span>${globalThis.__aumEscapeHtml(i18n.localizeLabel(w.label))}</span><span class="aum-pct">${right}</span></div>
          <div class="aum-track"><div class="aum-fill ${sevCls(w)}" style="width:${Math.min(w.utilization, 100)}%"></div></div>
          ${reset}
        </div>`;
      }).join('');
  }

  function renderAll() {
    try { renderComposerBar(); } catch (_) {}
    try { renderSidebarCard(); } catch (_) {}
  }

  async function refresh() {
    lastResult = await getUsage();
    renderAll();
  }

  setInterval(() => {
    const needBar = !document.getElementById('aum-composer-bar') && findComposerAnchor();
    const needCard = !document.getElementById('aum-sidebar-card') && findSidebarAnchor();
    if (needBar || needCard) renderAll();
  }, REINJECT_MS);

  setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh();
})();
