// AI Usage Meter — gemini.google.com 오버레이 content script
// 입력창(.input-area) 하단 미니 바 + 사이드바 Usage 카드.

(() => {
  const REFRESH_MS = 60 * 1000;
  const REINJECT_MS = 1500;
  const i18n = globalThis.__aumI18n;
  let lastResult = null;

  async function getUsage() {
    try {
      const r = await chrome.runtime.sendMessage({ type: 'refresh', provider: 'gemini' });
      if (r) return r;
    } catch (_) { /* 캐시 폴백 */ }
    const { usage_gemini } = await chrome.storage.local.get('usage_gemini');
    return usage_gemini || null;
  }

  function sevClass(w) {
    if (w.utilization >= 90 || w.severity === 'critical') return 'crit';
    if (w.utilization >= 70 || w.severity === 'warning') return 'warn';
    return '';
  }

  // ---------- 입력창 하단 바 ----------

  function findComposerAnchor() {
    // 입력 pill 바로 아래에 붙인다. fieldset(input-area-container)이 flex-column이라
    // input-area-v2 뒤에 넣으면 보이는 pill 바로 아래(같은 x, 660px)로 렌더된다.
    // (input-container는 페이지 하단 도크라 거기 넣으면 화면 맨 아래로 감)
    const ia = document.querySelector('.input-area');
    if (ia) return ia.closest('input-area-v2') || ia;
    const rt = document.querySelector('rich-textarea');
    return rt ? rt.closest('fieldset') || rt.parentElement : null;
  }

  function renderComposerBar() {
    const anchor = findComposerAnchor();
    if (!anchor) return;
    let bar = document.getElementById('aum-composer-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'aum-composer-bar';
      bar.className = 'aum-composer-bar aum-gemini';
      anchor.insertAdjacentElement('afterend', bar);
    }
    if (!lastResult || !lastResult.ok) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = '';
    bar.innerHTML = lastResult.windows
      .map((w) =>
        `<span class="aum-item">${globalThis.__aumEscapeHtml(i18n.localizeLabel(w.label))} <span class="aum-pct">${w.utilization}%</span>` +
        `<span class="aum-track"><span class="aum-fill ${sevClass(w)}" style="width:${Math.min(w.utilization, 100)}%; display:block"></span></span>` +
        `<span class="aum-muted">${i18n.formatReset(w.resetsAt)}</span></span>`
      )
      .join('<span class="aum-muted">·</span>');
  }

  // ---------- 사이드바 카드 ----------

  // 사이드바 하단 프로필/설정 영역(sidenav-mavatar-footer) 바로 위에 카드를 넣는다.
  function findSidebarAnchor() {
    const footer = document.querySelector('sidenav-mavatar-footer');
    if (footer) return footer;
    return null;
  }

  function renderSidebarCard() {
    const anchor = findSidebarAnchor();
    if (!anchor) return;
    let card = document.getElementById('aum-sidebar-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'aum-sidebar-card';
      card.className = 'aum-sidebar-card aum-gemini';
      anchor.insertAdjacentElement('beforebegin', card);
    }
    // 사이드바가 접힌 레일(좁을 때)이면 카드를 숨긴다 — 펼쳤을 때만 표시
    const railW = (anchor.closest('side-navigation-content, bard-sidenav') || anchor).getBoundingClientRect().width;
    if (railW < 150) { card.style.display = 'none'; return; }
    card.style.display = '';
    if (!lastResult || !lastResult.ok) {
      card.innerHTML = '<div class="aum-title">' + i18n.msg('usageTitle') + '</div><div>' +
        (lastResult && lastResult.error === 'not_logged_in' ? i18n.msg('loginRequired') : i18n.msg('loadFailed')) + '</div>';
      return;
    }
    card.innerHTML =
      '<div class="aum-title"><span>' + i18n.msg('usageTitle') + '</span><span class="aum-time">' +
      i18n.formatTime(lastResult.fetchedAt, { hour: '2-digit', minute: '2-digit' }) +
      '</span></div>' +
      lastResult.windows
        .map((w) => `<div class="aum-row">
          <div class="aum-row-head"><span>${globalThis.__aumEscapeHtml(i18n.localizeLabel(w.label))}</span><span class="aum-pct">${w.utilization}%</span></div>
          <div class="aum-track"><div class="aum-fill ${sevClass(w)}" style="width:${Math.min(w.utilization, 100)}%"></div></div>
          <div class="aum-reset">${i18n.formatReset(w.resetsAt)}</div>
        </div>`)
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

  setInterval(() => {
    const needBar = !document.getElementById('aum-composer-bar') && findComposerAnchor();
    const needCard = !document.getElementById('aum-sidebar-card') && findSidebarAnchor();
    if (needBar || needCard) renderAll();
  }, REINJECT_MS);

  setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
  refresh();
})();
