// AI Usage Meter — background service worker
// chrome.alarms로 주기 폴링하고 결과를 storage에 캐시, 툴바 배지를 갱신한다.

import { fetchUsage as fetchClaude } from './providers/claude.js';
import { fetchUsage as fetchChatgpt } from './providers/chatgpt.js';
import { fetchUsage as fetchGrok } from './providers/grok.js';
import { fetchUsage as fetchGemini } from './providers/gemini.js';

const ALARM = 'poll-usage';
const POLL_MINUTES = 5;
const PROVIDERS = {
  claude: { fetch: fetchClaude, label: 'Claude', storageKey: 'usage_claude', updatesBadge: true },
  chatgpt: { fetch: fetchChatgpt, label: 'ChatGPT', storageKey: 'usage_chatgpt' },
  grok: { fetch: fetchGrok, label: 'Grok', storageKey: 'usage_grok' },
  gemini: { fetch: fetchGemini, label: 'Gemini', storageKey: 'usage_gemini' },
};
const providerRefreshes = new Map();

let notifyStateFlushPromise = null;
const notifyStateMutations = [];
const MESSAGE_FALLBACKS = {
  notificationResetTitle: '$1 usage reset ✅',
  notificationResetPercentMessage: '$1 limit has reset. You can use 100% again.',
  notificationExhaustedTitle: '$1 limit reached 🚨',
  notificationReached100Message: '$1 usage reached 100%.',
  notificationReached80Title: '$1 usage at 80% ⚠️',
  notificationReached80Message: '$1 usage is $2%. You are getting close to the limit.',
  notificationResetRemainingMessage: '$1 limit has reset. ($2 left)',
  notificationRemainingExhaustedMessage: 'All remaining $1 uses have been used.',
};

chrome.runtime.onInstalled.addListener(() => schedule());
chrome.runtime.onStartup.addListener(() => schedule());

function msg(key, substitutions) {
  const values = substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
  const localized = chrome.i18n?.getMessage?.(key, values);
  if (localized) return localized;
  const template = MESSAGE_FALLBACKS[key] || '';
  return template.replace(/\$(\d+)/g, (_match, index) => values[Number(index) - 1] ?? '');
}

function localizeLabel(label) {
  const source = String(label ?? '');
  const uiLanguage = (chrome.i18n?.getUILanguage?.() || 'en').toLowerCase();
  if (!source) return source;

  if (uiLanguage.startsWith('ko')) {
    const replacements = [
      [/Workspace Agents/gi, '워크스페이스 에이전트'],
      [/Session \(5 hours\)/gi, '세션 (5시간)'],
      [/Weekly total/gi, '주간 전체'],
      [/Weekly limit/gi, '주간 한도'],
      [/Work usage/gi, '작업 사용량'],
      [/Deep research/gi, '딥 리서치'],
      [/Image generation/gi, '이미지 생성'],
      [/File upload/gi, '파일 업로드'],
      [/Advanced voice/gi, '고급 음성'],
      [/Text to file/gi, '텍스트→파일 변환'],
      [/Model limit/gi, '모델 한도'],
      [/\bAgents\b/gi, '에이전트'],
      [/\bImagine\b/gi, '이미지'],
      [/\bBuild\b/gi, '빌드'],
      [/\bWeekly\b/gi, '주간'],
      [/\bChat\b/gi, '채팅'],
      [/\bOther\b/gi, '기타'],
    ];
    let translated = source;
    for (const [pattern, replacement] of replacements) translated = translated.replace(pattern, replacement);
    return translated
      .replace(/(\d+)\s+days?/gi, '$1일')
      .replace(/(\d+)\s+hours?/gi, '$1시간');
  }

  const replacements = [
    ['텍스트→파일 변환', 'Text to file'],
    ['세션 (5시간)', 'Session (5 hours)'],
    ['작업 사용량', 'Work usage'],
    ['주간 전체', 'Weekly total'],
    ['주간 한도', 'Weekly limit'],
    ['딥 리서치', 'Deep research'],
    ['이미지 생성', 'Image generation'],
    ['파일 업로드', 'File upload'],
    ['고급 음성', 'Advanced voice'],
    ['모델 한도', 'Model limit'],
    ['주간', 'Weekly'],
    ['채팅', 'Chat'],
    ['기타', 'Other'],
  ];
  let translated = source;
  for (const [from, to] of replacements) translated = translated.replaceAll(from, to);
  return translated
    .replace(/(\d+)일/g, (_match, value) => `${value} ${value === '1' ? 'day' : 'days'}`)
    .replace(/(\d+)시간/g, (_match, value) => `${value} ${value === '1' ? 'hour' : 'hours'}`);
}

