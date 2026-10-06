import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { explainDanger, documentedDangerValues, enterpriseDangerValues } from '../src/downloads/danger-definitions.js';
import { describeFilename } from '../src/downloads/filename-rules.js';
import { normalizeDownload, explainDownload } from '../src/downloads/download-analyzer.js';
import { createDownloadObserver, DOWNLOAD_LIFETIME_MS } from '../src/downloads/download-observer.js';
import { registerDownloadWorker } from '../src/background/service-worker.js';
import { readRecentDownload, createDownloadController } from '../src/downloads/download-controller.js';
import { renderDownloadCheck, clearDownloadCheck } from '../src/downloads/download-view.js';

const item = (overrides = {}) => ({ id: 1, incognito: false, filename: '/private/downloads/report.pdf',
  url: 'https://example.com/report', finalUrl: 'https://example.com/report', danger: 'safe', state: 'complete',
  mime: 'application/pdf', fileSize: 128, paused: false, ...overrides });
const check = overrides => explainDownload(normalizeDownload(item(overrides)));
const has = (result, id) => result.findings.some(finding => finding.id === id);

test('safe HTTPS PDF stays Normal and explains that Chrome safety is not a guarantee', () => {
  const result = check();
  assert.equal(result.status, 'Normal');
  assert.equal(result.filename, 'report.pdf');
  assert.match(result.findings[0].why, /not a guarantee/);
});
test('normal zip, rar, 7z and iso archives are informational, not automatically risky', () => {
  for (const extension of ['zip', 'rar', '7z', 'iso']) {
    const result = check({ filename: `archive.${extension}` });
    assert.equal(result.status, 'Normal');
    assert.ok(has(result, 'archive'));
  }
});
test('expected installer and script types never become High Attention by extension alone', () => {
  for (const extension of ['exe', 'msi', 'bat', 'cmd', 'scr', 'ps1', 'js', 'jar', 'apk', 'dmg', 'pkg']) {
    const result = check({ filename: `Expected-installer.${extension}` });
    assert.equal(result.status, 'Review');
    assert.ok(has(result, 'executable'));
    assert.match(result.findings.find(finding => finding.id === 'executable').why, /Legitimate installers/);
  }
});
test('uncommon executable remains Review without a behavior claim', () => {
  const result = check({ danger: 'uncommon', filename: 'installer.exe' });
  assert.equal(result.status, 'Review');
  assert.match(result.findings[0].why, /does not necessarily mean malicious/);
});
test('documented file/url/content/host/unwanted danger values describe browser warnings', () => {
  for (const danger of ['file', 'url', 'content', 'host', 'unwanted']) {
    const result = check({ danger });
    assert.equal(result.status, 'Review');
    assert.equal(result.findings[0].detected, danger);
    assert.equal(explainDanger(danger).strong, true);
  }
  assert.match(explainDanger('url').explanation, /source URL/);
  assert.match(explainDanger('content').explanation, /not read or scanned/);
});
test('dangerous_url, dangerous_content and generic dangerous are unsupported spellings handled safely', () => {
  for (const danger of ['dangerous_url', 'dangerous_content', 'dangerous']) {
    const result = check({ danger });
    assert.equal(result.status, 'Review');
    assert.match(result.findings[0].title, /Unrecognized/);
    assert.equal(explainDanger(danger).strong, false);
  }
});
test('unknown or malformed danger values are not interpreted or echoed unsafely', () => {
  for (const danger of ['futureValue', 'constructor', 'PRIVATE_INPUT_SENTINEL<script>', {}, null]) {
    const result = check({ danger });
    assert.equal(result.status, 'Review');
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_INPUT_SENTINEL|<script>/);
  }
});
test('all current documented enterprise values use cautious policy/workflow explanations', () => {
  assert.equal(documentedDangerValues.length, 24);
  assert.equal(new Set(documentedDangerValues).size, documentedDangerValues.length);
  for (const danger of enterpriseDangerValues) {
    const definition = explainDanger(danger);
    assert.equal(definition.code, danger);
    assert.match(definition.explanation, /depends on browser version/);
    assert.equal(check({ danger, filename: 'installer.exe' }).status, 'Review');
  }
});
test('accepted warning is not reinterpreted as safe or independent evidence of misuse', () => {
  const result = check({ danger: 'accepted' });
  assert.equal(result.status, 'Review');
  assert.match(result.findings[0].why, /Acceptance does not establish safety/);
});
test('document/image double extensions get Review while ordinary multi-dot names do not', () => {
  for (const filename of ['invoice.pdf.exe', 'photo.jpg.scr', 'invoice.PDF.EXE']) assert.ok(has(check({ filename }), 'double-extension'));
  assert.equal(describeFilename('release.1.2.exe').doubleExtension, false);
  assert.equal(describeFilename('archive.tar.gz').doubleExtension, false);
});
test('at least five spaces before an extension are an explainable naming signal', () => {
  assert.equal(describeFilename('report    .pdf').spacing, false);
  const result = check({ filename: 'report     .pdf' });
  assert.equal(result.status, 'Review');
  assert.ok(has(result, 'filename-spacing'));
});
test('directional controls are visibly escaped while ordinary Unicode filenames remain Normal', () => {
  const result = check({ filename: 'photo\u202egpj.exe' });
  assert.ok(has(result, 'filename-direction'));
  assert.match(result.filename, /\\u202e/);
  assert.doesNotMatch(result.filename, /\u202e/);
  assert.equal(check({ filename: 'বাংলা-রিপোর্ট.pdf' }).status, 'Normal');
});
test('public HTTP source receives Review but local HTTP remains contextual', () => {
  assert.equal(check({ url: 'http://example.com/file', finalUrl: 'http://example.com/file' }).status, 'Review');
  assert.equal(check({ url: 'http://127.0.0.1/file', finalUrl: 'http://127.0.0.1/file' }).status, 'Normal');
});
test('different final hostname is explained without pretending to follow redirects', () => {
  const result = check({ finalUrl: 'https://cdn.example.net/file' });
  assert.equal(result.status, 'Normal');
  assert.ok(has(result, 'source-change'));
  assert.match(result.findings.find(finding => finding.id === 'source-change').why, /CDNs/);
});
test('HTTPS source ending at HTTP receives a source Review explanation', () => {
  const result = check({ finalUrl: 'http://example.com/file' });
  assert.equal(result.status, 'Review');
  assert.ok(has(result, 'source-http'));
});
test('download source IP/punycode/shortener/brand signals reuse local URL rules', () => {
  for (const [url, id] of [['https://192.0.2.1/file', 'ip-address'], ['https://xn--bcher-kva.example/file', 'punycode'],
    ['https://bit.ly/file', 'shortener'], ['https://paypal-login-example.com/file', 'brand-mismatch']]) {
    assert.ok(has(check({ url, finalUrl: url }), `source-${id}`));
  }
});
test('High Attention requires a strong browser warning plus another filename/source signal', () => {
  assert.equal(check({ danger: 'content', filename: 'installer.exe' }).status, 'High Attention');
  assert.equal(check({ danger: 'url', url: 'http://example.com/file' }).status, 'High Attention');
  assert.equal(check({ danger: 'content' }).status, 'Review');
  assert.equal(check({ filename: 'invoice.pdf.exe' }).status, 'Review');
  assert.ok(has(check({ danger: 'file', filename: 'invoice.pdf.exe' }), 'download-combination'));
});
test('missing, empty or excessive filename fails safely without inventing a type', () => {
  for (const filename of [undefined, '', {}, 'x'.repeat(1100)]) {
    const result = check({ filename, danger: 'url' });
    assert.equal(result.filename, 'Filename unavailable');
    assert.equal(result.status, 'Review');
    assert.ok(has(result, 'filename-unavailable'));
  }
});
test('malformed, missing and browser-generated source URLs are unavailable without echoing them', () => {
  for (const url of ['PRIVATE_INPUT_SENTINEL', undefined, 'javascript:PRIVATE_INPUT_SENTINEL', 'blob:https://example.com/PRIVATE_INPUT_SENTINEL']) {
    const result = check({ url, finalUrl: url });
    assert.ok(has(result, 'source-unavailable'));
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_INPUT_SENTINEL/);
  }
});
test('normalization strips local paths, credentials, URL paths/query/fragments and ignores hashes/timestamps/referrer', () => {
  const raw = item({ filename: 'C:\\Users\\PRIVATE_INPUT_SENTINEL\\report.pdf',
    url: 'https://user:private-test-value@example.com/PRIVATE_INPUT_SENTINEL?private-query#private-fragment' });
  for (const field of ['startTime', 'endTime', 'estimatedEndTime', 'referrer', 'hash', 'bytesReceived', 'exists', 'contents']) {
    Object.defineProperty(raw, field, { get: () => assert.fail(`No ${field} access`) });
  }
  const normalized = normalizeDownload(raw);
  assert.doesNotMatch(JSON.stringify(normalized), /PRIVATE_INPUT_SENTINEL|private-test-value|private-query|private-fragment|Users/);
  assert.equal(normalized.filename.display, 'report.pdf');
  assert.equal(normalized.source.origin, 'https://example.com');
  assert.equal(explainDownload(normalized).id, undefined);
});
test('state, paused, MIME and size normalize reported metadata without file inspection', () => {
  const result = check({ state: 'interrupted', paused: true, mime: 'APPLICATION/PDF; charset=binary', fileSize: -1 });
  assert.equal(result.state, 'Interrupted');
  assert.equal(result.paused, 'Yes');
  assert.equal(result.mime, 'application/pdf');
  assert.equal(result.fileSize, null);
  const unknown = check({ state: 'future', paused: 'no', mime: '<script>', fileSize: Infinity });
  assert.equal(unknown.state, 'Unavailable');
  assert.equal(unknown.paused, 'Unavailable');
  assert.equal(unknown.mime, 'Unavailable');
});
test('reported MIME is descriptive; it does not prove actual file contents', () => {
  const result = check({ mime: 'text/javascript' });
  assert.equal(result.status, 'Normal');
  assert.equal(result.mime, 'text/javascript');
});
test('malformed records and incognito items are rejected before reading private metadata', () => {
  for (const raw of [null, {}, [], item({ id: -1 }), item({ id: '1' }), item({ incognito: undefined })]) assert.equal(normalizeDownload(raw), null);
  const privateItem = { incognito: true };
  for (const field of ['id', 'filename', 'url', 'finalUrl', 'danger']) Object.defineProperty(privateItem, field, { get: () => assert.fail('Incognito metadata must be skipped') });
  assert.equal(normalizeDownload(privateItem), null);
});

