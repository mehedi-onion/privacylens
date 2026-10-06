import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { analyzeUrl } from '../src/analysis/url-analyzer.js';
import { NAVIGATION_LIFETIME_MS, navigationOrigin, normalizeNavigation, adviseNavigation } from '../src/navigation/navigation-advisor.js';
import { createNavigationObserver } from '../src/navigation/navigation-observer.js';
import { readNavigation } from '../src/navigation/navigation-reader.js';
import { renderNavigation, clearNavigation } from '../src/navigation/navigation-view.js';
import { registerNavigationWorker } from '../src/background/service-worker.js';
import { scanCurrentTab, clearPopup } from '../src/popup/popup.js';

const documentA = '12345678-1234-1234-1234-123456789abc';
const documentB = '87654321-4321-4321-4321-cba987654321';
const committed = (overrides = {}) => ({ frameId: 0, tabId: 7, documentId: documentA,
  url: 'https://example.com/page', transitionType: 'link', transitionQualifiers: [], ...overrides });
const advice = (qualifiers, url = 'https://example.com', overrides = {}) =>
  adviseNavigation(normalizeNavigation(committed({ url, transitionQualifiers: qualifiers, ...overrides })), analyzeUrl(url));
const has = (result, id) => result.findings.some(finding => finding.id === id);

