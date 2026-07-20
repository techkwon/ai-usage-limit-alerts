// AI Usage Meter — claude.ai 오버레이 content script
// 채팅 입력창 하단 미니 바 + 사이드바 Usage 카드를 주입한다.
// 데이터는 background(provider)에 요청하고, 실패 시 storage 캐시를 쓴다.

(() => {
  const REFRESH_MS = 60 * 1000;
  const REINJECT_MS = 1500;
  const i18n = globalThis.__aumI18n;
  let lastResult = null;

  // ---------- 데이터 ----------

  async function getUsage() {
    try {
      const r = await chrome.runtime.sendMessage({ type: 'refresh' });
      if (r) return r;
    } catch (_) { /* 워커 미기동 등 — 캐시로 폴백 */ }
    const { usage_claude } = await chrome.storage.local.get('usage_claude');
    return usage_claude || null;
  }

  function sevClass(w) {
    if (w.utilization >= 90 || w.severity === 'critical' || w.severity === 'exceeded') return 'crit';
    if (w.utilization >= 70 || w.severity === 'warning' || w.severity === 'elevated') return 'warn';
    return '';
  }

  // ---------- 채팅 입력창 하단 바 ----------

  function findComposerAnchor() {
    const input = document.querySelector('[data-testid="chat-input"]');
    if (!input) return null;
    return input.closest('fieldset');
  }

  function renderComposerBar() {
    const anchor = findComposerAnchor();
    if (!anchor) return;
    let bar = document.getElementById('aum-composer-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'aum-composer-bar';
      bar.className = 'aum-composer-bar aum-claude';
      anchor.insertAdjacentElement('afterend', bar);
    }
    if (!lastResult || !lastResult.ok) {
      bar.textContent = lastResult?.error === 'not_logged_in' ? '' : '';
      bar.style.display = 'none';
      return;
    }
    const session = lastResult.windows.find((w) => w.kind === 'session') || lastResult.windows[0];
    const weekly = lastResult.windows.find((w) => w.kind === 'weekly_all');
    bar.style.display = '';
    bar.innerHTML = `
      <span>${i18n.msg('sessionUsage')} <span class="aum-pct">${session.utilization}%</span></span>
      <span class="aum-track"><span class="aum-fill ${sevClass(session)}" style="width:${Math.min(session.utilization, 100)}%; display:block"></span></span>
      <span class="aum-muted">${i18n.formatReset(session.resetsAt)}</span>
      ${weekly ? `<span class="aum-muted">· ${i18n.msg('weeklyUsage')} <span class="aum-pct">${weekly.utilization}%</span></span>` : ''}
    `;
  }

  // ---------- 사이드바 카드 ----------

  function findSidebarAnchor() {
    const aside = document.querySelector('aside');
    if (!aside) return null;
    // 하단 트레이(사용자 메뉴 영역) 바로 위에 넣는다. 없으면 aside 맨 아래.
    const tray = aside.querySelector('.df-bottom-tray');
    return { aside, tray };
  }

  function renderSidebarCard() {
    const found = findSidebarAnchor();
    if (!found) return;
    let card = document.getElementById('aum-sidebar-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'aum-sidebar-card';
      card.className = 'aum-sidebar-card aum-claude';
      if (found.tray) found.tray.insertAdjacentElement('beforebegin', card);
      else found.aside.appendChild(card);
    }
    if (!lastResult) {
      card.innerHTML = `<div class="aum-title">${i18n.msg('usageTitle')}</div><div>${i18n.msg('loading')}</div>`;
      return;
    }
    if (!lastResult.ok) {
      card.innerHTML = `<div class="aum-title">${i18n.msg('usageTitle')}</div><div>${
        lastResult.error === 'not_logged_in' ? i18n.msg('loginRequired') : i18n.msg('loadFailed')
      }</div>`;
      return;
    }
    card.innerHTML =
      '<div class="aum-title"><span>' + i18n.msg('usageTitle') + '</span><span class="aum-time">' +
      i18n.formatTime(lastResult.fetchedAt, { hour: '2-digit', minute: '2-digit' }) +
      '</span></div>' +
      lastResult.windows
        .map(
          (w) => `
        <div class="aum-row">
          <div class="aum-row-head"><span>${globalThis.__aumEscapeHtml(i18n.localizeLabel(w.label))}</span><span class="aum-pct">${w.utilization}%</span></div>
          <div class="aum-track"><div class="aum-fill ${sevClass(w)}" style="width:${Math.min(w.utilization, 100)}%"></div></div>
          <div class="aum-reset">${i18n.formatReset(w.resetsAt)}</div>
        </div>`
        )
        .join('');
  }

  // ---------- 루프 ----------

  function renderAll() {
    try { renderComposerBar(); } catch (_) {}
    try { renderSidebarCard(); } catch (_) {}
  }

  async function refresh() {
    lastResult = await getUsage();
    renderAll();
  }

  // SPA 재렌더로 노드가 사라지면 다시 붙인다 (스로틀된 감시 루프)
  setInterval(() => {
    const needBar = !document.getElementById('aum-composer-bar') && findComposerAnchor();
    const needCard = !document.getElementById('aum-sidebar-card') && document.querySelector('aside');
    if (needBar || needCard) renderAll();
  }, REINJECT_MS);

  setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  refresh();
})();
