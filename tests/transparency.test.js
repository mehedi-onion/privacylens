import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { statusCopy, normalCaveat, evidenceLabel, evidenceSources } from '../src/ui/status-copy.js';
import { initialPrivacyState, updateExternal, privacySummary, createPrivacyPresenter } from '../src/ui/privacy-summary.js';
import { permissionUses, dataBoundaries, limitations } from '../src/transparency/transparency-data.js';
import { renderTransparency } from '../src/transparency/transparency.js';
import { createReputationController } from '../src/reputation/reputation-controller.js';
import { registerReputationWorker } from '../src/reputation/reputation-worker.js';
import { normalizeReport } from '../src/reputation/reputation-advisor.js';
import { VT_ORIGIN } from '../src/reputation/domain-rules.js';

const root = new URL('../', import.meta.url);
const read = name => readFile(new URL(name, root), 'utf8');
const sampleKey = 'synthetic-test-value-not-real';
const tab = { id: 7, incognito: false, url: 'https://google.com/private?private-query#private-fragment' };
const report = normalizeReport({ data: { type: 'domain', id: 'google.com', attributes: { last_analysis_stats:
  { malicious: 0, suspicious: 1, harmless: 72, undetected: 15 } } } }, 'google.com');

for (const [label, wording] of [
  ['Normal', 'Nothing here needs your attention right now.'],
  ['Review', 'Something here is worth checking before you share sensitive information or allow access.'],
  ['High Attention', 'Several strong warning signs need a closer look.']
]) test(`${label} has the intended plain-language summary`, () => assert.equal(statusCopy[label], wording));
test('status copy avoids safety verdicts and immediately qualifies Normal', () => {
  assert.doesNotMatch(Object.values(statusCopy).join(' '), /\b(?:safe|unsafe|malware|spyware|guaranteed|phishing confirmed)\b/i);
  assert.equal(normalCaveat, 'These checks cannot prove a site is safe.');
});
test('evidence states distinguish unchecked/unavailable from no review and include words, not only color', () => {
  assert.equal(evidenceLabel({ checked: false }), '— Not checked');
  assert.equal(evidenceLabel({ available: false }), '— Unavailable');
  assert.equal(evidenceLabel({ pending: true }), '— Checking…');
  for (const [status, text] of [['Normal', 'No review signal'], ['Review', 'Review suggested'], ['High Attention', 'High Attention']]) {
    assert.ok(evidenceLabel({ available: true, status }).includes(text));
  }
});
test('local and user-requested external sources have explicit textual labels', () => {
  assert.deepEqual(evidenceSources, { local: 'LOCAL', external: 'EXTERNAL · USER REQUESTED' });
});
test('initial privacy summary never falsely says VirusTotal was used or that page structure was scanned', () => {
  const model = privacySummary(initialPrivacyState());
  assert.match(model.external, /None.*No external lookup/);
  assert.ok(model.local.includes('Page structure: — Not checked'));
  assert.doesNotMatch(model.external, /hostname shared/);
});
test('local API reads and unavailable evidence do not become external sharing', () => {
  const state = initialPrivacyState();
  for (const id of Object.keys(state.local)) state.local[id] = { available: id !== 'navigation', status: 'Review' };
  assert.match(privacySummary(state).external, /None/);
  assert.ok(privacySummary(state).local.includes('Navigation: — Unavailable'));
});
test('successful lookup discloses hostname and key transmission', () => {
  const state = initialPrivacyState(); updateExternal(state, { phase: 'complete', transmission: 'shared' });
  assert.match(privacySummary(state).external, /hostname shared after confirmation.*API key was sent/);
});
test('pending and failed network checks never claim nothing left the browser', () => {
  const state = initialPrivacyState(); updateExternal(state, { phase: 'pending' });
  assert.match(privacySummary(state).external, /may have been shared/);
  updateExternal(state, { phase: 'complete', transmission: 'possible' });
  assert.match(privacySummary(state).external, /may have been shared/);
});
test('locally rejected lookup clears pending uncertainty without claiming transmission', () => {
  const state = initialPrivacyState(); updateExternal(state, { phase: 'pending' });
  updateExternal(state, { phase: 'complete', transmission: 'none' });
  assert.match(privacySummary(state).external, /None/);
});
test('clearing a report or cancelling a later disclosure cannot erase previous sharing', () => {
  const state = initialPrivacyState(); updateExternal(state, { phase: 'complete', transmission: 'shared' });
  for (const event of [{ phase: 'cancel' }, { phase: 'pending' }, { phase: 'complete', transmission: 'none' }]) updateExternal(state, event);
  assert.match(privacySummary(state).external, /hostname shared/);
});
test('cancelling an in-flight lookup preserves uncertainty', () => {
  const state = initialPrivacyState(); updateExternal(state, { phase: 'pending' }); updateExternal(state, { phase: 'cancel' });
  assert.equal(state.external, 'possible'); assert.equal(state.pending, false);
});
for (const [mode, wording] of [['none', 'No VirusTotal key'], ['session', 'browser-session memory only'],
  ['remembered', 'remembered locally'], ['unknown', 'unavailable or not yet checked']]) {
  test(`privacy summary describes ${mode} key storage without a raw key`, () => {
    const state = initialPrivacyState(); updateExternal(state, { keyMode: mode });
    const model = privacySummary(state); assert.match(model.stored.join(' '), new RegExp(wording));
    assert.match(model.stored.join(' '), /No browsing history saved.*No scan result saved.*Anonymous request counters/);
    assert.doesNotMatch(JSON.stringify(model), new RegExp(sampleKey));
  });
}
test('unknown key metadata fails to an honest unavailable state', () => {
  const state = initialPrivacyState(); updateExternal(state, { keyMode: sampleKey });
  assert.equal(state.keyMode, 'unknown'); assert.doesNotMatch(JSON.stringify(privacySummary(state)), new RegExp(sampleKey));
});