test('no redirect qualifiers mean no reported qualifier, not proof of direct navigation', () => {
  const result = advice([]);
  assert.equal(result.status, 'Normal');
  assert.ok(has(result, 'no-redirect-qualifier'));
  assert.match(result.findings[0].why, /not proof of a direct path/);
});
test('server_redirect is explained conservatively without a chain or count', () => {
  const result = advice(['server_redirect']);
  assert.equal(result.status, 'Normal');
  assert.ok(has(result, 'server_redirect'));
  assert.match(result.findings[0].detected, /one or more server/);
  assert.match(result.findings[0].why, /HTTPS upgrades/);
});
test('client_redirect is explained as page-initiated navigation', () => {
  const result = advice(['client_redirect']);
  assert.equal(result.status, 'Normal');
  assert.match(result.findings[0].detected, /page-initiated/);
  assert.match(result.findings[0].why, /scripts or refresh/);
});
test('both redirect qualifiers produce separate accurate explanations, not two counted hops', () => {
  const result = advice(['client_redirect', 'server_redirect', 'server_redirect']);
  assert.deepEqual(result.findings.map(finding => finding.id), ['server_redirect', 'client_redirect']);
  assert.equal(result.status, 'Normal');
});
test('forward_back and from_address_bar are distinct informational signals', () => {
  const result = advice(['forward_back', 'from_address_bar']);
  assert.ok(has(result, 'forward_back'));
  assert.ok(has(result, 'from_address_bar'));
  assert.equal(result.status, 'Normal');
});
test('benign HTTPS and official login domains stay Normal with redirects', () => {
  for (const url of ['https://example.com', 'https://www.example.com', 'https://accounts.google.com/login']) {
    assert.equal(advice(['server_redirect'], url).status, 'Normal');
  }
});
test('redirect plus public IP adds visible URL review context', () => {
  const result = advice(['server_redirect'], 'https://192.0.2.1');
  assert.equal(result.status, 'Review');
  assert.ok(has(result, 'redirect-url-context'));
  assert.match(result.findings.find(finding => finding.id === 'redirect-url-context').detected, /IP address/);
});
test('brand mismatch plus login and redirect stays Review rather than inventing behavior', () => {
  const result = advice(['client_redirect'], 'https://paypal-login-example.com/login');
  assert.equal(result.status, 'Review');
  assert.match(result.findings.find(finding => finding.id === 'redirect-url-context').detected, /Brand\/domain mismatch/);
  assert.match(result.findings.find(finding => finding.id === 'redirect-url-context').why, /no earlier domain or redirect chain is known/);
});
test('local HTTP/IP and a redirect alone remain informational', () => {
  assert.equal(advice(['server_redirect'], 'http://127.0.0.1:8768').status, 'Normal');
});
test('without a redirect, URL warnings stay in URL findings rather than duplicated navigation warnings', () => {
  const result = advice([], 'https://paypal-login-example.com');
  assert.equal(result.status, 'Normal');
  assert.equal(has(result, 'redirect-url-context'), false);
});
test('absent or mismatched navigation is explicitly unavailable, never direct', () => {
  for (const snapshot of [null, normalizeNavigation(committed({ url: 'https://another.example' }))]) {
    const result = adviseNavigation(snapshot, analyzeUrl('https://example.com'));
    assert.equal(result.available, false);
    assert.equal(result.status, 'Normal');
    assert.match(result.summary, /does not mean there was no redirect/);
  }
});
test('normalization keeps only origin, document correlation and transition metadata', () => {
  const raw = committed({ url: 'https://synthetic-user:private-test-value@example.com/PRIVATE_SENTINEL?PRIVATE_SENTINEL#PRIVATE_SENTINEL' });
  for (const field of ['timeStamp', 'processId', 'parentDocumentId', 'previousUrl', 'redirectChain', 'title']) {
    Object.defineProperty(raw, field, { get: () => assert.fail(`Must not inspect ${field}`) });
  }
  const result = normalizeNavigation(raw);
  assert.equal(result.origin, 'https://example.com');
  assert.equal(result.documentId, documentA);
  assert.doesNotMatch(JSON.stringify(result), /synthetic|private-test-value|PRIVATE_SENTINEL|timeStamp|processId|previousUrl|redirectChain/);
});
test('subframes, malformed events, unknown qualifiers and prerender/cached documents fail safely', () => {
  for (const raw of [null, {}, [], committed({ frameId: 1 }), committed({ tabId: -1 }), committed({ tabId: '7' }),
    committed({ url: 'PRIVATE_SENTINEL' }), committed({ url: 'chrome://extensions' }), committed({ transitionType: 'future' }),
    committed({ transitionQualifiers: 'server_redirect' }), committed({ transitionQualifiers: ['future'] }),
    committed({ transitionQualifiers: new Array(1) }), committed({ documentId: 'PRIVATE_SENTINEL' }),
    committed({ documentLifecycle: 'prerender' }), committed({ documentLifecycle: 'cached' }), committed({ frameType: 'sub_frame' })]) {
    assert.equal(normalizeNavigation(raw), null);
  }
  assert.equal(navigationOrigin(null), null);
});
test('Chrome before documentId support is handled without raising the minimum version', () => {
  const result = normalizeNavigation(committed({ documentId: undefined, transitionQualifiers: ['server_redirect'] }));
  assert.equal(result.documentId, null);
  assert.deepEqual(result.qualifiers, ['server_redirect']);
});

test('real Chromium compact document identifiers retain their exact identity', () => {
  for (const documentId of ['ABCDEF0123456789ABCDEF0123456789', 'abcdef0123456789abcdef0123456789', documentA]) {
    assert.equal(normalizeNavigation(committed({ documentId }))?.documentId, documentId);
  }
  for (const documentId of ['ABCDEF0123456789ABCDEF012345678', 'ABCDEF0123456789ABCDEF01234567890', 'GBCDEF0123456789ABCDEF0123456789']) {
    assert.equal(normalizeNavigation(committed({ documentId })), null);
  }
});

