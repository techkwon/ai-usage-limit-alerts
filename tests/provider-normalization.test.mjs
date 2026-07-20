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

function createChromeMock(initialStorage = {}) {
  const storage = structuredClone(initialStorage);
  return {
    storage,
    chrome: {
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
            Object.assign(storage, structuredClone(values));
          },
          async remove(keys) {
            for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
          },
        },
      },
    },
  };
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

function grpcResponse(bytes) {
  return new Response(bytes, {
    status: 200,
    headers: { 'content-type': 'application/grpc-web+proto' },
  });
}

function encodeVarint(value) {
  const out = [];
  let current = value >>> 0;
  while (current >= 0x80) {
    out.push((current & 0x7f) | 0x80);
    current >>>= 7;
  }
  out.push(current);
  return out;
}

function encodeKey(field, wireType) {
  return encodeVarint((field << 3) | wireType);
}

function encodeFloatField(field, value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, true);
  return [...encodeKey(field, 5), ...bytes];
}

function encodeVarintField(field, value) {
  return [...encodeKey(field, 0), ...encodeVarint(value)];
}

function encodeMessageField(field, bytes) {
  return [...encodeKey(field, 2), ...encodeVarint(bytes.length), ...bytes];
}

function buildGrpcEnvelope(messageBytes) {
  const envelope = new Uint8Array(5 + messageBytes.length);
  envelope[0] = 0;
  new DataView(envelope.buffer).setUint32(1, messageBytes.length, false);
  envelope.set(messageBytes, 5);
  return envelope;
}

function buildGrokCreditsConfig() {
  const reset = encodeMessageField(5, encodeVarintField(1, 1_752_971_200));
  const apiPart = encodeMessageField(7, [
    ...encodeVarintField(1, 1),
    ...encodeFloatField(2, 14),
  ]);
  const chatPart = encodeMessageField(7, [
    ...encodeVarintField(1, 4),
    ...encodeFloatField(2, 2),
  ]);
  const box = [
    ...encodeFloatField(1, 16),
    ...reset,
    ...apiPart,
    ...chatPart,
  ];
  return buildGrpcEnvelope(encodeMessageField(1, box));
}