class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.hidden = true; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text ?? '') + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(key, value) { this.attributes[key] = value; }
}
function documentFixture() {
  const elements = new Map(['privacy-overview', 'privacy-external', 'privacy-local', 'privacy-stored', 'permission-uses',
    'boundary-rows', 'limitation-list', 'vt-result', 'vt-consent', 'vt-hostname', 'vt-check', 'vt-confirm', 'reputation-state'].map(id => [id, new Element()]));
  return { getElementById: id => elements.get(id), createElement: tag => new Element(tag),
    createTextNode: text => { const element = new Element(); element.textContent = text; return element; } };
}
test('privacy presenter renders local check state and clears all data on closing', () => {
  const document = documentFixture(); const presenter = createPrivacyPresenter(document);
  presenter.local('page', { available: true, status: 'Review' });
  assert.match(document.getElementById('privacy-local').textContent, /Page structure: ⚠ Review suggested/);
  presenter.external({ phase: 'complete', transmission: 'shared', keyMode: 'remembered' });
  assert.match(document.getElementById('privacy-stored').textContent, /remembered locally/);
  presenter.clear();
  for (const id of ['privacy-overview', 'privacy-external', 'privacy-local', 'privacy-stored']) assert.equal(document.getElementById(id).textContent, '');
});
test('transparency catalog lists every required and optional manifest permission exactly once', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  assert.deepEqual(permissionUses.filter(entry => !entry.optional).map(entry => entry.permission).sort(), [...manifest.permissions].sort());
  assert.deepEqual(permissionUses.filter(entry => entry.optional).map(entry => entry.permission), manifest.optional_host_permissions);
  assert.equal(new Set(permissionUses.map(entry => entry.permission)).size, permissionUses.length);
  for (const item of permissionUses) for (const field of ['title', 'why', 'uses', 'doesNot', 'boundary']) assert.ok(item[field].length > 10);
});
test('manifest adds no privileges or new host permission', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  assert.deepEqual(manifest.permissions, ['activeTab', 'contentSettings', 'management', 'scripting', 'downloads', 'webNavigation', 'storage']);
  assert.deepEqual(manifest.optional_host_permissions, [VT_ORIGIN]); assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.minimum_chrome_version, '102');
});
test('broader Chrome capabilities are acknowledged instead of inventing a technical read-only grant', () => {
  for (const name of ['contentSettings', 'management', 'scripting', 'downloads', 'webNavigation', 'storage', VT_ORIGIN]) {
    const item = permissionUses.find(entry => entry.permission === name); assert.ok(item.boundary.length > 40); assert.ok(item.doesNot.length > 40);
  }
});
test('data table keeps six local features local and unpersisted', () => {
  assert.equal(dataBoundaries.length, 9);
  for (const row of dataBoundaries.slice(0, 6)) assert.deepEqual([row.local, row.external, row.persisted], ['Yes', 'No', 'No']);
});
test('data table accurately distinguishes external lookup, API-key authentication and quota memory', () => {
  const lookup = dataBoundaries.find(row => row.feature === 'VirusTotal lookup');
  assert.equal(lookup.local, 'Partly'); assert.match(lookup.external, /Hostname, after confirmation.*IP address/); assert.equal(lookup.persisted, 'Result: No');
  const key = dataBoundaries.find(row => row.feature === 'VirusTotal API key'); assert.match(key.external, /authentication/);
  assert.match(key.persisted, /Session only by default; local only if Remember/);
  assert.match(dataBoundaries.at(-1).persisted, /four numbers, no hostname or report/);
});
test('transparency renderer uses native details, scoped row headers and text-only metadata', () => {
  const document = documentFixture(); renderTransparency(document);
  const rows = document.getElementById('permission-uses').children; assert.equal(rows.length, 8);
  for (const details of rows) { assert.equal(details.tag, 'details'); assert.equal(details.children[0].tag, 'summary'); assert.match(details.textContent, /Why.*What PrivacyLens does.*What it does not do.*What Chrome also allows/); }
  for (const row of document.getElementById('boundary-rows').children) { assert.equal(row.children[0].tag, 'th'); assert.equal(row.children[0].attributes.scope, 'row'); }
  assert.equal(document.getElementById('limitation-list').children.length, 7);
});
test('limitations address intent, behavior, downloads, external evidence and incomplete APIs', () => {
  for (const word of ['honesty', 'misuse', 'capabilities', 'file', 'VirusTotal', 'redirect', 'APIs']) assert.ok(limitations.some(text => text.includes(word)), word);
});
test('popup evidence order, accessible labels, status text and keyboard disclosures are present', async () => {
  const html = await read('src/popup/popup.html'); const ids = ['address-section', 'permissions-section', 'page-section', 'navigation-section', 'download-section', 'reputation-section'];
  for (let i = 1; i < ids.length; i++) assert.ok(html.indexOf(`id="${ids[i - 1]}"`) < html.indexOf(`id="${ids[i]}"`));
  assert.equal((html.match(/class="evidence-section"/g) ?? []).length, 6);
  for (const id of ids) assert.match(html, new RegExp(`<details class="evidence-section" id="${id}">\\s*<summary><h2>`));
  assert.match(html, /aria-describedby="summary overview-scope"/); assert.match(html, /id="status"[^>]*role="status"/);
  assert.match(html, /aria-label="PrivacyLens tools"/); assert.match(html, /id="privacy-summary"/);
  assert.equal((html.match(/class="source-label">LOCAL/g) ?? []).length, 5); assert.match(html, /EXTERNAL · USER REQUESTED/);
});
test('transparency has headings, navigable table caption, keyboard focus and no fake self-score', async () => {
  const html = await read('src/transparency/transparency.html');
  assert.match(html, /<h1>PrivacyLens transparency/); assert.match(html, /<caption>PrivacyLens feature data boundaries/);
  assert.match(html, /aria-label="Feature data boundaries" tabindex="0"/); assert.match(html, /scope="col"/);
  assert.match(html, /Audit PrivacyLens/); assert.match(html, /rather than giving itself a trust score/); assert.match(html, /chrome:\/\/extensions/);
  for (const file of ['src/popup/popup.css', 'src/extensions/extensions.css', 'src/options/options.css', 'src/transparency/transparency.css']) assert.match(await read(file), /:focus-visible/);
});
function workerFixture(kind = 'report') {
  let handler; let calls = 0; const areas = { local: {}, session: {} };
  const api = { storage: Object.fromEntries(['local', 'session'].map(name => [name, {
    setAccessLevel: async () => {}, get: async key => ({ [key]: areas[name][key] }),
    set: async value => Object.assign(areas[name], value), remove: async key => { delete areas[name][key]; }
  }])), runtime: { id: 'self', getURL: path => `chrome-extension://self/${path}`, onMessage: { addListener: value => { handler = value; } } },
    tabs: { query: async () => [tab] }, permissions: { contains: async () => true } };
  const store = registerReputationWorker(api, { lookup: async () => { calls++; return { kind, ...(kind === 'report' ? { report } : {}), retryAfterMs: 60000 }; } });
  const message = value => new Promise(resolve => handler(value, { id: 'self', url: api.runtime.getURL('src/popup/popup.html') }, resolve));
  return { api, areas, store, message, calls: () => calls };
}
const lookup = () => ({ type: 'privacyLens:vt-lookup', confirmed: true, hostname: 'google.com', tabId: 7, requestId: 'test' });
for (const kind of ['report', 'invalid-key', 'restricted', 'not-found', 'rate-limit', 'server-error', 'invalid-response']) {
  test(`${kind} response still reports external transmission even when no usable report exists`, async () => {
    const fixture = workerFixture(kind); await fixture.store.save(sampleKey, false);
    const result = await fixture.message(lookup()); assert.equal(result.transmission, 'shared'); assert.equal(fixture.calls(), 1);
    assert.doesNotMatch(JSON.stringify(fixture.areas), /google|report|transmission/);
  });
}
test('network failure has possible transmission, and local throttle has no new transmission', async () => {
  const fixture = workerFixture('network-error'); await fixture.store.save(sampleKey, false);
  assert.equal((await fixture.message(lookup())).transmission, 'possible');
  const second = await fixture.message(lookup()); assert.equal(second.kind, 'rate-limit'); assert.equal(second.transmission, undefined); assert.equal(fixture.calls(), 1);
});
test('UI records external disclosure before discarding a report for a changed tab', async () => {
  const document = documentFixture(); const events = []; let changed = false;
  const api = { permissions: { request: async () => true }, tabs: { query: async () => [{ ...tab, ...(changed ? { id: 8 } : {}) }] },
    runtime: { sendMessage: (message, callback) => { if (message.type.endsWith('status')) callback({ kind: 'key-status', configured: true, mode: 'session' });
      else { changed = true; callback({ kind: 'report', report, transmission: 'shared' }); } } } };
  const controller = createReputationController(api, document, { onPrivacy: event => events.push(event) });
  await controller.begin(); await controller.confirm(); assert.ok(events.some(event => event.transmission === 'shared'));
  assert.match(document.getElementById('vt-result').textContent, /hostname changed/);
});
test('UI failure records uncertainty without exposing a key or declaring a successful lookup', async () => {
  const document = documentFixture(); const state = initialPrivacyState();
  const api = { permissions: { request: async () => true }, tabs: { query: async () => [tab] }, runtime: {
    sendMessage: (message, callback) => callback(message.type.endsWith('status') ? { kind: 'key-status', configured: true, mode: 'session' }
      : { kind: 'network-error', transmission: 'possible', error: sampleKey }) } };
  const controller = createReputationController(api, document, { onPrivacy: event => updateExternal(state, event) });
  await controller.begin(); await controller.confirm(); assert.match(privacySummary(state).external, /may have been shared/);
  assert.equal(document.getElementById('reputation-state').textContent, '— Unavailable');
  assert.doesNotMatch(document.getElementById('vt-result').textContent, new RegExp(sampleKey));
});
test('new presentation modules introduce no storage, history, telemetry or network adapter', async () => {
  for (const directory of ['src/ui/', 'src/transparency/']) for (const name of await readdir(new URL(directory, root))) {
    if (!name.endsWith('.js')) continue;
    assert.doesNotMatch(await read(directory + name), /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|indexedDB|analytics|telemetry)\b|\b(?:chrome|chromeApi)\.(?:storage|history|tabs|cookies)|console\./);
  }
  const client = await read('src/reputation/virustotal-client.js');
  assert.match(client, /https:\/\/www\.virustotal\.com\/api\/v3\/domains\//);
  assert.equal((client.match(/globalThis\.fetch/g) ?? []).length, 1); assert.match(client, /method: 'GET'/);
});

test('reading text and keyboard focus have adequate contrast in light and dark themes', async () => {
  const luminance = hex => {
    const channels = hex.match(/[a-f0-9]{2}/gi).map(channel => parseInt(channel, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
  for (const [foreground, background] of [['#57665e', '#fafbf9'], ['#bdcbbf', '#202722']]) {
    assert.ok(contrast(foreground, background) >= 4.5);
  }
  assert.ok(contrast('#466e58', '#fafbf9') >= 3);
  assert.ok(contrast('#b3d1bb', '#202722') >= 3);
  for (const area of ['popup', 'extensions', 'options', 'transparency']) {
    assert.match(await read(`src/${area}/${area}.css`), /:focus-visible\s*\{ outline-color: #b3d1bb;/);
  }
});