function event() {
  const listeners = new Set();
  return { addListener: handler => listeners.add(handler), removeListener: handler => listeners.delete(handler),
    emit: (...args) => [...listeners].forEach(handler => handler(...args)), listeners };
}
function clock() {
  let time = 0;
  let index = 0;
  const tasks = new Map();
  return { now: () => time, schedule: (callback, delay) => { tasks.set(++index, { callback, at: time + delay }); return index; },
    unschedule: id => tasks.delete(id), tasks,
    advance(amount) { time += amount; for (const [id, task] of [...tasks]) if (task.at <= time) { tasks.delete(id); task.callback(); } } };
}
function fixture() {
  const queries = [], frames = [], pendingQueries = [], pendingFrames = [];
  const context = { tab: { id: 7, windowId: 1, active: true, incognito: false }, frame: { url: 'https://example.com/page', documentId: documentA, errorOccurred: false }, deferQuery: false, deferFrame: false };
  const tabs = { onRemoved: event(), onActivated: event(), onReplaced: event(), query(options, callback) {
    assert.deepEqual(options, { active: true, lastFocusedWindow: true });
    queries.push(options);
    if (context.deferQuery) pendingQueries.push(callback); else callback([context.tab]);
  } };
  const webNavigation = { onCommitted: event(), onBeforeNavigate: event(), getFrame(options, callback) {
    assert.deepEqual(options, { tabId: 7, frameId: 0 }); frames.push(options);
    if (context.deferFrame) pendingFrames.push(callback); else callback(context.frame);
  } };
  const guarded = (object, allowed) => new Proxy(object, { get(target, key) {
    assert.ok(allowed.includes(key), `Undocumented/unnecessary API ${String(key)}`); return target[key];
  } });
  const api = { tabs: guarded(tabs, ['onRemoved', 'onActivated', 'onReplaced', 'query']),
    webNavigation: guarded(webNavigation, ['onCommitted', 'onBeforeNavigate', 'getFrame']), windows: { onFocusChanged: event() },
    runtime: { id: 'self-id', lastError: null, onMessage: event(), getURL: path => `chrome-extension://self-id/${path}` } };
  return { api, tabs, webNavigation, queries, frames, pendingQueries, pendingFrames, context };
}
const read = (observer, tabId = 7) => new Promise(resolve => observer.read(tabId, resolve));

test('compact Chromium identifiers expose the observed redirect but reject a replacement document', async () => {
  const f = fixture();
  const documentId = 'ABCDEF0123456789ABCDEF0123456789';
  f.context.frame.documentId = documentId;
  const observer = createNavigationObserver(f.api, clock());
  f.webNavigation.onCommitted.emit(committed({ documentId, transitionQualifiers: ['server_redirect'] }));
  const result = await read(observer);
  assert.equal(result.available, true);
  assert.deepEqual(result.snapshot.qualifiers, ['server_redirect']);
  assert.equal(result.snapshot.documentId, undefined);
  f.context.frame.documentId = '0123456789ABCDEF0123456789ABCDEF';
  assert.equal((await read(observer)).available, false);
  observer.dispose();
});