function schedule() {
  chrome.alarms.create(ALARM, { periodInMinutes: POLL_MINUTES, delayInMinutes: 0 });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) refreshAllProviders();
});

// 팝업과의 메시지: 'refresh'(갱신 요청) / 'badge'(팝업이 직접 조회한 결과로 배지 갱신)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'refresh') {
    refreshProvider(msg.provider)
      .then((result) => sendResponse(result))
      .catch((e) => sendResponse({ ok: false, error: 'network', detail: String(e) }));
    return true; // async
  }
  if (msg?.type === 'refresh_all') {
    refreshAllProviders()
      .then((all) => sendResponse(all))
      .catch((e) => sendResponse({ ok: false, error: 'network', detail: String(e) }));
    return true; // async
  }
  if (msg?.type === 'badge' && msg.result) {
    updateBadge(msg.result);
    checkNotifications(msg.result, 'Claude')
      .then(() => sendResponse(true))
      .catch(() => sendResponse(false));
    return true;
  }
  if (msg?.type === 'report' && msg.results) {
    const notificationChecks = [];
    if (msg.results.claude) {
      updateBadge(msg.results.claude);
      notificationChecks.push(checkNotifications(msg.results.claude, 'Claude'));
    }
    if (msg.results.chatgpt) notificationChecks.push(checkNotifications(msg.results.chatgpt, 'ChatGPT'));
    if (msg.results.grok) notificationChecks.push(checkNotifications(msg.results.grok, 'Grok'));
    if (msg.results.gemini) notificationChecks.push(checkNotifications(msg.results.gemini, 'Gemini'));
    Promise.all(notificationChecks)
      .then(() => sendResponse(true))
      .catch(() => sendResponse(false));
    return true;
  }
});

function getProviderId(providerId) {
  return providerId && PROVIDERS[providerId] ? providerId : 'claude';
}

function getProvider(providerId) {
  const id = getProviderId(providerId);
  return { id, ...PROVIDERS[id] };
}

function refreshProvider(providerId) {
  const provider = getProvider(providerId);
  const existing = providerRefreshes.get(provider.id);
  if (existing) return existing;

  const refreshPromise = (async () => {
    const result = await provider.fetch();
    await chrome.storage.local.set({ [provider.storageKey]: result });
    if (provider.updatesBadge) updateBadge(result);
    await checkNotifications(result, provider.label);
    return result;
  })().finally(() => {
    providerRefreshes.delete(provider.id);
  });

  providerRefreshes.set(provider.id, refreshPromise);
  return refreshPromise;
}

async function refreshAllProviders() {
  const entries = await Promise.all(
    Object.keys(PROVIDERS).map(async (providerId) => [providerId, await refreshProvider(providerId)]),
  );
  return Object.fromEntries(entries);
}

const SEVERITY_COLORS = {
  normal: '#22c55e',
  warning: '#eab308',
  elevated: '#eab308',
  critical: '#ef4444',
  exceeded: '#ef4444',
};

function updateBadge(result) {
  if (!result.ok) {
    chrome.action.setBadgeText({ text: result.error === 'not_logged_in' ? '×' : '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#9ca3af' });
    return;
  }
  // 가장 높은 사용률 창 기준으로 배지 표시 (Claude 기준)
  const pctWindows = result.windows.filter((w) => typeof w.utilization === 'number');
  if (pctWindows.length === 0) return;
  const top = [...pctWindows].sort((a, b) => b.utilization - a.utilization)[0];
  const color =
    SEVERITY_COLORS[top.severity] ||
    (top.utilization >= 90 ? '#ef4444' : top.utilization >= 70 ? '#eab308' : '#22c55e');
  chrome.action.setBadgeText({ text: String(top.utilization) + '%' });
  chrome.action.setBadgeBackgroundColor({ color });
}

// ---------- 데스크톱 알림 ----------
// 창(window)별로 80% 도달 / 100% 도달(소진) / 리셋 복구를 각 1회씩 알린다.
// 상태는 storage에 남겨 서비스 워커가 재기동돼도 중복 알림이 없다.

function notify(id, title, message) {
  chrome.notifications.create(id + ':' + Date.now(), {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message,
    priority: 1,
  });
}

