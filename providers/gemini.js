// Gemini provider — gemini.google.com 내부 batchexecute RPC(jSf9Qc)로 한도를 조회한다.
// 1) GET /app HTML에서 CSRF 토큰(WIZ_global_data.SNlM0e) 추출 (쿠키 자동 동봉)
// 2) POST batchexecute?rpcids=jSf9Qc&source-path=/usage
// 응답 limits: [remaining, usedRatio, type, [[resetEpochSec]]] — type 1=5시간, 2=주간

const BASE = 'https://gemini.google.com';
const TOKEN_CACHE_MS = 10 * 60 * 1000;

async function getToken() {
  const { geminiToken } = await chrome.storage.local.get('geminiToken');
  if (geminiToken && Date.now() - geminiToken.fetchedAt < TOKEN_CACHE_MS) return geminiToken.at;

  const res = await fetch(BASE + '/app', { credentials: 'include' });
  if (!res.ok) {
    const err = new Error('http_' + res.status);
    err.code = 'network';
    throw err;
  }
  const html = await res.text();
  const m = html.match(/"SNlM0e":"(.*?)"/);
  if (!m) {
    // 토큰이 없으면 비로그인 상태
    const err = new Error('no token');
    err.code = 'not_logged_in';
    throw err;
  }
  await chrome.storage.local.set({ geminiToken: { at: m[1], fetchedAt: Date.now() } });
  return m[1];
}

const TYPE_LABELS = {
  1: '세션 (5시간)',
  2: '주간',
};

function parseLimits(text) {
  const start = text.indexOf('[');
  if (start === -1) return null;
  const outer = JSON.parse(text.substring(start));
  const inner = JSON.parse(outer[0][2]);
  const limits = inner?.[1];
  if (!Array.isArray(limits)) return null;

  const windows = [];
  for (const l of limits) {
    const type = l[2];
    if (!TYPE_LABELS[type]) continue; // 알려진 창(5시간/주간)만 표시
    const ratio = l[1];
    const resetSec = l[3]?.[0]?.[0];
    windows.push({
      kind: 'gemini:' + type,
      label: TYPE_LABELS[type],
      utilization: Math.round((ratio || 0) * 100),
      remaining: typeof l[0] === 'number' ? l[0] : undefined,
      resetsAt: resetSec ? new Date(resetSec * 1000).toISOString() : null,
      severity: ratio >= 1 ? 'critical' : ratio >= 0.8 ? 'warning' : 'normal',
    });
  }
  // 세션(1) → 주간(2) 순서로 정렬
  windows.sort((a, b) => a.kind.localeCompare(b.kind));
  return windows.length > 0 ? windows : null;
}

export async function fetchUsage() {
  try {
    let token = await getToken();

    const call = async (at) =>
      fetch(BASE + '/_/BardChatUi/data/batchexecute?rpcids=jSf9Qc&source-path=/usage', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ 'f.req': '[[["jSf9Qc","[]",null,"generic"]]]', at }).toString(),
      });

    let res = await call(token);
    let text = res.ok ? await res.text() : '';
    let windows = text ? parseLimits(text) : null;

    // 실패 시 토큰이 회전됐을 수 있으므로 캐시 비우고 1회 재시도
    if (!windows) {
      await chrome.storage.local.remove('geminiToken');
      token = await getToken();
      res = await call(token);
      if (res.ok) windows = parseLimits(await res.text());
    }

    if (!windows) {
      const err = new Error('unrecognized schema');
      err.code = 'schema_changed';
      throw err;
    }
    return { ok: true, provider: 'gemini', windows, fetchedAt: Date.now() };
  } catch (e) {
    return { ok: false, provider: 'gemini', error: e.code || 'network', fetchedAt: Date.now() };
  }
}
