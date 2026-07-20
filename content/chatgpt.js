// AI Usage Meter — chatgpt.com 오버레이 content script
// 입력창 하단 미니 바 + 사이드바 Usage 카드. 데이터는 background의 chatgpt provider를 쓴다.

(() => {
  const REFRESH_MS = 60 * 1000;
  const REINJECT_MS = 1500;
  const i18n = globalThis.__aumI18n;
  let lastResult = null;
  let extraExpanded = false; // 잔여횟수 상세 펼침 상태 (재렌더에도 유지)

  async function getUsage() {
    try {
      const r = await chrome.runtime.sendMessage({ type: 'refresh', provider: 'chatgpt' });
      if (r) return r;
    } catch (_) { /* 캐시 폴백 */ }
    const { usage_chatgpt } = await chrome.storage.local.get('usage_chatgpt');
    return usage_chatgpt || null;
  }

  // ---------- 입력창 하단 바 ----------

  function findComposerAnchor() {
    const input = document.querySelector('#prompt-textarea');
    if (!input) return null;
    return input.closest('form');
  }

  function renderComposerBar() {
    const anchor = findComposerAnchor();
    if (!anchor) return;
    let bar = document.getElementById('aum-composer-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'aum-composer-bar';
      bar.className = 'aum-composer-bar aum-chatgpt';
      anchor.insertAdjacentElement('afterend', bar);
      // 펼침 토글 (innerHTML 재작성에도 살아남도록 bar에 위임)
      bar.addEventListener('click', (e) => {
        if (e.target.closest('.aum-toggle')) {
          extraExpanded = !extraExpanded;
          renderComposerBar();
        }
      });
    }
    if (!lastResult || !lastResult.ok) {
      bar.style.display = 'none';
      return;
    }
    bar.style.display = '';
    const pctItem = (w) => {
      const cls = w.utilization >= 90 || w.severity === 'critical' ? 'crit'
        : w.utilization >= 70 || w.severity === 'warning' ? 'warn' : '';
      return `<span class="aum-item">${globalThis.__aumEscapeHtml(i18n.localizeLabel(w.label))} <span class="aum-pct">${w.utilization}%</span>` +
        `<span class="aum-track"><span class="aum-fill ${cls}" style="width:${Math.min(w.utilization, 100)}%; display:block"></span></span>` +
        `<span class="aum-muted">${i18n.formatReset(w.resetsAt)}</span></span>`;
    };
    // 대표 한도(작업 사용량) 하나만 항상 표시하고 나머지는 전부 '상세'로 접는다
    const pctWindows = lastResult.windows.filter((w) => typeof w.utilization === 'number');
    const primary = pctWindows[0];
    let html = primary ? pctItem(primary) : '';
    // 퍼센트 한도를 못 받은 경우(wham 실패 등)에도 바가 비지 않게 첫 항목을 노출
    let promoted = null;
    if (!primary && lastResult.windows[0]) {
      promoted = lastResult.windows[0];
      html = `<span class="aum-item">${globalThis.__aumEscapeHtml(i18n.localizeLabel(promoted.label))} <span class="aum-pct">${i18n.msg('remainingCount', String(promoted.remaining ?? '?'))}</span><span class="aum-muted">${i18n.formatReset(promoted.resetsAt)}</span></span>`;
    }

    const extras = [];
    for (const w of pctWindows.slice(1)) extras.push(pctItem(w));
    for (const w of lastResult.windows) {
      if (typeof w.utilization === 'number' || w === promoted) continue;
      const crit = w.remaining === 0 ? ' style="color:#dc2626"' : '';
      extras.push(`<span class="aum-item">${globalThis.__aumEscapeHtml(i18n.localizeLabel(w.label))} <span class="aum-pct"${crit}>${i18n.msg('remainingCount', String(w.remaining ?? '?'))}</span></span>`);
    }
    if (extras.length > 0) {
      const soldOut = lastResult.windows.some((w) => w.remaining === 0);
      html += `<button class="aum-toggle${soldOut ? ' crit' : ''}" type="button">${extraExpanded ? i18n.msg('collapseDetails') : i18n.msg('expandDetails')}</button>`;
      if (extraExpanded) {
        html += '<span class="aum-extra">' + extras.join('<span class="aum-muted">·</span>') + '</span>';
      }
    }
    bar.innerHTML = html;
  }

  // ---------- 사이드바 카드 ----------

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    return r.width > 60 && r.top >= 0 && r.top < window.innerHeight;
  }

  function findSidebarAnchor() {
    // nav가 두 개다(접힌 레일 + 펼친 사이드바) — 화면에 보이는 쪽을 고른다.
    const btns = [...document.querySelectorAll('[data-testid="accounts-profile-button"]')];
    const btn = btns.find(isVisible);
    if (btn) {
      const block = btn.closest('nav > *, aside > *') || btn.parentElement;
      if (block) return { mode: 'before', el: block };
    }
    const nav = [...document.querySelectorAll('nav')].find((n) => n.getBoundingClientRect().width > 150);
    if (nav) return { mode: 'append', el: nav };
    return null;
  }

  function renderSidebarCard() {
    const found = findSidebarAnchor();
    if (!found) return;
    let card = document.getElementById('aum-sidebar-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'aum-sidebar-card';
      card.className = 'aum-sidebar-card aum-chatgpt';
      if (found.mode === 'before') found.el.insertAdjacentElement('beforebegin', card);
      else found.el.appendChild(card);
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
    const rows = lastResult.windows
      .map((w) => {
        if (typeof w.utilization === 'number') {
          return `<div class="aum-row">
            <div class="aum-row-head"><span>${globalThis.__aumEscapeHtml(i18n.localizeLabel(w.label))}</span><span class="aum-pct">${w.utilization}%</span></div>
            <div class="aum-track"><div class="aum-fill" style="width:${Math.min(w.utilization, 100)}%"></div></div>
            <div class="aum-reset">${i18n.formatReset(w.resetsAt)}</div>
          </div>`;
        }
        const crit = w.remaining === 0 ? ' style="color:#dc2626"' : '';
        return `<div class="aum-row">
          <div class="aum-row-head"><span>${globalThis.__aumEscapeHtml(i18n.localizeLabel(w.label))}</span><span class="aum-pct"${crit}>${i18n.msg('remainingCount', String(w.remaining ?? '?'))}</span></div>
          <div class="aum-reset">${i18n.formatReset(w.resetsAt)}</div>
        </div>`;
      })
      .join('');
    card.innerHTML =
      '<div class="aum-title"><span>' + i18n.msg('usageTitle') + '</span><span class="aum-time">' +
      i18n.formatTime(lastResult.fetchedAt, { hour: '2-digit', minute: '2-digit' }) +
      '</span></div>' +
      rows;
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
