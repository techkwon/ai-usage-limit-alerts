// ChatGPT provider — chatgpt.com 내부 API로 한도/잔여량을 조회한다.
// 1) GET /api/auth/session (쿠키) → accessToken
// 2) POST /backend-api/conversation/init (Bearer) → limits_progress / model_limits

const BASE = 'https://chatgpt.com';

const FEATURE_LABELS = {
  deep_research: '딥 리서치',
  image_gen: '이미지 생성',
  file_upload: '파일 업로드',
  advanced_voice: '고급 음성',
  paste_text_to_file: '텍스트→파일 변환',
};

async function getToken() {
  const res = await fetch(BASE + '/api/auth/session', { credentials: 'include' });
  if (!res.ok) {
    const err = new Error('not_logged_in');
    err.code = 'not_logged_in';
    throw err;
  }
  const s = await res.json();
  if (!s?.accessToken) {
    const err = new Error('no token');
    err.code = 'not_logged_in';
    throw err;
  }
  return s.accessToken;
}

function windowLabel(sec) {
  if (sec === 604800) return '주간';
  if (sec === 18000) return '5시간';
  if (sec === 10800) return '3시간';
  const h = Math.round(sec / 3600);
  return h >= 24 ? `${Math.round(h / 24)}일` : `${h}시간`;
}

// /backend-api/wham/usage — 설정→사용량 화면의 데이터 (Codex/Work/Agents 공유 한도)
function normalizeWham(raw) {
  const windows = [];
  const push = (name, rl) => {
    // primary(주간) 외에 secondary(5시간 등)가 생기면 함께 표시한다.
    // 이벤트 기간에는 secondary_window가 null이지만 한도가 부활하면 여기로 온다.
    for (const key of ['primary_window', 'secondary_window']) {
      const w = rl?.[key];
      if (!w || typeof w.used_percent !== 'number') continue;
      windows.push({
        kind: 'wham:' + name + ':' + key,
        label: name + ' (' + windowLabel(w.limit_window_seconds) + ')',
        utilization: Math.round(w.used_percent),
        resetsAt: w.reset_at ? new Date(w.reset_at * 1000).toISOString() : null,
        severity: rl.limit_reached ? 'critical' : w.used_percent >= 80 ? 'warning' : 'normal',
      });
    }
  };
  push('작업 사용량', raw.rate_limit); // Codex·Work·Workspace Agents·Excel 공유
  for (const a of raw.additional_rate_limits || []) push(a.limit_name || a.metered_feature, a.rate_limit);
  const resets = raw.rate_limit_reset_credits?.available_count;
  return { windows, fullResets: typeof resets === 'number' ? resets : null };
}

function normalize(raw) {
  const windows = [];

  // 기능별 잔여량 (Pro 포함 전 플랜 공통)
  if (Array.isArray(raw.limits_progress)) {
    for (const l of raw.limits_progress) {
      windows.push({
        kind: 'feature:' + l.feature_name,
        label: FEATURE_LABELS[l.feature_name] || l.feature_name,
        remaining: l.remaining,
        resetsAt: l.reset_after || null,
        severity: l.remaining === 0 ? 'critical' : 'normal',
      });
    }
  }

  // 모델별 메시지 한도 (Plus/무료 등 한도 있는 플랜에서 채워짐)
  if (Array.isArray(raw.model_limits)) {
    for (const m of raw.model_limits) {
      windows.push({
        kind: 'model:' + (m.model_slug || m.slug || '?'),
        label: m.display_name || m.model_slug || m.slug || '모델 한도',
        remaining: m.remaining ?? m.remaining_messages,
        utilization: typeof m.percent === 'number' ? Math.round(m.percent) : undefined,
        resetsAt: m.reset_after || m.resets_at || null,
        severity: 'normal',
      });
    }
  }

  return windows;
}

export async function fetchUsage() {
  try {
    const token = await getToken();
    const res = await fetch(BASE + '/backend-api/conversation/init', {
      method: 'POST',
      credentials: 'include',
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: '{}',
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
    const raw = await res.json();
    const windows = normalize(raw);

    // 설정→사용량 화면과 동일한 데이터 (실패해도 기본 정보는 유지)
    let fullResets = null;
    try {
      const wres = await fetch(BASE + '/backend-api/wham/usage', {
        credentials: 'include',
        headers: { authorization: 'Bearer ' + token },
      });
      if (wres.ok) {
        const wham = normalizeWham(await wres.json());
        windows.unshift(...wham.windows); // 퍼센트형 한도를 맨 위에 표시
        fullResets = wham.fullResets;
      }
    } catch (_) { /* wham 실패는 무시 */ }

    return {
      ok: true,
      provider: 'chatgpt',
      windows,
      unlimited: Array.isArray(raw.model_limits) && raw.model_limits.length === 0,
      fullResets,
      fetchedAt: Date.now(),
    };
  } catch (e) {
    return { ok: false, provider: 'chatgpt', error: e.code || 'network', fetchedAt: Date.now() };
  }
}
