// Claude.ai provider — claude.ai 내부 usage API를 세션 쿠키로 조회한다.
// host_permissions에 claude.ai가 있으므로 fetch에 쿠키가 자동 동봉된다.

const BASE = 'https://claude.ai';
const ORG_CACHE_MS = 24 * 60 * 60 * 1000;

async function api(path) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    const err = new Error('not_logged_in');
    err.code = 'not_logged_in';
    throw err;
  }
  if (!res.ok) {
    const err = new Error('http_' + res.status);
    err.code = 'network';
    throw err;
  }
  return res.json();
}

// 개인 조직 우선 선택: rate_limit_tier에 플랜명이 붙은 조직(max/pro/free)을
// 팀/신뢰등급 조직(auto_trust_tier_*)보다 우선한다.
function pickOrg(orgs) {
  const scored = orgs.map((o) => {
    const tier = String(o.rate_limit_tier || '');
    let score = 0;
    if (/max/.test(tier)) score = 3;
    else if (/pro/.test(tier)) score = 2;
    else if (/free|default/.test(tier)) score = 1;
    return { org: o, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.org || null;
}

async function getOrgId() {
  const { claudeOrg } = await chrome.storage.local.get('claudeOrg');
  if (claudeOrg && Date.now() - claudeOrg.fetchedAt < ORG_CACHE_MS) {
    return claudeOrg.uuid;
  }
  const orgs = await api('/api/organizations');
  if (!Array.isArray(orgs) || orgs.length === 0) {
    const err = new Error('no_org');
    err.code = 'schema_changed';
    throw err;
  }
  const picked = pickOrg(orgs);
  await chrome.storage.local.set({
    claudeOrg: {
      uuid: picked.uuid,
      name: picked.name,
      tier: picked.rate_limit_tier,
      fetchedAt: Date.now(),
      all: orgs.map((o) => ({ uuid: o.uuid, name: o.name, tier: o.rate_limit_tier })),
    },
  });
  return picked.uuid;
}

const KIND_LABELS = {
  session: { ko: '세션 (5시간)', short: '5h' },
  weekly_all: { ko: '주간 전체', short: '7d' },
  weekly_scoped: { ko: '주간', short: '7d' },
};

function normalize(raw) {
  const windows = [];

  // 1차 소스: limits[] (검증됨 2026-07)
  if (Array.isArray(raw.limits)) {
    for (const l of raw.limits) {
      const meta = KIND_LABELS[l.kind] || { ko: l.kind, short: l.group };
      const model = l.scope?.model?.display_name;
      windows.push({
        kind: l.kind,
        label: model ? `${meta.ko} · ${model}` : meta.ko,
        short: meta.short,
        utilization: Math.round(l.percent ?? 0),
        severity: l.severity || 'normal',
        resetsAt: l.resets_at || null,
        isActive: !!l.is_active,
      });
    }
  }

  // 백업 경로: 레거시 필드 (limits가 사라졌을 때만)
  if (windows.length === 0) {
    for (const [key, kind] of [['five_hour', 'session'], ['seven_day', 'weekly_all']]) {
      const w = raw[key];
      if (w && typeof w.utilization === 'number') {
        const meta = KIND_LABELS[kind];
        windows.push({
          kind,
          label: meta.ko,
          short: meta.short,
          utilization: Math.round(w.utilization),
          severity: 'normal',
          resetsAt: w.resets_at || null,
          isActive: kind === 'session',
        });
      }
    }
  }

  if (windows.length === 0) {
    const err = new Error('unrecognized usage schema');
    err.code = 'schema_changed';
    throw err;
  }
  return windows;
}

export async function fetchUsage() {
  try {
    const orgId = await getOrgId();
    const raw = await api(`/api/organizations/${orgId}/usage`);
    return { ok: true, provider: 'claude', windows: normalize(raw), fetchedAt: Date.now() };
  } catch (e) {
    // 조직 캐시가 무효해졌을 수 있으므로 로그인 오류 시 캐시 제거
    if (e.code === 'not_logged_in') await chrome.storage.local.remove('claudeOrg');
    return { ok: false, provider: 'claude', error: e.code || 'network', fetchedAt: Date.now() };
  }
}
