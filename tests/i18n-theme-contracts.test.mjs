import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const CONTENT_RUNTIME_FILES = [
  'content/overlay.js',
  'content/chatgpt.js',
  'content/grok.js',
  'content/gemini.js',
];
const SOURCE_FILES_WITH_MESSAGES = [
  'manifest.json',
  'popup/popup.html',
  'popup/popup.js',
  ...CONTENT_RUNTIME_FILES,
  'background.js',
];

function read(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function walk(relativeDir) {
  const absDir = path.join(ROOT, relativeDir);
  if (!existsSync(absDir)) return [];

  const out = [];
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const relPath = path.posix.join(relativeDir.replaceAll('\\', '/'), entry.name);
    const absPath = path.join(ROOT, relPath);
    if (entry.isDirectory()) {
      out.push(...walk(relPath));
      continue;
    }
    if (statSync(absPath).isFile()) out.push(relPath);
  }
  return out;
}

function parseLocale(locale) {
  return JSON.parse(read(`_locales/${locale}/messages.json`));
}

function getLocaleMessage(locale, key) {
  return parseLocale(locale)[key]?.message;
}

function collectReferencedMessageKeys() {
  const refs = new Set();
  const addMatches = (pattern, source) => {
    for (const match of source.matchAll(pattern)) refs.add(match[1]);
  };

  for (const relativePath of SOURCE_FILES_WITH_MESSAGES) {
    if (!existsSync(path.join(ROOT, relativePath))) continue;
    const source = read(relativePath);
    addMatches(/__MSG_([A-Za-z0-9_@-]+)__/g, source);
    addMatches(/getMessage\(\s*['"]([A-Za-z0-9_@-]+)['"]/g, source);
    addMatches(/__aumI18n(?:\.getMessage)?\(\s*['"]([A-Za-z0-9_@-]+)['"]/g, source);
    addMatches(/data-i18n(?:-[a-z]+)?=["']([A-Za-z0-9_@-]+)["']/g, source);
  }

  return [...refs].sort();
}

function findI18nHelperCandidates() {
  const candidates = [];
  for (const relativePath of ['background.js', 'popup/popup.js', ...walk('content'), ...walk('popup')]) {
    if (!relativePath.endsWith('.js')) continue;
    const source = read(relativePath);
    if (
      /chrome\.i18n\.(getMessage|getUILanguage)/.test(source) ||
      /__aumI18n/.test(source) ||
      /\bdefault_locale\b/.test(source)
    ) {
      candidates.push({ relativePath, source });
    }
  }
  return candidates;
}

function parsePopupScriptOrder() {
  const html = read('popup/popup.html');
  return [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map((match) => match[1]);
}

function loadI18nHelper(uiLanguage) {
  const documentElement = {};
  const sandbox = {
    chrome: {
      i18n: {
        getUILanguage() {
          return uiLanguage;
        },
        getMessage() {
          return '';
        },
      },
    },
    navigator: { language: uiLanguage },
    document: { documentElement },
    globalThis: {},
  };

  vm.runInNewContext(read('content/i18n.js'), sandbox);
  return { i18n: sandbox.globalThis.__aumI18n, documentElement };
}

test('manifest declares default locale and localizes user-facing extension metadata with __MSG placeholders', () => {
  const manifest = JSON.parse(read('manifest.json'));

  assert.equal(typeof manifest.default_locale, 'string');
  assert.ok(manifest.default_locale.length > 0);
  assert.match(manifest.name, /^__MSG_[A-Za-z0-9_@-]+__$/);
  assert.match(manifest.short_name, /^__MSG_[A-Za-z0-9_@-]+__$/);
  assert.match(manifest.description, /^__MSG_[A-Za-z0-9_@-]+__$/);
  assert.match(manifest.action?.default_title ?? '', /^__MSG_[A-Za-z0-9_@-]+__$/);
});

test('English and Korean locale catalogs exist and stay parity-complete for every referenced message key', () => {
  assert.ok(existsSync(path.join(ROOT, '_locales/en/messages.json')));
  assert.ok(existsSync(path.join(ROOT, '_locales/ko/messages.json')));

  const en = parseLocale('en');
  const ko = parseLocale('ko');
  const enKeys = Object.keys(en).sort();
  const koKeys = Object.keys(ko).sort();

  assert.deepEqual(koKeys, enKeys);

  for (const key of collectReferencedMessageKeys()) {
    assert.ok(en[key], `Missing English locale key: ${key}`);
    assert.ok(ko[key], `Missing Korean locale key: ${key}`);
  }
});

test('localized manifest catalog metadata stays within Chrome Web Store length limits', () => {
  const en = parseLocale('en');
  const ko = parseLocale('ko');

  for (const [locale, catalog] of [['en', en], ['ko', ko]]) {
    assert.ok((catalog.appName?.message ?? '').length <= 75, `${locale} appName exceeds 75 characters`);
    assert.ok((catalog.appShortName?.message ?? '').length <= 12, `${locale} appShortName exceeds 12 characters`);
    assert.ok((catalog.appDescription?.message ?? '').length <= 132, `${locale} appDescription exceeds 132 characters`);
  }
});

test('English manifest catalog title stays fixed to AI Usage Limit Alerts', () => {
  assert.equal(getLocaleMessage('en', 'appName'), 'AI Usage Limit Alerts');
});

test('Korean full reset credits message is fully localized', () => {
  assert.equal(getLocaleMessage('ko', 'fullResetCredits'), '전체 리셋권: $1회');
});

test('shared i18n helper contains an explicit Korean UI-locale selection path', () => {
  const candidates = findI18nHelperCandidates();
  assert.ok(candidates.length > 0, 'Expected a shared i18n helper or i18n-aware runtime source');

  const helperSource = candidates.map((candidate) => candidate.source).join('\n');
  assert.match(helperSource, /getUILanguage|getAcceptLanguages|navigator\.language/);
  assert.match(
    helperSource,
    /startsWith\(\s*['"]ko['"]\s*\)|slice\(\s*0\s*,\s*2\s*\)\s*===\s*['"]ko['"]|split\(\s*['"]-[^'"]*['"]\s*\)\s*\[\s*0\s*\]\s*===\s*['"]ko['"]/,
  );
});

test('shared i18n helper falls back to English for non-Korean UI locales', () => {
  const candidates = findI18nHelperCandidates();
  assert.ok(candidates.length > 0, 'Expected a shared i18n helper or i18n-aware runtime source');

  const helperSource = candidates.map((candidate) => candidate.source).join('\n');
  assert.match(helperSource, /['"]en['"]/);
  assert.match(helperSource, /return\s+['"]en['"]|:\s*['"]en['"]|=\s*['"]en['"]/);
});

test('Korean locale preserves known provider-returned Korean labels', () => {
  const { i18n } = loadI18nHelper('ko-KR');

  assert.equal(i18n.localizeLabel('세션 (5시간)'), '세션 (5시간)');
  assert.equal(i18n.localizeLabel('주간 · Claude Opus 4'), '주간 · Claude Opus 4');
  assert.equal(i18n.localizeLabel('작업 사용량 (주간)'), '작업 사용량 (주간)');
  assert.equal(i18n.localizeLabel('이미지 생성'), '이미지 생성');
  assert.equal(i18n.localizeLabel('주간 한도 (API 14% · 채팅 2%)'), '주간 한도 (API 14% · 채팅 2%)');
});

test('Korean locale translates known English-origin provider labels to Korean while preserving brand/model names', () => {
  const { i18n } = loadI18nHelper('ko-KR');

  assert.equal(i18n.localizeLabel('Agents (5시간)'), '에이전트 (5시간)');
  assert.equal(i18n.localizeLabel('Workspace Agents (주간)'), '워크스페이스 에이전트 (주간)');
  assert.equal(i18n.localizeLabel('Imagine'), '이미지');
  assert.equal(i18n.localizeLabel('Build'), '빌드');
  assert.equal(i18n.localizeLabel('ChatGPT'), 'ChatGPT');
  assert.equal(i18n.localizeLabel('GPT-5'), 'GPT-5');
});

test('non-Korean locale translates known provider-returned Korean labels to English', () => {
  const { i18n } = loadI18nHelper('en-US');

  assert.equal(i18n.localizeLabel('세션 (5시간)'), 'Session (5 hours)');
  assert.equal(i18n.localizeLabel('주간 · Claude Opus 4'), 'Weekly · Claude Opus 4');
  assert.equal(i18n.localizeLabel('작업 사용량 (주간)'), 'Work usage (Weekly)');
  assert.equal(i18n.localizeLabel('이미지 생성'), 'Image generation');
  assert.equal(i18n.localizeLabel('주간 한도 (API 14% · 채팅 2%)'), 'Weekly limit (API 14% · Chat 2%)');
});

test('popup and content runtimes load a shared i18n helper before localized UI scripts execute', () => {
  const manifest = JSON.parse(read('manifest.json'));
  const popupScripts = parsePopupScriptOrder();
  const helperCandidates = new Set(
    findI18nHelperCandidates()
      .map((candidate) => candidate.relativePath)
      .filter((relativePath) => relativePath !== 'popup/popup.js' && !CONTENT_RUNTIME_FILES.includes(relativePath)),
  );

  const popupHelper = popupScripts.find((src) => helperCandidates.has(src.replace('../', 'content/')));
  assert.ok(popupHelper, 'Expected popup.html to load a shared i18n helper script');
  assert.ok(popupScripts.indexOf(popupHelper) < popupScripts.indexOf('popup.js'));

  for (const entry of manifest.content_scripts) {
    const helperIndex = entry.js.findIndex((script) => helperCandidates.has(script));
    assert.ok(helperIndex >= 0, `Expected content script ${entry.matches.join(', ')} to load a shared i18n helper`);
    assert.ok(helperIndex < entry.js.length - 1, 'Expected i18n helper to load before provider-specific UI code');
  }
});

test('popup stylesheet supports automatic light and dark color schemes', () => {
  const css = read('popup/popup.css');

  assert.match(css, /:root\s*\{[\s\S]*--bg:/);
  assert.match(css, /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);
  assert.match(css, /color-scheme:\s*light\s+dark|color-scheme:\s*dark\s+light/);
});

test('service widget stylesheet supports automatic light and dark color schemes', () => {
  const css = read('content/overlay.css');

  assert.match(css, /\.aum-(composer-bar|sidebar-card)/);
  assert.match(css, /color-scheme:\s*light\s+dark|color-scheme:\s*dark\s+light|@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)/);
  assert.match(css, /var\(--text-|var\(--bg-|var\(--border-/);
});