function getNotificationLabelKey(windowInfo) {
  const rawLabel = typeof windowInfo?.label === 'string' && windowInfo.label.trim()
    ? windowInfo.label.trim()
    : windowInfo.kind;
  if (windowInfo?.kind === 'weekly_scoped' && rawLabel.includes('·')) {
    return rawLabel.split('·').pop().trim();
  }
  return rawLabel;
}

function getNotificationStateKey(providerLabel, windowInfo) {
  const baseKey = providerLabel + ':' + windowInfo.kind;
  if (windowInfo?.kind !== 'weekly_scoped') return baseKey;
  return baseKey + ':' + getNotificationLabelKey(windowInfo);
}

function queueNotifyStateMutation(mutate) {
  return new Promise((resolve, reject) => {
    notifyStateMutations.push({ mutate, resolve, reject });
    if (!notifyStateFlushPromise) {
      notifyStateFlushPromise = Promise.resolve().then(flushNotifyStateMutations);
    }
  });
}

async function flushNotifyStateMutations() {
  const batch = notifyStateMutations.splice(0, notifyStateMutations.length);
  try {
    const { notify_state = {} } = await chrome.storage.local.get('notify_state');
    const completed = [];
    for (const item of batch) {
      try {
        completed.push({ item, value: await item.mutate(notify_state) });
      } catch (error) {
        item.reject(error);
      }
    }
    await chrome.storage.local.set({ notify_state });
    for (const { item, value } of completed) {
      item.resolve(value);
    }
  } catch (error) {
    for (const item of batch) {
      item.reject(error);
    }
  } finally {
    notifyStateFlushPromise = null;
    if (notifyStateMutations.length) {
      notifyStateFlushPromise = Promise.resolve().then(flushNotifyStateMutations);
    }
  }
}

async function checkNotifications(result, providerLabel) {
  if (!result?.ok) return;
  return queueNotifyStateMutation((notify_state) => {
    for (const w of result.windows) {
      const key = getNotificationStateKey(providerLabel, w);
      const prev = notify_state[key];

      // 퍼센트형 한도 (Claude 전체, ChatGPT 작업 사용량 등)
      if (typeof w.utilization === 'number') {
        const state = { util: w.utilization, resetsAt: w.resetsAt, sent80: prev?.sent80 || false, sent100: prev?.sent100 || false };

        // 리셋 감지: resets_at이 바뀌었거나 사용률이 크게 떨어짐
        const wasHigh = prev && prev.util >= 80;
        const isReset = prev && (prev.resetsAt !== w.resetsAt || w.utilization < prev.util - 30);
        if (isReset) {
          state.sent80 = false;
          state.sent100 = false;
          if (wasHigh) {
            notify(
              'reset-' + key,
              msg('notificationResetTitle', providerLabel),
              msg('notificationResetPercentMessage', localizeLabel(w.label)),
            );
          }
        }

        if (w.utilization >= 100 && !state.sent100) {
          state.sent100 = true;
          state.sent80 = true;
          notify(
            '100-' + key,
            msg('notificationExhaustedTitle', providerLabel),
            msg('notificationReached100Message', localizeLabel(w.label)),
          );
        } else if (w.utilization >= 80 && !state.sent80) {
          state.sent80 = true;
          notify(
            '80-' + key,
            msg('notificationReached80Title', providerLabel),
            msg('notificationReached80Message', [localizeLabel(w.label), String(w.utilization)]),
          );
        }

        notify_state[key] = state;
        continue;
      }

      // 잔여횟수형 한도 (ChatGPT 딥 리서치·이미지 생성 등): 소진/복구 알림
      if (typeof w.remaining === 'number') {
        const state = { rem: w.remaining, resetsAt: w.resetsAt, sent0: prev?.sent0 || false };

        const isReset = prev && (prev.resetsAt !== w.resetsAt || w.remaining > prev.rem);
        if (isReset) {
          if (state.sent0) {
            notify(
              'reset-' + key,
              msg('notificationResetTitle', providerLabel),
              msg('notificationResetRemainingMessage', [localizeLabel(w.label), String(w.remaining)]),
            );
          }
          state.sent0 = false;
        }

        if (w.remaining === 0 && !state.sent0) {
          state.sent0 = true;
          notify(
            '0-' + key,
            msg('notificationExhaustedTitle', providerLabel),
            msg('notificationRemainingExhaustedMessage', localizeLabel(w.label)),
          );
        }

        notify_state[key] = state;
      }
    }
  });
}
