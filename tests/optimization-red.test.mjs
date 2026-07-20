import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

function toModuleUrl(absPath, cache = new Map()) {
  if (cache.has(absPath)) return cache.get(absPath);

  let source = readFileSync(absPath, 'utf8');
  source = source.replace(/from\s+['"](\.[^'"]+)['"]/g, (_full, specifier) => {
    const resolved = path.resolve(path.dirname(absPath), specifier);
    return `from '${toModuleUrl(resolved, cache)}'`;
  });

  const url = `data:text/javascript;base64,${Buffer.from(`// ${absPath}\n${source}`).toString('base64')}`;
  cache.set(absPath, url);
  return url;
}

async function importRepoModule(relativePath) {
  const url = toModuleUrl(path.resolve(ROOT, relativePath));
  return import(`${url}#${Date.now()}-${Math.random()}`);
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...(init.headers || {}) },
  });
}

function textResponse(body, init = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...(init.headers || {}) },
  });
}

function grpcResponse() {
  return new Response(new Uint8Array([0, 0, 0, 0, 0]), {
    status: 200,
    headers: { 'content-type': 'application/grpc-web+proto' },
  });
}

function createChromeMock({ initialStorage = {}, beforeStorageSet, uiLanguage = 'en-US', messages = {} } = {}) {
  const storage = structuredClone(initialStorage);
  const notifications = [];
  const listeners = { onMessage: null };

  function formatMessage(template, substitutions) {
    const values = substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
    return String(template).replace(/\$(\d+)/g, (_match, index) => values[Number(index) - 1] ?? '');
  }

  const chrome = {
    i18n: {
      getUILanguage() {
        return uiLanguage;
      },
      getMessage(key, substitutions) {
        if (!Object.hasOwn(messages, key)) return '';
        return formatMessage(messages[key], substitutions);
      },
    },
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      onMessage: {
        addListener(listener) {
          listeners.onMessage = listener;
        },
      },
    },
    alarms: {
      create() {},
      onAlarm: { addListener() {} },
    },
    action: {
      setBadgeText() {},
      setBadgeBackgroundColor() {},
    },
    notifications: {
      create(id, options) {
        notifications.push({ id, title: options.title, message: options.message });
      },
    },
    storage: {
      local: {
        async get(keys) {
          if (typeof keys === 'string') return { [keys]: structuredClone(storage[keys]) };
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map((key) => [key, structuredClone(storage[key])]));
          }
          if (keys && typeof keys === 'object') {
            return Object.fromEntries(
              Object.entries(keys).map(([key, value]) => [key, storage[key] === undefined ? value : structuredClone(storage[key])]),
            );
          }
          return structuredClone(storage);
        },
        async set(values) {
          if (beforeStorageSet) await beforeStorageSet(values);
          Object.assign(storage, structuredClone(values));
        },
        async remove(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
        },
      },
    },
  };

  return { chrome, storage, notifications, listeners };
}

async function dispatchMessage(listener, message) {
  return new Promise((resolve, reject) => {
    try {
      const maybeAsync = listener(message, {}, (response) => resolve(response));
      if (maybeAsync !== true && message.type !== 'refresh') resolve(undefined);
    } catch (error) {
      reject(error);
    }
  });
}