function event() {
  const listeners = new Set();
  return { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener),
    emit: (...args) => [...listeners].forEach(listener => listener(...args)), listeners };
}
function clock() {
  let time = 0;
  const tasks = new Map();
  let id = 0;
  return { now: () => time, schedule: (callback, delay) => { tasks.set(++id, { callback, at: time + delay }); return id; },
    unschedule: id => tasks.delete(id), tasks,
    advance(amount) { time += amount; for (const [id, task] of [...tasks]) if (task.at <= time) { tasks.delete(id); task.callback(); } } };
}
function chromeFixture() {
  const calls = [];
  const pending = [];
  const downloads = { onCreated: event(), onChanged: event(), onErased: event(), search(query, callback) {
    assert.deepEqual(Object.keys(query), ['id']);
    assert.ok(Number.isSafeInteger(query.id));
    calls.push(query); pending.push(callback);
  } };
  const api = { runtime: { id: 'self-id', lastError: null, onMessage: event(), getURL: path => `chrome-extension://self-id/${path}` },
    downloads: new Proxy(downloads, { get(target, key) { assert.ok(['onCreated', 'onChanged', 'onErased', 'search'].includes(key), 'Only observational APIs'); return target[key]; } }) };
  return { api, downloads, calls, pending };
}
test('observer starts empty and never performs a startup/history search', () => {
  const { api, calls } = chromeFixture();
  const observer = createDownloadObserver(api, clock());
  assert.deepEqual(observer.read(), { available: false, check: null, remainingMs: 0 });
  assert.equal(calls.length, 0);
  observer.dispose();
});
test('created events replace one temporary record rather than accumulating an inventory', () => {
  const { api, downloads, calls } = chromeFixture();
  const timer = clock();
  const observer = createDownloadObserver(api, timer);
  downloads.onCreated.emit(item());
  downloads.onCreated.emit(item({ id: 2, filename: 'new.pdf' }));
  const result = observer.read();
  assert.equal(result.check.filename, 'new.pdf');
  assert.doesNotMatch(JSON.stringify(result), /report.pdf|startTime/);
  assert.equal(result.check.id, undefined);
  assert.equal(timer.tasks.size, 1);
  assert.equal(calls.length, 0);
  observer.dispose();
});
test('one-shot expiry and worker recreation discard all transient metadata', () => {
  const { api, downloads } = chromeFixture();
  const timer = clock();
  const observer = createDownloadObserver(api, timer);
  downloads.onCreated.emit(item());
  timer.advance(DOWNLOAD_LIFETIME_MS - 1);
  assert.equal(observer.read().available, true);
  timer.advance(1);
  assert.equal(observer.read().available, false);
  observer.dispose();
  assert.equal(createDownloadObserver(api, timer).read().available, false);
});
test('changed event recovers only its own ID metadata after worker restart', () => {
  const { api, downloads, calls, pending } = chromeFixture();
  const observer = createDownloadObserver(api, clock());
  downloads.onChanged.emit({ id: 9, danger: { current: 'url', previous: 'safe' } });
  assert.deepEqual(calls, [{ id: 9 }]);
  pending.shift()([item({ id: 9, danger: 'url' })]);
  assert.equal(observer.read().check.status, 'Review');
  observer.dispose();
});
test('irrelevant changes do not trigger reads or a file-existence feedback loop', () => {
  const { api, downloads, calls } = chromeFixture();
  const observer = createDownloadObserver(api, clock());
  for (const delta of [null, {}, { id: 1, exists: { current: false } }, { id: 1, startTime: { current: 'old' } },
    { id: 1, danger: { previous: 'safe' } }, { id: 1, bytesReceived: { current: 2 } }, { id: 1, opened: { current: true } }]) downloads.onChanged.emit(delta);
  assert.equal(calls.length, 0);
  observer.dispose();
});
test('changed-event errors and malformed search results fail without leaking browser errors', () => {
  const { api, downloads, pending } = chromeFixture();
  const observer = createDownloadObserver(api, clock());
  for (const response of [undefined, [], [item({ id: 2 })], [item(), item()], [item({ incognito: true })]]) {
    downloads.onChanged.emit({ id: 1, state: { current: 'complete' } });
    pending.shift()(response);
    assert.equal(observer.read().available, false);
  }
  downloads.onChanged.emit({ id: 1, danger: { current: 'url' } });
  api.runtime.lastError = { message: 'PRIVATE_INPUT_SENTINEL' };
  pending.shift()([item()]);
  assert.doesNotMatch(JSON.stringify(observer.read()), /PRIVATE_INPUT_SENTINEL/);
  observer.dispose();
});
test('incognito events never replace a regular temporary check', () => {
  const { api, downloads, pending } = chromeFixture();
  const observer = createDownloadObserver(api, clock());
  downloads.onCreated.emit(item());
  downloads.onCreated.emit(item({ id: 2, incognito: true, filename: 'PRIVATE_INPUT_SENTINEL.pdf' }));
  downloads.onChanged.emit({ id: 2, filename: { current: 'PRIVATE_INPUT_SENTINEL.pdf' } });
  pending.shift()([item({ id: 2, incognito: true })]);
  assert.equal(observer.read().check.filename, 'report.pdf');
  observer.dispose();
});
test('late event lookups cannot overwrite a newer event or restore expired data', () => {
  const { api, downloads, pending } = chromeFixture();
  const timer = clock();
  const observer = createDownloadObserver(api, timer);
  downloads.onChanged.emit({ id: 1, state: { current: 'complete' } });
  downloads.onCreated.emit(item({ id: 2, filename: 'new.pdf' }));
  pending.shift()([item()]);
  assert.equal(observer.read().check.filename, 'new.pdf');
  downloads.onChanged.emit({ id: 2, state: { current: 'complete' } });
  timer.advance(DOWNLOAD_LIFETIME_MS);
  pending.shift()([item({ id: 2 })]);
  assert.equal(observer.read().available, false);
  observer.dispose();
});
test('browser erasure of the current item clears the check without altering any file', () => {
  const { api, downloads, pending } = chromeFixture();
  const observer = createDownloadObserver(api, clock());
  downloads.onCreated.emit(item());
  downloads.onErased.emit(2);
  assert.equal(observer.read().available, true);
  downloads.onErased.emit(1);
  assert.equal(observer.read().available, false);
  downloads.onChanged.emit({ id: 1, danger: { current: 'url' } });
  downloads.onErased.emit(1);
  pending.shift()([item()]);
  assert.equal(observer.read().available, false);
  observer.dispose();
});
test('worker registers synchronously and responds only to its own popup read request', () => {
  const { api, downloads } = chromeFixture();
  const observer = registerDownloadWorker(api, clock());
  assert.equal(downloads.onCreated.listeners.size, 1);
  downloads.onCreated.emit(item());
  const handler = [...api.runtime.onMessage.listeners][0];
  const sender = { id: api.runtime.id, url: api.runtime.getURL('src/popup/popup.html') };
  let response;
  handler({ type: 'privacyLens:recent-download' }, sender, result => { response = result; });
  assert.equal(response.check.filename, 'report.pdf');
  for (const invalid of [{ ...sender, id: 'other' }, { ...sender, url: 'https://example.com' }, { ...sender, tab: { incognito: true } }]) {
    handler({ type: 'privacyLens:recent-download' }, invalid, () => assert.fail('Reject foreign/private sender'));
  }
  handler({ type: 'mutate' }, sender, () => assert.fail('Only a read message'));
  observer.dispose();
  const unavailable = chromeFixture().api;
  delete unavailable.downloads;
  assert.equal(registerDownloadWorker(unavailable, clock()), null);
  [...unavailable.runtime.onMessage.listeners][0]({ type: 'privacyLens:recent-download' }, sender, result => assert.equal(result, null));
});