test('Claude provider normalizes limits and preserves model-scoped weekly windows', async () => {
  const { chrome } = createChromeMock();
  globalThis.chrome = chrome;
  globalThis.fetch = async (url) => {
    if (url === 'https://claude.ai/api/organizations') {
      return jsonResponse([{ uuid: 'org-1', name: 'Personal', rate_limit_tier: 'claude_pro' }]);
    }
    if (url === 'https://claude.ai/api/organizations/org-1/usage') {
      return jsonResponse({
        limits: [
          { kind: 'session', group: 'session', percent: 61.2, severity: 'warning', resets_at: '2026-07-20T01:00:00.000Z', is_active: true },
          {
            kind: 'weekly_scoped',
            group: 'weekly',
            percent: 14.4,
            severity: 'normal',
            resets_at: '2026-07-21T00:00:00.000Z',
            is_active: true,
            scope: { model: { display_name: 'Claude Opus 4' } },
          },
        ],
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { fetchUsage } = await importRepoModule('providers/claude.js');
  const result = await fetchUsage();

  assert.equal(result.ok, true);
  assert.equal(result.provider, 'claude');
  assert.deepEqual(
    result.windows.map((window) => ({
      kind: window.kind,
      utilization: window.utilization,
      severity: window.severity,
      label: window.label,
    })),
    [
      { kind: 'session', utilization: 61, severity: 'warning', label: '세션 (5시간)' },
      { kind: 'weekly_scoped', utilization: 14, severity: 'normal', label: '주간 · Claude Opus 4' },
    ],
  );
});

test('ChatGPT provider normalizes feature, model, and wham windows', async () => {
  globalThis.chrome = {
    storage: { local: { async get() { return {}; }, async set() {}, async remove() {} } },
  };
  globalThis.fetch = async (url) => {
    if (url === 'https://chatgpt.com/api/auth/session') {
      return jsonResponse({ accessToken: 'token-1' });
    }
    if (url === 'https://chatgpt.com/backend-api/conversation/init') {
      return jsonResponse({
        limits_progress: [
          { feature_name: 'image_gen', remaining: 3, reset_after: '2026-07-20T05:00:00.000Z' },
        ],
        model_limits: [
          { model_slug: 'gpt-5', display_name: 'GPT-5', remaining_messages: 12, percent: 47, resets_at: '2026-07-20T03:00:00.000Z' },
        ],
      });
    }
    if (url === 'https://chatgpt.com/backend-api/wham/usage') {
      return jsonResponse({
        rate_limit: {
          primary_window: { used_percent: 82, limit_window_seconds: 604800, reset_at: 1_752_883_200 },
          limit_reached: false,
        },
        additional_rate_limits: [
          {
            limit_name: 'Agents',
            rate_limit: {
              secondary_window: { used_percent: 33, limit_window_seconds: 18000, reset_at: 1_752_814_800 },
              limit_reached: false,
            },
          },
        ],
        rate_limit_reset_credits: { available_count: 2 },
      });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { fetchUsage } = await importRepoModule('providers/chatgpt.js');
  const result = await fetchUsage();

  assert.equal(result.ok, true);
  assert.equal(result.unlimited, false);
  assert.equal(result.fullResets, 2);
  assert.deepEqual(
    result.windows.map((window) => ({
      kind: window.kind,
      label: window.label,
      utilization: window.utilization,
      remaining: window.remaining,
    })),
    [
      { kind: 'wham:작업 사용량:primary_window', label: '작업 사용량 (주간)', utilization: 82, remaining: undefined },
      { kind: 'wham:Agents:secondary_window', label: 'Agents (5시간)', utilization: 33, remaining: undefined },
      { kind: 'feature:image_gen', label: '이미지 생성', utilization: undefined, remaining: 3 },
      { kind: 'model:gpt-5', label: 'GPT-5', utilization: 47, remaining: 12 },
    ],
  );
});

test('Gemini provider parses usage RPC into session and weekly windows', async () => {
  const { chrome } = createChromeMock();
  globalThis.chrome = chrome;
  globalThis.fetch = async (url) => {
    if (url === 'https://gemini.google.com/app') {
      return textResponse('<html>"SNlM0e":"token-xyz"</html>', { headers: { 'content-type': 'text/html' } });
    }
    if (String(url).startsWith('https://gemini.google.com/_/BardChatUi/data/batchexecute')) {
      const payload = JSON.stringify([[null, null, JSON.stringify([null, [
        [9, 0.25, 1, [[1_752_814_800]]],
        [4, 0.7, 2, [[1_752_883_200]]],
      ]])]]);
      return textResponse(`)]}'\n${payload}`);
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { fetchUsage } = await importRepoModule('providers/gemini.js');
  const result = await fetchUsage();

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.windows.map((window) => ({
      kind: window.kind,
      utilization: window.utilization,
      remaining: window.remaining,
    })),
    [
      { kind: 'gemini:1', utilization: 25, remaining: 9 },
      { kind: 'gemini:2', utilization: 70, remaining: 4 },
    ],
  );
});

test('Grok provider normalizes weekly protobuf pool and model limits', async () => {
  globalThis.fetch = async (url) => {
    if (url === 'https://grok.com/grok_api_v2.GrokBuildBilling/GetGrokCreditsConfig') {
      return grpcResponse(buildGrokCreditsConfig());
    }
    if (url === 'https://grok.com/rest/rate-limits') {
      return jsonResponse({ windowSizeSeconds: 14400, remainingQueries: 2, totalQueries: 10 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { fetchUsage } = await importRepoModule('providers/grok.js');
  const result = await fetchUsage();

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.windows.map((window) => ({
      kind: window.kind,
      label: window.label,
      utilization: window.utilization,
      remaining: window.remaining,
    })),
    [
      { kind: 'grok:weekly_pool', label: '주간 한도 (API 14% · 채팅 2%)', utilization: 16, remaining: undefined },
      { kind: 'grok:grok-4:DEFAULT', label: 'Grok 4 (4시간)', utilization: 80, remaining: 2 },
      { kind: 'grok:grok-3:DEFAULT', label: 'Grok 3 (4시간)', utilization: 80, remaining: 2 },
    ],
  );
});