test('observer registers synchronously and performs no startup lookup or backfill', async () => {
  const f = fixture(); const observer = createNavigationObserver(f.api, clock());
  assert.equal(f.webNavigation.onCommitted.listeners.size, 1);
  assert.equal(f.webNavigation.onBeforeNavigate.listeners.size, 1);
  assert.equal(f.queries.length, 0);
  assert.equal((await read(observer)).available, false);
  assert.equal(f.frames.length, 0);
  observer.dispose();
});
test('only top-level events for the focused active regular tab are retained', async () => {
  const f = fixture(); const observer = createNavigationObserver(f.api, clock());
  f.webNavigation.onCommitted.emit(committed({ frameId: 1 }));
  assert.equal(f.queries.length, 0);
  f.webNavigation.onCommitted.emit(committed({ tabId: 99 }));
  assert.equal((await read(observer)).available, false);
  f.webNavigation.onCommitted.emit(committed({ transitionQualifiers: ['server_redirect'] }));
  const result = await read(observer);
  assert.equal(result.available, true);
  assert.deepEqual(result.snapshot.qualifiers, ['server_redirect']);
  assert.equal(result.snapshot.documentId, undefined);
  assert.equal(result.snapshot.tabId, undefined);
  observer.dispose();
});
test('private/unknown tabs are skipped before reading any event URL', async () => {
  for (const incognito of [true, undefined]) {
    const f = fixture(); f.context.tab.incognito = incognito;
    const observer = createNavigationObserver(f.api, clock());
    const raw = committed(); Object.defineProperty(raw, 'url', { get: () => assert.fail('Private URL inspection') });
    f.webNavigation.onCommitted.emit(raw);
    assert.equal((await read(observer)).available, false);
    observer.dispose();
  }
});
test('document changes replace one snapshot rather than accumulate earlier URLs', async () => {
  const f = fixture(); const timer = clock(); const observer = createNavigationObserver(f.api, timer);
  f.webNavigation.onCommitted.emit(committed({ transitionQualifiers: ['server_redirect'] }));
  f.webNavigation.onCommitted.emit(committed({ documentId: documentB, url: 'https://new.example/page' }));
  f.context.frame = { url: 'https://new.example/page', documentId: documentB, errorOccurred: false };
  const result = await read(observer);
  assert.equal(result.snapshot.domain, 'new.example');
  assert.deepEqual(result.snapshot.qualifiers, []);
  assert.doesNotMatch(JSON.stringify(result), /example\.com|server_redirect/);
  assert.equal(timer.tasks.size, 1);
  observer.dispose();
});
test('top-level navigation start clears the old document; subframe start does not', async () => {
  const f = fixture(); const observer = createNavigationObserver(f.api, clock());
  f.webNavigation.onCommitted.emit(committed());
  f.webNavigation.onBeforeNavigate.emit({ frameId: 1, tabId: 7 });
  assert.equal((await read(observer)).available, true);
  f.webNavigation.onBeforeNavigate.emit({ frameId: 0, tabId: 7 });
  assert.equal((await read(observer)).available, false);
  observer.dispose();
});
test('tab closure clears its snapshot and cancels a delayed commit lookup', async () => {
  const f = fixture(); const timer = clock(); const observer = createNavigationObserver(f.api, timer);
  f.webNavigation.onCommitted.emit(committed());
  f.tabs.onRemoved.emit(7);
  assert.equal((await read(observer)).available, false);
  assert.equal(timer.tasks.size, 0);
  f.context.deferQuery = true;
  f.webNavigation.onCommitted.emit(committed());
  f.tabs.onRemoved.emit(7);
  f.pendingQueries.shift()([f.context.tab]);
  assert.equal((await read(observer)).available, false);
  observer.dispose();
});
test('tab switching, window focus change and tab replacement discard the single snapshot', async () => {
  for (const trigger of [f => f.tabs.onActivated.emit({ tabId: 8 }), f => f.api.windows.onFocusChanged.emit(2), f => f.tabs.onReplaced.emit(8, 7)]) {
    const f = fixture(); const observer = createNavigationObserver(f.api, clock());
    f.webNavigation.onCommitted.emit(committed()); trigger(f);
    assert.equal((await read(observer)).available, false);
    observer.dispose();
  }
});
test('wrong current tab or private popup cannot read a previous regular snapshot', async () => {
  const f = fixture(); const observer = createNavigationObserver(f.api, clock());
  f.webNavigation.onCommitted.emit(committed());
  assert.equal((await read(observer, 8)).available, false);
  f.context.tab.incognito = true;
  assert.equal((await read(observer)).available, false);
  assert.equal(f.frames.length, 0);
  f.context.tab.incognito = false;
  assert.equal((await read(observer)).available, false);
  observer.dispose();
});
test('a tab moved to another window cannot reuse an old window snapshot', async () => {
  const f = fixture(); const observer = createNavigationObserver(f.api, clock());
  f.webNavigation.onCommitted.emit(committed());
  f.context.tab.windowId = 2;
  assert.equal((await read(observer)).available, false);
  assert.equal(f.frames.length, 0);
  observer.dispose();
});
test('current documentId and origin verification reject stale or error frames', async () => {
  for (const change of [{ documentId: documentB }, { url: 'https://other.example' }, { errorOccurred: true }, { documentLifecycle: 'cached' }]) {
    const f = fixture(); const observer = createNavigationObserver(f.api, clock());
    f.webNavigation.onCommitted.emit(committed()); Object.assign(f.context.frame, change);
    assert.equal((await read(observer)).available, false);
    f.context.frame = { url: 'https://example.com', documentId: documentA, errorOccurred: false };
    assert.equal((await read(observer)).available, false);
    observer.dispose();
  }
});
test('pre-106 frames use origin plus observed lifecycle rather than invent a documentId', async () => {
  const f = fixture(); delete f.context.frame.documentId;
  const observer = createNavigationObserver(f.api, clock());
  f.webNavigation.onCommitted.emit(committed({ documentId: undefined }));
  assert.equal((await read(observer)).available, true);
  observer.dispose();
});
test('API failures and malformed frames never leak raw errors or create direct navigation', async () => {
  for (const frame of [null, {}, { url: 'PRIVATE_SENTINEL' }]) {
    const f = fixture(); const observer = createNavigationObserver(f.api, clock());
    f.webNavigation.onCommitted.emit(committed()); f.context.frame = frame;
    assert.equal((await read(observer)).available, false);
    observer.dispose();
  }
  const f = fixture(); const observer = createNavigationObserver(f.api, clock());
  f.webNavigation.onCommitted.emit(committed());
  f.api.runtime.lastError = { message: 'PRIVATE_SENTINEL' };
  assert.doesNotMatch(JSON.stringify(await read(observer)), /PRIVATE_SENTINEL/);
  observer.dispose();
});
test('five-minute expiry, disposal and worker recreation lose all metadata', async () => {
  const f = fixture(); const timer = clock(); const observer = createNavigationObserver(f.api, timer);
  f.webNavigation.onCommitted.emit(committed());
  timer.advance(NAVIGATION_LIFETIME_MS);
  assert.equal((await read(observer)).available, false);
  observer.dispose();
  assert.equal(f.webNavigation.onCommitted.listeners.size, 0);
  const recreated = createNavigationObserver(f.api, timer);
  assert.equal((await read(recreated)).available, false);
  recreated.dispose();
});
test('late query/frame callbacks cannot revive a replaced, closed or expired document', async () => {
  const f = fixture(); const timer = clock(); const observer = createNavigationObserver(f.api, timer);
  f.context.deferQuery = true;
  f.webNavigation.onCommitted.emit(committed());
  f.webNavigation.onBeforeNavigate.emit({ tabId: 7, frameId: 0 });
  f.pendingQueries.shift()([f.context.tab]);
  assert.equal((await read(observer)).available, false);
  f.context.deferQuery = false; f.webNavigation.onCommitted.emit(committed()); f.context.deferFrame = true;
  const pending = read(observer);
  timer.advance(NAVIGATION_LIFETIME_MS);
  f.pendingFrames.shift()(f.context.frame);
  assert.equal((await pending).available, false);
  observer.dispose();
});
test('same-document path/fragment changes stay associated without saving the URL', async () => {
  const f = fixture(); const observer = createNavigationObserver(f.api, clock());
  f.webNavigation.onCommitted.emit(committed({ transitionQualifiers: ['server_redirect'] }));
  f.context.frame.url = 'https://example.com/PRIVATE_SENTINEL?PRIVATE_SENTINEL#PRIVATE_SENTINEL';
  const result = await read(observer);
  assert.equal(result.available, true);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SENTINEL/);
  observer.dispose();
});
test('worker allows only its own popup finite read of the current tab', async () => {
  const f = fixture(); const observer = registerNavigationWorker(f.api, clock());
  f.webNavigation.onCommitted.emit(committed());
  const handler = [...f.api.runtime.onMessage.listeners][0];
  const sender = { id: f.api.runtime.id, url: f.api.runtime.getURL('src/popup/popup.html') };
  let result;
  assert.equal(handler({ type: 'privacyLens:navigation', tabId: 7 }, sender, value => { result = value; }), true);
  assert.equal(result.available, true);
  for (const invalid of [{ ...sender, id: 'other' }, { ...sender, url: 'https://example.com' }, { ...sender, tab: { incognito: true } }]) {
    handler({ type: 'privacyLens:navigation', tabId: 7 }, invalid, () => assert.fail('Foreign/private read'));
  }
  for (const message of [{ type: 'mutate', tabId: 7 }, { type: 'privacyLens:navigation', tabId: -1 }]) handler(message, sender, () => assert.fail('Invalid request'));
  observer.dispose();
  const unsupported = fixture(); delete unsupported.api.webNavigation;
  assert.equal(registerNavigationWorker(unsupported.api, clock()), null);
  [...unsupported.api.runtime.onMessage.listeners][0]({ type: 'privacyLens:navigation', tabId: 7 }, sender, value => assert.equal(value, null));
});

