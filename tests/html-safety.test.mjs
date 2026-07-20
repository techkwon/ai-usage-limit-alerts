import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = process.cwd();
const UI_FILES = [
  'popup/popup.js',
  'content/overlay.js',
  'content/chatgpt.js',
  'content/gemini.js',
  'content/grok.js',
];

test('shared HTML escaper neutralizes provider-controlled markup', () => {
  const source = readFileSync(path.join(ROOT, 'content/escape-html.js'), 'utf8');
  const sandbox = { globalThis: {} };
  vm.runInNewContext(source, sandbox);

  assert.equal(
    sandbox.globalThis.__aumEscapeHtml(`<img src=x onerror="alert('x')">&`),
    '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;',
  );
});

test('provider-controlled labels are escaped at every HTML template sink', () => {
  for (const relativePath of UI_FILES) {
    const source = readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.match(source, /__aumEscapeHtml/);
    assert.doesNotMatch(source, /\$\{(?:w|promoted)\.label\}/);
  }
});

test('the shared escaper loads before popup and content UI scripts', () => {
  const manifest = JSON.parse(readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  for (const contentScript of manifest.content_scripts) {
    assert.equal(contentScript.js[0], 'content/escape-html.js');
  }

  const popupHtml = readFileSync(path.join(ROOT, 'popup/popup.html'), 'utf8');
  const helperIndex = popupHtml.indexOf('../content/escape-html.js');
  const popupIndex = popupHtml.indexOf('popup.js');
  assert.ok(helperIndex >= 0);
  assert.ok(helperIndex < popupIndex);
});
