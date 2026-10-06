import test from 'node:test';
import assert from 'node:assert/strict';
import { scanCurrentTab, clearPopup } from '../src/popup/popup.js';

// A small DOM adapter checks the real popup/controller without dependencies.
class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return (this.text ?? '') + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
function documentFixture() {
  const elements = new Map(['domain', 'scheme', 'status', 'summary', 'findings', 'result',
    'permissions-context', 'permission-notes', 'site-permissions'].map(id => [id, new Element()]));
  return {
    getElementById: id => elements.get(id),
    createElement: tag => new Element(tag),
    createTextNode: text => { const node = new Element(); node.textContent = text; return node; }
  };
}

test('popup queries only the current active tab and renders expandable explanations', async () => {
  const document = documentFixture();
  let calls = 0;
  const chrome = { tabs: { query: async options => {
    calls++;
    assert.deepEqual(options, { active: true, currentWindow: true });
    return [{ url: 'https://bkash-login-example.com/login?token=do-not-display' }];
  } } };
  await scanCurrentTab(chrome, document);
  assert.equal(calls, 1);
  assert.equal(document.getElementById('domain').textContent, 'bkash-login-example.com');
  assert.equal(document.getElementById('scheme').textContent, 'Connection scheme: HTTPS');
  assert.equal(document.getElementById('status').textContent, 'Review');
  const findings = document.getElementById('findings');
  assert.ok(findings.children.length >= 2);
  for (const details of findings.children) {
    assert.equal(details.tag, 'details');
    assert.equal(details.children[0].tag, 'summary');
    assert.match(details.textContent, /Detected.*Why it matters.*Suggestion/);
    assert.doesNotMatch(details.textContent, /do-not-display/);
  }
  assert.equal(document.getElementById('result').attributes['aria-busy'], 'false');
});

test('popup handles unavailable tabs, restricted pages and API failure without raw errors', async () => {
  for (const query of [async () => [], async () => [{}], async () => [{ url: 'chrome://extensions' }], async () => { throw new Error('private-error-value'); }]) {
    const document = documentFixture();
    await scanCurrentTab({ tabs: { query } }, document);
    assert.equal(document.getElementById('domain').textContent, 'Address unavailable');
    assert.match(document.getElementById('summary').textContent, /No website assessment/);
    assert.doesNotMatch(document.getElementById('findings').textContent, /private-error-value/);
    assert.equal(document.getElementById('result').attributes['aria-busy'], 'false');
  }
});

test('a fresh popup scan replaces previous findings instead of accumulating a timeline', async () => {
  const document = documentFixture();
  for (const url of ['http://google-login-example.com', 'https://example.com']) {
    await scanCurrentTab({ tabs: { query: async () => [{ url }] } }, document);
  }
  assert.equal(document.getElementById('domain').textContent, 'example.com');
  assert.equal(document.getElementById('status').textContent, 'Normal');
  assert.equal(document.getElementById('findings').children.length, 1);
});

function settingsApi(states) {
  return Object.fromEntries(['camera', 'microphone', 'location', 'notifications', 'popups', 'automaticDownloads'].map(id =>
    [id, { get: (_details, callback) => callback({ setting: states[id] ?? 'block' }) }]));
}

test('popup shows six actual states, all explanations, and separate permission review notes', async () => {
  const document = documentFixture();
  await scanCurrentTab({ tabs: { query: async () => [{ url: 'https://example.com' }] },
    contentSettings: settingsApi({ camera: 'allow', microphone: 'allow', location: 'allow', notifications: 'ask' }) }, document);
  assert.equal(document.getElementById('status').textContent, 'Review');
  assert.equal(document.getElementById('findings').children.length, 1);
  assert.match(document.getElementById('permission-notes').textContent, /several sensitive permissions/);
  const rows = document.getElementById('site-permissions').children;
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map(row => row.children[0].textContent), [
    'CameraAllowed', 'MicrophoneAllowed', 'LocationAllowed', 'NotificationsAsk', 'Pop-upsBlocked', 'Automatic downloadsBlocked'
  ]);
  for (const row of rows) {
    assert.equal(row.tag, 'details');
    assert.match(row.textContent, /Browser setting.*What it allows.*Common legitimate uses.*Review when.*Suggestion/);
  }
});

test('permission updates replace prior state and review notes when popup is reopened', async () => {
  const document = documentFixture();
  const api = { tabs: { query: async () => [{ url: 'https://example.com' }] },
    contentSettings: settingsApi({ camera: 'allow', microphone: 'allow', location: 'allow' }) };
  await scanCurrentTab(api, document);
  api.contentSettings = settingsApi({});
  await scanCurrentTab(api, document);
  assert.equal(document.getElementById('status').textContent, 'Normal');
  assert.equal(document.getElementById('permission-notes').children.length, 0);
  assert.equal(document.getElementById('site-permissions').children.length, 6);
  assert.doesNotMatch(document.getElementById('site-permissions').textContent, /Allowed/);
});

test('closing clears permission findings and prevents late responses from repainting them', async () => {
  const document = documentFixture();
  const controller = new AbortController();
  let finishCamera;
  const api = { tabs: { query: async () => [{ url: 'https://example.com' }] }, contentSettings: settingsApi({}) };
  api.contentSettings.camera.get = (_details, callback) => { finishCamera = callback; };
  const pending = scanCurrentTab(api, document, { signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  clearPopup(document);
  finishCamera({ setting: 'allow' });
  await pending;
  for (const id of ['domain', 'status', 'permissions-context', 'findings', 'permission-notes', 'site-permissions']) {
    assert.equal(document.getElementById(id).textContent, '', id);
  }
});