const reply = () => ({ available: true, check: check(), remainingMs: 1000 });
function popupApi(response = reply()) {
  const calls = [];
  const api = { tabs: { query: async options => { assert.deepEqual(options, { active: true, currentWindow: true }); return [{ incognito: false }]; } },
    runtime: { lastError: null, sendMessage(message, callback) { assert.deepEqual(message, { type: 'privacyLens:recent-download' }); calls.push(message); callback(response); } } };
  return { api, calls };
}
test('popup reads one local worker check without using downloads/history APIs itself', async () => {
  const { api, calls } = popupApi();
  assert.equal((await readRecentDownload(api)).check.filename, 'report.pdf');
  assert.equal(calls.length, 1);
});
test('incognito/unknown tab and closed popup send no download message', async () => {
  for (const tab of [{ incognito: true }, {}, undefined]) {
    const { api, calls } = popupApi();
    api.tabs.query = async () => tab ? [tab] : [];
    assert.equal((await readRecentDownload(api)).available, false);
    assert.equal(calls.length, 0);
  }
  const { api, calls } = popupApi();
  const controller = new AbortController(); controller.abort();
  await readRecentDownload(api, { signal: controller.signal });
  assert.equal(calls.length, 0);
});
test('malformed worker replies and messaging errors show unavailable, not raw data', async () => {
  for (const response of [null, {}, { ...reply(), remainingMs: Infinity }, { ...reply(), check: { filename: 'PRIVATE_INPUT_SENTINEL' } },
    { ...reply(), check: { ...check(), findings: new Array(2) } }]) {
    assert.equal(await readRecentDownload(popupApi(response).api), null);
  }
  const { api } = popupApi();
  api.runtime.lastError = { message: 'PRIVATE_INPUT_SENTINEL' };
  assert.equal(await readRecentDownload(api), null);
});
test('reader returns a whitelist and drops unrequested metadata from replies', async () => {
  const response = reply(); response.check.id = 3; response.check.path = 'PRIVATE_INPUT_SENTINEL'; response.check.timestamp = 'PRIVATE_INPUT_SENTINEL';
  const result = await readRecentDownload(popupApi(response).api);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_INPUT_SENTINEL|timestamp/);
  assert.equal(result.check.id, undefined);
});
test('UI expiry and closure remove the rendered snapshot without persisting it', async () => {
  const { api } = popupApi();
  const timer = clock();
  let current;
  const controller = createDownloadController(api, {}, (_doc, value) => { current = value; }, () => { current = undefined; }, timer);
  await controller.read();
  assert.equal(current.check.filename, 'report.pdf');
  timer.advance(1000);
  assert.equal(current.available, false);
  await controller.read();
  controller.clear();
  assert.equal(current, undefined);
  assert.equal(timer.tasks.size, 0);
});
test('late popup callbacks cannot restore a closed view', async () => {
  const { api } = popupApi();
  let finish;
  api.runtime.sendMessage = (_message, callback) => { finish = callback; };
  let rendered;
  const lifecycle = new AbortController();
  const controller = createDownloadController(api, {}, (_doc, value) => { rendered = value; }, () => { rendered = undefined; }, { ...clock(), signal: lifecycle.signal });
  const pending = controller.read();
  await new Promise(resolve => setImmediate(resolve));
  lifecycle.abort(); controller.clear(); finish(reply()); await pending;
  assert.equal(rendered, undefined);
  const late = popupApi();
  late.api.runtime.sendMessage = (_message, callback) => { finish = callback; };
  let time = 0;
  const delayed = readRecentDownload(late.api, { now: () => time });
  await new Promise(resolve => setImmediate(resolve));
  time = 2000; finish(reply());
  assert.equal((await delayed).available, false);
});
class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.dataset = {}; }
  set textContent(text) { this.text = text; this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
}
function view() {
  const container = new Element();
  return { getElementById: id => { assert.ok(['download-check', 'download-state'].includes(id)); return id === 'download-check' ? container : null; }, createElement: tag => new Element(tag),
    createTextNode: text => { const element = new Element(); element.textContent = text; return element; } };
}
test('download view renders text explanations and no file-control or history UI', () => {
  const document = view();
  renderDownloadCheck(document, { ...reply(), check: check({ filename: '<script>.pdf.exe', danger: 'uncommon' }) });
  const output = document.getElementById('download-check').textContent;
  assert.match(output, /<script>\.pdf\.exe.*Review.*Source.*Chrome.*Consider.*File details/);
  assert.doesNotMatch(output, /Cancel download|Delete file|Open file|download history list/);
  clearDownloadCheck(document);
  assert.equal(document.getElementById('download-check').textContent, '');
  renderDownloadCheck(document, { available: false });
  assert.equal(document.getElementById('download-check').textContent, 'No recent download.');
});
test('download source contains no file-content/hash/network/persistence or mutation API calls', async () => {
  const root = new URL('../src/downloads/', import.meta.url);
  const files = await readdir(root);
  for (const name of [...files.map(name => new URL(name, root)), new URL('../src/background/service-worker.js', import.meta.url)]) {
    const source = await readFile(name, 'utf8');
    assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|FileReader|Blob|FileSystem|indexedDB|localStorage|sessionStorage|crypto|setInterval|onDeterminingFilename)\b|\.storage\b|\.cookie\b/);
    assert.doesNotMatch(source, /\.(?:cancel|erase|removeFile|open|show|pause|resume|setShelfEnabled|setUiOptions|acceptDanger|download|getFileIcon|showDefaultFolder)\s*\(/);
  }
});