function createBackgroundFetchMock(callLog, { conversationDelay } = {}) {
  return async (url, init = {}) => {
    callLog.push({ url: String(url), method: init.method || 'GET' });

    if (url === 'https://claude.ai/api/organizations') {
      return jsonResponse([{ uuid: 'org-1', name: 'Personal', rate_limit_tier: 'claude_pro' }]);
    }
    if (url === 'https://claude.ai/api/organizations/org-1/usage') {
      return jsonResponse({
        limits: [{ kind: 'session', group: 'session', percent: 20, severity: 'normal', resets_at: '2026-07-20T01:00:00.000Z', is_active: true }],
      });
    }
    if (url === 'https://chatgpt.com/api/auth/session') {
      return jsonResponse({ accessToken: 'token-1' });
    }
    if (url === 'https://chatgpt.com/backend-api/conversation/init') {
      if (conversationDelay) await conversationDelay();
      return jsonResponse({ limits_progress: [], model_limits: [] });
    }
    if (url === 'https://chatgpt.com/backend-api/wham/usage') {
      return jsonResponse({ rate_limit: null, additional_rate_limits: [], rate_limit_reset_credits: { available_count: 0 } });
    }
    if (url === 'https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig') {
      return grpcResponse();
    }
    if (url === 'https://grok.com/rest/rate-limits') {
      return jsonResponse({ windowSizeSeconds: 14400, remainingQueries: 5, totalQueries: 10 });
    }
    if (url === 'https://gemini.google.com/app') {
      return textResponse('<html>"SNlM0e":"token-xyz"</html>', { headers: { 'content-type': 'text/html' } });
    }
    if (String(url).startsWith('https://gemini.google.com/_/BardChatUi/data/batchexecute')) {
      const payload = JSON.stringify([[null, null, JSON.stringify([null, [[2, 0.5, 1, [[1_752_814_800]]]]])]]);
      return textResponse(`)]}'\n${payload}`);
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };
}

test('refresh for provider=chatgpt fetches only ChatGPT provider data', async () => {
  const { chrome, listeners } = createChromeMock();
  const calls = [];
  globalThis.chrome = chrome;
  globalThis.fetch = createBackgroundFetchMock(calls);

  await importRepoModule('background.js');
  const response = await dispatchMessage(listeners.onMessage, { type: 'refresh', provider: 'chatgpt' });

  assert.equal(response.provider, 'chatgpt');
  assert.deepEqual(
    calls.map((entry) => entry.url),
    [
      'https://chatgpt.com/api/auth/session',
      'https://chatgpt.com/backend-api/conversation/init',
      'https://chatgpt.com/backend-api/wham/usage',
    ],
  );
});

test('simultaneous refreshes for the same provider share one in-flight ChatGPT request', async () => {
  const { chrome, listeners } = createChromeMock();
  const calls = [];
  const releases = [];
  const conversationDelay = () => new Promise((resolve) => {
    releases.push(resolve);
  });

  globalThis.chrome = chrome;
  globalThis.fetch = createBackgroundFetchMock(calls, { conversationDelay });

  await importRepoModule('background.js');

  const first = dispatchMessage(listeners.onMessage, { type: 'refresh', provider: 'chatgpt' });
  const second = dispatchMessage(listeners.onMessage, { type: 'refresh', provider: 'chatgpt' });

  while (calls.filter((entry) => entry.url === 'https://chatgpt.com/backend-api/conversation/init').length < 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  for (const release of releases) release();
  await Promise.all([first, second]);

  assert.equal(
    calls.filter((entry) => entry.url === 'https://chatgpt.com/backend-api/conversation/init').length,
    1,
  );
});

test('report processing preserves notify_state updates for multiple providers without lost writes', async () => {
  const { chrome, storage, listeners } = createChromeMock();
  globalThis.chrome = chrome;
  globalThis.fetch = createBackgroundFetchMock([]);

  await importRepoModule('background.js');
  await dispatchMessage(listeners.onMessage, {
    type: 'report',
    results: {
      chatgpt: {
        ok: true,
        windows: [{ kind: 'feature:image_gen', label: 'Image', remaining: 0, resetsAt: '2026-07-20T05:00:00.000Z' }],
      },
      grok: {
        ok: true,
        windows: [{ kind: 'grok:grok-4:DEFAULT', label: 'Grok 4', utilization: 85, resetsAt: '2026-07-20T06:00:00.000Z' }],
      },
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(Object.keys(storage.notify_state || {}).sort(), [
    'ChatGPT:feature:image_gen',
    'Grok:grok:grok-4:DEFAULT',
  ]);
});

test('report keeps the MV3 message channel alive until notify_state is persisted', async () => {
  let releaseNotifyStateWrite;
  let notifyStateWriteStarted;
  const notifyStateWriteGate = new Promise((resolve) => {
    releaseNotifyStateWrite = resolve;
  });
  const notifyStateWriteStartedPromise = new Promise((resolve) => {
    notifyStateWriteStarted = resolve;
  });
  const { chrome, storage, listeners } = createChromeMock({
    beforeStorageSet: async (values) => {
      if (!Object.hasOwn(values, 'notify_state')) return;
      notifyStateWriteStarted();
      await notifyStateWriteGate;
    },
  });
  globalThis.chrome = chrome;
  globalThis.fetch = createBackgroundFetchMock([]);

  await importRepoModule('background.js');

  let resolveResponse;
  const responsePromise = new Promise((resolve) => {
    resolveResponse = resolve;
  });
  const keepsChannelAlive = listeners.onMessage(
    {
      type: 'report',
      results: {
        chatgpt: {
          ok: true,
          windows: [{ kind: 'feature:image_gen', label: 'Image', remaining: 0, resetsAt: '2026-07-20T05:00:00.000Z' }],
        },
      },
    },
    {},
    resolveResponse,
  );

  assert.equal(keepsChannelAlive, true);
  await notifyStateWriteStartedPromise;

  let responseSettled = false;
  responsePromise.then(() => {
    responseSettled = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(responseSettled, false);

  releaseNotifyStateWrite();
  assert.equal(await responsePromise, true);
  assert.ok(storage.notify_state['ChatGPT:feature:image_gen']);
});

test('Claude weekly scoped limits keep distinct notification identities and avoid false reset in one report', async () => {
  const { chrome, storage, notifications, listeners } = createChromeMock();
  globalThis.chrome = chrome;
  globalThis.fetch = createBackgroundFetchMock([]);

  await importRepoModule('background.js');
  await dispatchMessage(listeners.onMessage, {
    type: 'report',
    results: {
      claude: {
        ok: true,
        windows: [
          {
            kind: 'weekly_scoped',
            label: 'Weekly · Claude Opus 4',
            utilization: 81,
            severity: 'warning',
            resetsAt: '2026-07-21T00:00:00.000Z',
          },
          {
            kind: 'weekly_scoped',
            label: 'Weekly · Claude Sonnet 4',
            utilization: 35,
            severity: 'normal',
            resetsAt: '2026-07-21T00:00:00.000Z',
          },
        ],
      },
    },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(Object.keys(storage.notify_state || {}).sort(), [
    'Claude:weekly_scoped:Claude Opus 4',
    'Claude:weekly_scoped:Claude Sonnet 4',
  ]);
  assert.equal(notifications.some((entry) => entry.id.startsWith('reset-Claude:weekly_scoped')), false);
});

test('Korean UI localizes English-origin Agents notification labels before notifying', async () => {
  const { chrome, notifications, listeners } = createChromeMock({
    uiLanguage: 'ko-KR',
    messages: {
      notificationReached80Title: '$1 사용량 80% ⚠️',
      notificationReached80Message: '$1 사용량이 $2%입니다. 한도에 가까워지고 있어요.',
    },
  });
  globalThis.chrome = chrome;
  globalThis.fetch = createBackgroundFetchMock([]);

  await importRepoModule('background.js');
  await dispatchMessage(listeners.onMessage, {
    type: 'report',
    results: {
      chatgpt: {
        ok: true,
        windows: [
          {
            kind: 'wham:Agents:secondary_window',
            label: 'Agents (5시간)',
            utilization: 83,
            severity: 'warning',
            resetsAt: '2026-07-20T06:00:00.000Z',
          },
        ],
      },
    },
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].title, 'ChatGPT 사용량 80% ⚠️');
  assert.equal(notifications[0].message, '에이전트 (5시간) 사용량이 83%입니다. 한도에 가까워지고 있어요.');
});