const response = () => ({ available: true, remainingMs: 1000, snapshot: { origin: 'https://example.com', domain: 'example.com', scheme: 'HTTPS',
  transitionType: 'link', qualifiers: ['server_redirect'] } });
const popupTab = (overrides = {}) => ({ id: 7, incognito: false, url: 'https://example.com/page', ...overrides });
function popupApi(value = response()) {
  return { runtime: { lastError: null, sendMessage(message, callback) {
    assert.deepEqual(message, { type: 'privacyLens:navigation', tabId: 7 }); callback(value);
  } } };
}
test('reader sends only tabId and returns a whitelist without internal IDs or extra fields', async () => {
  const raw = response(); raw.snapshot.documentId = documentA; raw.snapshot.previousUrl = 'PRIVATE_SENTINEL'; raw.snapshot.timeStamp = 'PRIVATE_SENTINEL';
  const result = await readNavigation(popupApi(raw), popupTab());
  assert.equal(result.available, true);
  assert.doesNotMatch(JSON.stringify(result), /documentId|PRIVATE_SENTINEL|timeStamp/);
});
test('reader skips private, unsupported, malformed and already-closed tabs', async () => {
  const api = { runtime: { sendMessage: () => assert.fail('No message') } };
  for (const tab of [null, {}, popupTab({ incognito: true }), popupTab({ incognito: undefined }), popupTab({ id: -1 }), popupTab({ url: 'chrome://extensions' })]) {
    assert.equal((await readNavigation(api, tab)).available, false);
  }
  const controller = new AbortController(); controller.abort();
  assert.equal((await readNavigation(api, popupTab(), { signal: controller.signal })).available, false);
});
test('malformed and mismatched worker responses fail safely', async () => {
  for (const raw of [null, {}, { ...response(), remainingMs: Infinity }, { ...response(), remainingMs: 0 },
    { ...response(), snapshot: { ...response().snapshot, qualifiers: new Array(1) } },
    { ...response(), snapshot: { ...response().snapshot, origin: 'https://example.com/PRIVATE_SENTINEL' } },
    { ...response(), snapshot: { ...response().snapshot, origin: 'https://other.example' } },
    { ...response(), snapshot: { ...response().snapshot, transitionType: 'future' } }]) {
    assert.equal((await readNavigation(popupApi(raw), popupTab())).available, false);
  }
});
test('reader suppresses browser errors and responses after closure or TTL', async () => {
  const api = popupApi(); api.runtime.lastError = { message: 'PRIVATE_SENTINEL' };
  assert.equal((await readNavigation(api, popupTab())).available, false);
  let finish; let time = 0; const lifecycle = new AbortController();
  const delayed = { runtime: { sendMessage: (_message, callback) => { finish = callback; } } };
  const pending = readNavigation(delayed, popupTab(), { signal: lifecycle.signal });
  lifecycle.abort(); finish(response()); assert.equal((await pending).available, false);
  const expired = readNavigation(delayed, popupTab(), { now: () => time });
  time = 2000; finish(response()); assert.equal((await expired).available, false);
});
class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.dataset = {}; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return (this.text ?? '') + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute() {}
}
function view() {
  const nodes = new Map(['domain', 'scheme', 'status', 'summary', 'findings', 'result', 'permissions-context',
    'permission-notes', 'site-permissions', 'navigation-findings'].map(id => [id, new Element()]));
  return { getElementById: id => nodes.get(id), createElement: tag => new Element(tag),
    createTextNode: text => { const node = new Element(); node.textContent = text; return node; } };
}
test('navigation view has expandable text-only guidance, no chain, technical IDs or history list', () => {
  const document = view(); renderNavigation(document, advice(['client_redirect', 'server_redirect']));
  const output = document.getElementById('navigation-findings').textContent;
  assert.match(output, /Server redirect.*What was noticed.*Why this matters.*Consider.*Client redirect/);
  assert.doesNotMatch(output, /documentId|tabId|redirect chain:|navigation history list/);
  clearNavigation(document); assert.equal(document.getElementById('navigation-findings').textContent, '');
  renderNavigation(document, adviseNavigation(null));
  assert.match(document.getElementById('navigation-findings').textContent, /unavailable/);
});
test('popup integrates navigation separately, stays conservative and expires the displayed snapshot', async () => {
  const document = view(); const timer = clock(); const lifecycle = new AbortController();
  const api = popupApi(); api.tabs = { query: async () => [popupTab()] };
  await scanCurrentTab(api, document, { ...timer, signal: lifecycle.signal });
  assert.equal(document.getElementById('status').textContent, 'Normal');
  assert.match(document.getElementById('navigation-findings').textContent, /Server redirect/);
  timer.advance(1000);
  assert.match(document.getElementById('navigation-findings').textContent, /unavailable/);
  lifecycle.abort(); clearPopup(document);
  assert.equal(document.getElementById('navigation-findings').textContent, '');
});
test('redirect context preserves URL Review/High Attention rules without creating a new accusation', async () => {
  for (const scheme of ['https', 'http']) {
    const url = `${scheme}://paypal-login-example.com/login`;
    const raw = response(); raw.snapshot = { ...raw.snapshot, origin: `${scheme}://paypal-login-example.com`, domain: 'paypal-login-example.com', scheme: scheme.toUpperCase() };
    const api = popupApi(raw); api.tabs = { query: async () => [popupTab({ url })] };
    const document = view(); const timer = clock(); const lifecycle = new AbortController();
    await scanCurrentTab(api, document, { ...timer, signal: lifecycle.signal });
    assert.equal(document.getElementById('status').textContent, scheme === 'https' ? 'Review' : 'High Attention');
    assert.match(document.getElementById('navigation-findings').textContent, /Redirect and address findings/);
    lifecycle.abort(); clearPopup(document);
    assert.equal(timer.tasks.size, 0);
  }
});
test('slow site-settings reads cannot cause an expired navigation snapshot to appear', async () => {
  const document = view(); const timer = clock(); const api = popupApi(); let finish;
  api.tabs = { query: async () => [popupTab()] };
  api.contentSettings = { camera: { get: (_options, callback) => { finish = callback; } } };
  const pending = scanCurrentTab(api, document, timer);
  await new Promise(resolve => setImmediate(resolve));
  timer.advance(2000); finish({ setting: 'block' }); await pending;
  assert.match(document.getElementById('navigation-findings').textContent, /unavailable/);
  assert.equal(timer.tasks.size, 0);
});
test('navigation code introduces no storage, history, request monitoring, network, logs, polling or mutation APIs', async () => {
  const root = new URL('../src/navigation/', import.meta.url);
  for (const name of await readdir(root)) {
    const source = await readFile(new URL(name, root), 'utf8');
    assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|setInterval|alarms)\b|\.(?:storage|history|webRequest|cookies)\b|console\.|\.timeStamp\b/);
    assert.doesNotMatch(source, /\.(?:getAllFrames|update|remove|create|goBack|goForward)\s*\(/);
  }
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));
  assert.ok(manifest.permissions.includes('webNavigation'));
  for (const permission of ['history', 'webRequest', 'tabs', '<all_urls>']) assert.equal(manifest.permissions.includes(permission), false);
  assert.equal(manifest.host_permissions, undefined);
});
