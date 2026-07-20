// Grok provider
// 1) 주간 공유 풀: POST /grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig (gRPC-web, 빈 프레임)
//    응답 protobuf: field1{ 1:전체%(f32), 5:{1:리셋epoch}, 7(repeated):{1:제품id, 2:%(f32)} }
//    제품 id → 1: API, 4: 채팅 (실측 검증)
// 2) 모델별 쿼리 한도: POST /rest/rate-limits {requestKind, modelName} (JSON)

const BASE = 'https://grok.com';

const MODELS = [
  { model: 'grok-4', kind: 'DEFAULT', label: 'Grok 4' },
  { model: 'grok-3', kind: 'DEFAULT', label: 'Grok 3' },
];

const PRODUCT_LABELS = { 1: 'API', 2: 'Imagine', 4: '채팅', 5: 'Build' };

function windowLabel(sec) {
  const h = Math.round(sec / 3600);
  return h >= 24 ? `${Math.round(h / 24)}일` : `${h}시간`;
}

// ---------- gRPC-web / protobuf ----------

function extractMessage(bytes) {
  let off = 0;
  while (off + 5 <= bytes.length) {
    const flag = bytes[off];
    const len = (bytes[off + 1] << 24) | (bytes[off + 2] << 16) | (bytes[off + 3] << 8) | bytes[off + 4];
    off += 5;
    if (flag & 0x80) { off += len; continue; }
    return bytes.subarray(off, off + len);
  }
  return null;
}

function parseProto(b) {
  const out = {};
  let i = 0;
  const rv = () => { let r = 0, s = 0; for (;;) { const x = b[i++]; r += (x & 0x7f) * Math.pow(2, s); if (!(x & 0x80)) break; s += 7; } return r; };
  while (i < b.length) {
    const key = rv();
    const f = Math.floor(key / 8), w = key & 7;
    let v;
    if (w === 0) v = { w, v: rv() };
    else if (w === 5) { v = { w, v: new DataView(b.buffer, b.byteOffset + i, 4).getFloat32(0, true) }; i += 4; }
    else if (w === 1) { i += 8; v = { w, v: null }; }
    else if (w === 2) { const ln = rv(); v = { w, v: b.subarray(i, i + ln) }; i += ln; }
    else break;
    (out[f] = out[f] || []).push(v);
  }
  return out;
}

async function fetchWeeklyPool() {
  const res = await fetch(BASE + '/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/grpc-web+proto', 'x-grpc-web': '1' },
    body: new Uint8Array([0, 0, 0, 0, 0]),
  });
  if (!res.ok || !(res.headers.get('content-type') || '').includes('grpc')) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  const msg = extractMessage(bytes);
  if (!msg) return null;
  const top = parseProto(msg);
  const boxField = top[1] && top[1][0];
  if (!boxField || boxField.w !== 2) return null;
  const box = parseProto(boxField.v);
  const total = box[1] && box[1][0] && box[1][0].w === 5 ? Math.round(box[1][0].v) : null;
  if (total == null) return null;
  let resetsAt = null;
  if (box[5] && box[5][0] && box[5][0].w === 2) {
    const period = parseProto(box[5][0].v);
    const sec = period[1] && period[1][0] && period[1][0].w === 0 ? period[1][0].v : null;
    if (sec) resetsAt = new Date(sec * 1000).toISOString();
  }
  const parts = [];
  for (const item of box[7] || []) {
    if (item.w !== 2) continue;
    const p = parseProto(item.v);
    const id = p[1] && p[1][0] ? p[1][0].v : null;
    const pct = p[2] && p[2][0] && p[2][0].w === 5 ? Math.round(p[2][0].v) : null;
    if (id != null && pct != null) parts.push((PRODUCT_LABELS[id] || '기타') + ' ' + pct + '%');
  }
  return {
    kind: 'grok:weekly_pool',
    label: '주간 한도' + (parts.length ? ' (' + parts.join(' · ') + ')' : ''),
    utilization: total,
    resetsAt,
    severity: total >= 90 ? 'critical' : total >= 70 ? 'warning' : 'normal',
  };
}

// ---------- 모델별 쿼리 한도 ----------

async function fetchModel({ model, kind, label }) {
  const res = await fetch(BASE + '/rest/rate-limits', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestKind: kind, modelName: model }),
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('not_logged_in');
    err.code = 'not_logged_in';
    throw err;
  }
  if (!res.ok) return null;
  const raw = await res.json();
  if (typeof raw.remainingQueries !== 'number' || typeof raw.totalQueries !== 'number') return null;
  const used = raw.totalQueries - raw.remainingQueries;
  return {
    kind: 'grok:' + model + ':' + kind,
    label: label + ' (' + windowLabel(raw.windowSizeSeconds) + ')',
    utilization: raw.totalQueries > 0 ? Math.round((used / raw.totalQueries) * 100) : 0,
    remaining: raw.remainingQueries,
    total: raw.totalQueries,
    resetsAt: null,
    severity: raw.remainingQueries === 0 ? 'critical' : 'normal',
  };
}

export async function fetchUsage() {
  try {
    const [pool, ...models] = await Promise.all([
      fetchWeeklyPool().catch(() => null),
      ...MODELS.map((m) => fetchModel(m).catch((e) => {
        if (e.code === 'not_logged_in') throw e;
        return null;
      })),
    ]);
    const windows = [pool, ...models].filter(Boolean);
    if (windows.length === 0) {
      const err = new Error('no data');
      err.code = 'schema_changed';
      throw err;
    }
    return { ok: true, provider: 'grok', windows, fetchedAt: Date.now() };
  } catch (e) {
    return { ok: false, provider: 'grok', error: e.code || 'network', fetchedAt: Date.now() };
  }
}
