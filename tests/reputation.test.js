import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyzeUrl } from '../src/analysis/url-analyzer.js';
import { publicHostname, hostnameFromTab, VT_ORIGIN } from '../src/reputation/domain-rules.js';
import { createKeyStore, KEY_SLOT, QUOTA_SLOT } from '../src/reputation/key-store.js';
import { createQuotaLimiter, DAY_MS, REQUEST_INTERVAL_MS } from '../src/reputation/quota-limiter.js';
import { normalizeReport, adviseReputation } from '../src/reputation/reputation-advisor.js';
import { lookupDomain } from '../src/reputation/virustotal-client.js';
import { registerReputationWorker } from '../src/reputation/reputation-worker.js';
import { createReputationController } from '../src/reputation/reputation-controller.js';
import { createOptionsController } from '../src/options/options.js';
import { renderResult } from '../src/popup/popup-view.js';
import { renderReputation, showReputationMessage } from '../src/reputation/reputation-view.js';

// This deliberately artificial string is not an API credential. Every request is mocked.
const sampleKey = 'synthetic-test-value-not-real';
const tab = () => ({ id: 7, incognito: false, url: 'https://accounts.google.com/login?private-query#private-fragment' });
const stats = (changes = {}) => ({ malicious: 0, suspicious: 0, harmless: 72, undetected: 15, ...changes });
const payload = (changes = {}, hostname = 'accounts.google.com') => ({ data: { type: 'domain', id: hostname,
  attributes: { last_analysis_stats: stats(changes), private_metadata: 'never-return' } } });
const response = (status = 200, data = payload(), retry = null) => ({ status,
  json: async () => data, headers: { get: name => name === 'Retry-After' ? retry : null } });
const turn = () => new Promise(resolve => setImmediate(resolve));

function chromeFixture() {
  const operations = [];
  const buffers = { local: {}, session: {} };
  const restricted = {};
  const api = { storage: {}, runtime: { id: 'this-extension', getURL: path => `chrome-extension://this-extension/${path}` },
    tabs: { query: async () => [api.currentTab] }, currentTab: tab(),
    permissions: { contains: async details => { assert.deepEqual(details, { origins: [VT_ORIGIN] }); return api.granted; } }, granted: true };
  for (const name of ['local', 'session']) api.storage[name] = {
    setAccessLevel: async details => { assert.deepEqual(details, { accessLevel: 'TRUSTED_CONTEXTS' }); restricted[name] = true; },
    get: async key => { assert.ok(restricted[name]); return { [key]: buffers[name][key] }; },
    set: async value => { assert.ok(restricted[name]); operations.push({ area: name, value: structuredClone(value) }); Object.assign(buffers[name], value); },
    remove: async key => { assert.ok(restricted[name]); delete buffers[name][key]; }
  };
  let handler;
  api.runtime.onMessage = { addListener: callback => { handler = callback; } };
  const sender = view => ({ id: api.runtime.id, url: api.runtime.getURL(`src/${view}/${view === 'popup' ? 'popup' : 'options'}.html`) });
  function message(value, view = 'popup', override) {
    return new Promise(resolve => {
      let replied = false;
      const waiting = handler(value, override ?? sender(view), reply => { replied = true; resolve(reply); });
      if (!waiting && !replied) resolve(undefined);
    });
  }
  return { api, buffers, operations, message, sender };
}

test('public domain validation rejects paths, ports, credentials, malformed and private indicators', () => {
  for (const value of [null, '', 'google.com/path', 'google.com?private', 'google.com#private', 'google.com:443',
    'user@google.com', 'Google.com', '-bad.com', 'bad..com', 'localhost', 'router.local', 'company.internal',
    'site.test', 'site.onion', 'site.invalid', 'site.example', 'router.localdomain', 'router.home.arpa', '10.0.0.1', '8.8.8.8', '[::1]', 'a'.repeat(64) + '.com']) {
    assert.equal(publicHostname(value), null, String(value));
  }
});
test('public domain validation preserves exact subdomains and ASCII IDN representation', () => {
  for (const value of ['google.com', 'accounts.google.com', 'xn--bcher-kva.de']) assert.equal(publicHostname(value), value);
});
test('tab sanitization excludes paths, credentials, queries, fragments, scheme and ports', () => {
  assert.equal(hostnameFromTab({ ...tab(), url: 'https://user:private-test-value@ACCOUNTS.GOOGLE.COM.:8443/private?private-query#private-fragment' }), 'accounts.google.com');
});
test('tab sanitization declines incognito, unknown context, restricted pages and IP/local URLs', () => {
  for (const value of [undefined, {}, { ...tab(), incognito: true }, { ...tab(), incognito: undefined },
    { ...tab(), id: -1 }, { ...tab(), url: 'chrome://extensions' }, { ...tab(), url: 'file:///private' },
    { ...tab(), url: 'http://localhost' }, { ...tab(), url: 'https://8.8.8.8' }]) assert.equal(hostnameFromTab(value), null);
});

test('no key configured returns metadata only and makes no request', async () => {
  const { api, buffers, operations } = chromeFixture(); const store = createKeyStore(api);
  assert.deepEqual(await store.status(), { configured: false, mode: 'none' });
  assert.deepEqual(await store.get(), { key: null, mode: 'none' });
  assert.deepEqual(buffers.local, {}); assert.deepEqual(operations, []);
});
test('default key is session only, survives worker recreation, and is absent after session clearing', async () => {
  const { api, buffers } = chromeFixture(); let store = createKeyStore(api);
  await store.save(sampleKey, false); assert.deepEqual(buffers.local, {});
  assert.deepEqual(buffers.session, { [KEY_SLOT]: sampleKey });
  store = createKeyStore(api); assert.deepEqual(await store.status(), { configured: true, mode: 'session' });
  delete buffers.session[KEY_SLOT]; assert.equal((await store.status()).configured, false);
});
test('Remember stores only the explicitly supplied key in local storage', async () => {
  const { api, buffers, operations } = chromeFixture(); const store = createKeyStore(api);
  await store.save(sampleKey, true);
  assert.deepEqual(buffers.local, { [KEY_SLOT]: sampleKey }); assert.deepEqual(buffers.session, {});
  assert.deepEqual(operations, [{ area: 'local', value: { [KEY_SLOT]: sampleKey } }]);
  assert.deepEqual(await store.status(), { configured: true, mode: 'remembered' });
});
test('switching key modes removes the previous copy', async () => {
  const { api, buffers } = chromeFixture(); const store = createKeyStore(api);
  await store.save(sampleKey, false); await store.save(sampleKey, true); assert.deepEqual(buffers.session, {});
  await store.save(sampleKey, false); assert.deepEqual(buffers.local, {});
});
test('Forget removes both key copies without resetting quota', async () => {
  const { api, buffers } = chromeFixture(); const store = createKeyStore(api);
  await store.save(sampleKey, true); buffers.session[KEY_SLOT] = sampleKey;
  const quota = { day: 5, count: 1, nextAt: 123, blockedUntil: 0 }; await store.writeQuota(quota);
  assert.deepEqual(await store.forget(), { configured: false, mode: 'none' });
  assert.deepEqual(buffers.local, {}); assert.deepEqual(buffers.session, { [QUOTA_SLOT]: quota });
});
test('key validation fails closed without replacing a working key', async () => {
  const { api } = chromeFixture(); const store = createKeyStore(api); await store.save(sampleKey, false);
  for (const key of ['', 'tiny', 'a\n'.repeat(20), null]) await assert.rejects(store.save(key, false));
  await assert.rejects(store.save(sampleKey, 'true')); assert.equal((await store.get()).key, sampleKey);
});
test('untrusted storage access or unavailable access-level APIs fail without reading the key', async () => {
  const { api } = chromeFixture(); let reads = 0;
  api.storage.local.setAccessLevel = () => { throw new Error(sampleKey); };
  api.storage.local.get = async () => { reads++; return { [KEY_SLOT]: sampleKey }; };
  await assert.rejects(createKeyStore(api).status(), /Key storage unavailable/); assert.equal(reads, 0);
});
test('failed Forget is reported rather than falsely claiming deletion', async () => {
  const { api } = chromeFixture(); const store = createKeyStore(api); await store.save(sampleKey, true);
  api.storage.local.remove = async () => { throw new Error(sampleKey); };
  await assert.rejects(store.forget(), /Key removal failed/);
});
test('quota storage rejects strings, extra fields and non-integer counters', async () => {
  const { api, buffers } = chromeFixture(); const store = createKeyStore(api);
  for (const value of [{ domain: 'google.com' }, { day: 1, count: -1, nextAt: 0, blockedUntil: 0 },
    { day: 1, count: 0, nextAt: 0, blockedUntil: 0, report: 'private' }, { day: 1, count: 0.5, nextAt: 0, blockedUntil: 0 }]) {
    await assert.rejects(store.writeQuota(value)); buffers.session[QUOTA_SLOT] = value; await assert.rejects(store.readQuota());
  }
});

test('throttle permits one request per 20 seconds and serializes simultaneous confirmations', async () => {
  const { api } = chromeFixture(); let time = DAY_MS; const limiter = createQuotaLimiter(createKeyStore(api), { now: () => time });
  assert.deepEqual(await Promise.all([limiter.reserve(), limiter.reserve()]), [true, false]);
  time += REQUEST_INTERVAL_MS - 1; assert.equal(await limiter.reserve(), false);
  time++; assert.equal(await limiter.reserve(), true);
});
test('anonymous quota survives worker recreation and limits to 500 per UTC day', async () => {
  const { api } = chromeFixture(); let time = DAY_MS * 10;
  let store = createKeyStore(api); await store.writeQuota({ day: 10, count: 499, nextAt: time, blockedUntil: 0 });
  let limiter = createQuotaLimiter(store, { now: () => time }); assert.equal(await limiter.reserve(), true);
  time += REQUEST_INTERVAL_MS; store = createKeyStore(api); limiter = createQuotaLimiter(store, { now: () => time });
  assert.equal(await limiter.reserve(), false); time = DAY_MS * 11; assert.equal(await limiter.reserve(), true);
});
test('429 cooldown honors Retry-After and quota errors conservatively until UTC reset', async () => {
  const { api } = chromeFixture(); let time = DAY_MS + 1000;
  const limiter = createQuotaLimiter(createKeyStore(api), { now: () => time });
  await limiter.cooldown(120000); time += 119999; assert.equal(await limiter.reserve(), false);
  time++; assert.equal(await limiter.reserve(), true); await limiter.cooldown(60000, true);
  time += 60000; assert.equal(await limiter.reserve(), false); time = 2 * DAY_MS; assert.equal(await limiter.reserve(), true);
});
test('storage write failure prevents reserving a request', async () => {
  const { api } = chromeFixture(); api.storage.session.set = async () => { throw new Error('failure'); };
  await assert.rejects(createQuotaLimiter(createKeyStore(api)).reserve());
});

test('valid report returns only the selected hostname, counts and optional timeout', () => {
  const report = normalizeReport(payload({ suspicious: 1, timeout: 2 }), 'accounts.google.com');
  assert.deepEqual(report, { hostname: 'accounts.google.com', counts: stats({ suspicious: 1 }), timeout: 2 });
  assert.doesNotMatch(JSON.stringify(report), /never-return|private_metadata/);
});
test('malformed, mismatched and incomplete reports fail safely', () => {
  for (const value of [null, {}, { data: { type: 'url' } }, payload({}, 'google.com'),
    payload({ malicious: -1 }), payload({ harmless: '72' }), payload({ suspicious: NaN }),
    payload({ timeout: -1 }), payload({ undetected: undefined })]) assert.equal(normalizeReport(value, 'accounts.google.com'), null);
});
test('zero verdicts are explained as unavailable verdicts rather than a clean assessment', () => {
  const report = normalizeReport(payload({ malicious: 0, suspicious: 0, harmless: 0, undetected: 0 }), 'accounts.google.com');
  assert.equal(adviseReputation(analyzeUrl(tab().url), report).label, 'No vendor verdicts available');
});
test('clean report keeps a normal local result Normal', () => {
  const advice = adviseReputation(analyzeUrl(tab().url), normalizeReport(payload(), 'accounts.google.com'));
  assert.equal(advice.status, 'Normal'); assert.equal(advice.label, 'No strong warning found'); assert.match(advice.caveat, /does not guarantee safety/);
});
test('clean reputation never removes local Review or High Attention', () => {
  const report = normalizeReport(payload(), 'accounts.google.com');
  for (const [url, status] of [['https://google-login-example.com', 'Review'], ['http://google-login-example.com', 'High Attention']]) {
    assert.equal(adviseReputation(analyzeUrl(url), report).status, status);
  }
});
test('one suspicious verdict produces Review and several flags remain Review without strong local deception', () => {
  for (const changes of [{ suspicious: 1 }, { malicious: 8 }, { malicious: 2, suspicious: 1 }]) {
    const advice = adviseReputation(analyzeUrl(tab().url), normalizeReport(payload(changes), 'accounts.google.com'));
    assert.equal(advice.status, 'Review'); assert.match(advice.label, /engines flagged/);
  }
});
test('at least three malicious verdicts plus brand mismatch and username syntax may reach High Attention', () => {
  const local = analyzeUrl('https://user@google-login-example.com');
  assert.equal(adviseReputation(local, normalizeReport(payload({ malicious: 3 }), 'accounts.google.com')).status, 'High Attention');
  assert.equal(adviseReputation(local, normalizeReport(payload({ malicious: 2 }), 'accounts.google.com')).status, 'Review');
});

test('domain GET sends only hostname and header key over HTTPS with no cookies, body or referrer', async () => {
  let calls = 0;
  const result = await lookupDomain('accounts.google.com', sampleKey, { request: async (url, options) => {
    calls++; assert.equal(url, 'https://www.virustotal.com/api/v3/domains/accounts.google.com');
    assert.equal(options.method, 'GET'); assert.equal(options.headers['x-apikey'], sampleKey);
    assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
    assert.equal(options.redirect, 'error'); assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(options.body, undefined); return response();
  } });
  assert.equal(calls, 1); assert.equal(result.kind, 'report'); assert.doesNotMatch(JSON.stringify(result), new RegExp(sampleKey));
});
test('no key, malformed domain and already cancelled request never reach the network adapter', async () => {
  let calls = 0; const request = async () => { calls++; return response(); }; const controller = new AbortController(); controller.abort();
  assert.equal((await lookupDomain('accounts.google.com', '', { request })).kind, 'no-key');
  assert.equal((await lookupDomain('accounts.google.com?private', sampleKey, { request })).kind, 'invalid-domain');
  assert.equal((await lookupDomain('accounts.google.com', sampleKey, { request, signal: controller.signal })).kind, 'cancelled');
  assert.equal(calls, 0);
});
for (const [status, kind] of [[400, 'invalid-request'], [401, 'invalid-key'], [403, 'restricted'], [404, 'not-found'],
  [500, 'server-error'], [503, 'server-error'], [302, 'invalid-response']]) {
  test(`API ${status} produces fixed ${kind} guidance without response secrets or retry`, async () => {
    let calls = 0; const result = await lookupDomain('accounts.google.com', sampleKey, { request: async () => {
      calls++; return response(status, { error: { message: sampleKey } });
    } });
    assert.deepEqual(result, { kind }); assert.equal(calls, 1); assert.doesNotMatch(JSON.stringify(result), new RegExp(sampleKey));
  });
}
test('API 429 parses only quota kind and bounded cooldown, never error text', async () => {
  const result = await lookupDomain('accounts.google.com', sampleKey, { request: async () => response(429,
    { error: { code: 'QuotaExceededError', message: sampleKey } }, '120') });
  assert.deepEqual(result, { kind: 'rate-limit', quotaExceeded: true, retryAfterMs: 120000 });
});
test('API 429 without readable JSON or retry hint still enforces a minute cooldown', async () => {
  const result = await lookupDomain('accounts.google.com', sampleKey, { request: async () => ({ status: 429,
    json: async () => { throw new Error(sampleKey); } }) });
  assert.deepEqual(result, { kind: 'rate-limit', quotaExceeded: false, retryAfterMs: 60000 });
});
test('API 429 HTTP-date Retry-After is honored', async () => {
  const time = Date.UTC(2026, 9, 7); const result = await lookupDomain('accounts.google.com', sampleKey,
    { now: () => time, request: async () => response(429, {}, new Date(time + 120000).toUTCString()) });
  assert.equal(result.retryAfterMs, 120000);
});
test('network failure does not echo exception/key or retry', async () => {
  let calls = 0; const result = await lookupDomain('accounts.google.com', sampleKey, { request: async () => { calls++; throw new Error(sampleKey); } });
  assert.deepEqual(result, { kind: 'network-error' }); assert.equal(calls, 1);
});
test('malformed JSON and invalid API 200 schema return no report', async () => {
  for (const json of [async () => { throw new Error(sampleKey); }, async () => ({})]) {
    assert.deepEqual(await lookupDomain('accounts.google.com', sampleKey, { request: async () => ({ status: 200, json }) }), { kind: 'invalid-response' });
  }
});
test('finite timeout aborts once without automatic retry', async () => {
  let expire; let removed = false;
  const task = lookupDomain('accounts.google.com', sampleKey, { schedule: (callback, delay) => { assert.equal(delay, 12000); expire = callback; return 1; },
    unschedule: id => { assert.equal(id, 1); removed = true; }, request: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error(sampleKey)), { once: true });
    }) });
  expire(); assert.deepEqual(await task, { kind: 'network-error' }); assert.equal(removed, true);
});

const lookupMessage = () => ({ type: 'privacyLens:vt-lookup', hostname: 'accounts.google.com', tabId: 7, requestId: 'lookup-test', confirmed: true });
test('worker registration, status and tab changes never trigger automatic requests', async () => {
  const fixture = chromeFixture(); let calls = 0;
  const store = registerReputationWorker(fixture.api, { lookup: async () => { calls++; return { kind: 'report' }; } });
  await store.save(sampleKey, false); await fixture.message({ type: 'privacyLens:vt-status' });
  fixture.api.currentTab = { ...tab(), url: 'https://microsoft.com' }; await turn(); assert.equal(calls, 0);
});
test('explicit confirmation is required in the worker and no configured key sends nothing', async () => {
  const fixture = chromeFixture(); let calls = 0;
  registerReputationWorker(fixture.api, { lookup: async () => { calls++; } });
  assert.equal(await fixture.message({ ...lookupMessage(), confirmed: false }), undefined);
  assert.deepEqual(await fixture.message(lookupMessage()), { kind: 'no-key' }); assert.equal(calls, 0);
});
test('only own popup may lookup and only own options view may modify keys', async () => {
  const fixture = chromeFixture(); registerReputationWorker(fixture.api);
  for (const sender of [{ id: 'different', url: fixture.sender('popup').url }, { id: fixture.api.runtime.id, url: 'https://google.com' },
    { ...fixture.sender('popup'), tab: { incognito: true } }]) assert.equal(await fixture.message(lookupMessage(), 'popup', sender), undefined);
  assert.equal(await fixture.message(lookupMessage(), 'options'), undefined);
  assert.equal(await fixture.message({ type: 'privacyLens:vt-save-key', key: sampleKey, remember: false }), undefined);
  assert.deepEqual(await fixture.message({ type: 'privacyLens:vt-save-key', key: sampleKey, remember: false }, 'options'),
    { kind: 'key-status', configured: true, mode: 'session' });
});
test('changed tab/domain, incognito and denied optional host all prevent requests', async () => {
  const fixture = chromeFixture(); let calls = 0;
  const store = registerReputationWorker(fixture.api, { lookup: async () => { calls++; } }); await store.save(sampleKey, false);
  for (const current of [{ ...tab(), id: 8 }, { ...tab(), url: 'https://microsoft.com' }, { ...tab(), incognito: true }]) {
    fixture.api.currentTab = current; assert.deepEqual(await fixture.message(lookupMessage()), { kind: 'tab-changed' });
  }
  fixture.api.currentTab = tab(); fixture.api.granted = false;
  assert.deepEqual(await fixture.message(lookupMessage()), { kind: 'host-denied' }); assert.equal(calls, 0);
});
test('worker reads configured key internally, persists only anonymous counters and returns no credential', async () => {
  const fixture = chromeFixture(); let calls = 0; const report = normalizeReport(payload(), 'accounts.google.com');
  const store = registerReputationWorker(fixture.api, { now: () => DAY_MS, lookup: async (hostname, key) => {
    calls++; assert.equal(hostname, 'accounts.google.com'); assert.equal(key, sampleKey); return { kind: 'report', report };
  } }); await store.save(sampleKey, false);
  const result = await fixture.message(lookupMessage()); assert.deepEqual(result, { kind: 'report', report, transmission: 'shared' });
  assert.deepEqual(await fixture.message(lookupMessage()), { kind: 'rate-limit' }); assert.equal(calls, 1);
  assert.deepEqual(fixture.buffers.local, {});
  assert.deepEqual(Object.keys(fixture.buffers.session).sort(), [KEY_SLOT, QUOTA_SLOT].sort());
  assert.deepEqual(Object.keys(fixture.buffers.session[QUOTA_SLOT]).sort(), ['day', 'count', 'nextAt', 'blockedUntil'].sort());
  assert.doesNotMatch(JSON.stringify(fixture.operations), /google|report|private-query/);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(sampleKey));
});
test('worker honors 429 without retrying and enforces cooldown after recreation', async () => {
  const fixture = chromeFixture(); let calls = 0; const dependencies = { now: () => DAY_MS + 1000,
    lookup: async () => { calls++; return { kind: 'rate-limit', retryAfterMs: 60000, quotaExceeded: true }; } };
  await registerReputationWorker(fixture.api, dependencies).save(sampleKey, false);
  assert.deepEqual(await fixture.message(lookupMessage()), { kind: 'rate-limit', transmission: 'shared' });
  registerReputationWorker(fixture.api, dependencies); assert.deepEqual(await fixture.message(lookupMessage()), { kind: 'rate-limit' }); assert.equal(calls, 1);
});
test('worker cancellation and Forget abort in-flight lookup without restoring a closed result', async () => {
  for (const action of ['privacyLens:vt-cancel', 'privacyLens:vt-forget-key']) {
    const fixture = chromeFixture(); let finish; let signal;
    const store = registerReputationWorker(fixture.api, { lookup: async (_host, _key, options) => {
      signal = options.signal; return new Promise(resolve => { finish = resolve; });
    } }); await store.save(sampleKey, false); const task = fixture.message(lookupMessage()); await turn();
    await fixture.message({ type: action, requestId: 'lookup-test' }, action.endsWith('forget-key') ? 'options' : 'popup');
    assert.equal(signal.aborted, true); finish({ kind: 'report', report: normalizeReport(payload(), 'accounts.google.com') });
    assert.deepEqual(await task, { kind: 'cancelled', transmission: 'shared' });
  }
});
test('worker permits only one pending request and leaks no raw exception', async () => {
  const fixture = chromeFixture(); let finish;
  const store = registerReputationWorker(fixture.api, { lookup: async () => new Promise((_resolve, reject) => { finish = reject; }) });
  await store.save(sampleKey, false); const task = fixture.message(lookupMessage()); await turn();
  assert.deepEqual(await fixture.message(lookupMessage()), { kind: 'busy' }); finish(new Error(sampleKey));
  assert.deepEqual(await task, { kind: 'unavailable', transmission: 'possible' });
});
test('unsupported optional storage support leaves local features untouched', async () => {
  const fixture = chromeFixture(); delete fixture.api.storage.session;
  assert.equal(registerReputationWorker(fixture.api), null); assert.deepEqual(await fixture.message({ type: 'privacyLens:vt-status' }), { kind: 'unavailable' });
});

class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.hidden = true; this.value = ''; this.checked = false; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text ?? '') + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
function documentFixture() {
  const ids = ['vt-result', 'vt-consent', 'vt-hostname', 'vt-check', 'vt-confirm', 'vt-key', 'remember-key',
    'key-status', 'save-key', 'forget-key', 'domain', 'scheme', 'status', 'summary', 'findings', 'result',
    'permissions-context', 'permission-notes', 'site-permissions'];
  const elements = new Map(ids.map(id => [id, new Element()]));
  return { getElementById: id => elements.get(id), createElement: tag => new Element(tag),
    createTextNode: value => { const element = new Element(); element.textContent = value; return element; } };
}
function uiFixture(configured = true) {
  const fixture = chromeFixture(); const document = documentFixture(); const messages = []; let grants = 0;
  fixture.api.runtime.sendMessage = (value, callback) => { messages.push(value); callback(value.type === 'privacyLens:vt-status'
    ? { kind: 'key-status', configured, mode: configured ? 'session' : 'none' }
    : { kind: 'report', report: normalizeReport(payload({ suspicious: 1 }), 'accounts.google.com') }); };
  fixture.api.permissions.request = async details => { grants++; assert.deepEqual(details, { origins: [VT_ORIGIN] }); return fixture.api.granted; };
  return { ...fixture, document, messages, grants: () => grants };
}
test('UI initialization and confirmation without an initial click do nothing', async () => {
  const { api, document, messages, grants } = uiFixture(); const controller = createReputationController(api, document);
  await controller.confirm(); await turn(); assert.deepEqual(messages, []); assert.equal(grants(), 0);
});
test('first click selects sanitized hostname and shows consent without lookup or host request', async () => {
  const { api, document, messages, grants } = uiFixture(); await createReputationController(api, document).begin();
  assert.equal(document.getElementById('vt-hostname').textContent, 'accounts.google.com');
  assert.equal(document.getElementById('vt-consent').hidden, false);
  assert.deepEqual(messages.map(value => value.type), ['privacyLens:vt-status']); assert.equal(grants(), 0);
});
test('no-key first click gives settings guidance and never requests host permission', async () => {
  const { api, document, messages, grants } = uiFixture(false); const controller = createReputationController(api, document);
  await controller.begin(); await controller.confirm(); assert.match(document.getElementById('vt-result').textContent, /Add your own VirusTotal key in settings/);
  assert.equal(document.getElementById('vt-consent').hidden, true); assert.equal(messages.length, 1); assert.equal(grants(), 0);
});
test('second explicit confirmation grants exact optional host, sends only selected hostname and renders counts', async () => {
  const { api, document, messages, grants } = uiFixture(); let report;
  const controller = createReputationController(api, document, { onReport: value => { report = value; } });
  await controller.begin(); await controller.confirm(); assert.equal(grants(), 1);
  const request = messages.find(value => value.type === 'privacyLens:vt-lookup');
  assert.deepEqual(Object.keys(request).sort(), ['type', 'hostname', 'tabId', 'confirmed', 'requestId'].sort());
  assert.equal(request.hostname, 'accounts.google.com'); assert.equal(request.confirmed, true);
  assert.doesNotMatch(JSON.stringify(request), /login|private-query|private-fragment/);
  assert.match(document.getElementById('vt-result').textContent, /A few VirusTotal engines.*Malicious0Suspicious1Harmless72Undetected15/);
  assert.match(document.getElementById('vt-result').textContent, /does not guarantee safety/); assert.equal(report.hostname, request.hostname);
});
test('cancelling disclosure and denying host grant both avoid sending a lookup', async () => {
  for (const cancel of [true, false]) {
    const { api, document, messages } = uiFixture(); const controller = createReputationController(api, document);
    await controller.begin(); if (cancel) controller.cancel(); else api.granted = false;
    await controller.confirm(); assert.equal(messages.some(value => value.type === 'privacyLens:vt-lookup'), false);
  }
});
test('private/restricted tabs never show lookup consent or read configuration', async () => {
  const fixture = uiFixture(); fixture.api.currentTab.incognito = true;
  await createReputationController(fixture.api, fixture.document).begin(); assert.deepEqual(fixture.messages, []);
  assert.match(fixture.document.getElementById('vt-result').textContent, /private tabs/);
});
test('changed domain before response discards reputation and cannot initiate a new lookup', async () => {
  const fixture = uiFixture(); let reply; fixture.api.runtime.sendMessage = (value, callback) => {
    fixture.messages.push(value); if (value.type.endsWith('status')) callback({ kind: 'key-status', configured: true }); else reply = callback;
  };
  const controller = createReputationController(fixture.api, fixture.document); await controller.begin(); const task = controller.confirm(); await turn();
  fixture.api.currentTab.url = 'https://microsoft.com'; reply({ kind: 'report', report: normalizeReport(payload(), 'accounts.google.com') }); await task;
  assert.match(fixture.document.getElementById('vt-result').textContent, /hostname changed/);
  assert.equal(fixture.messages.filter(value => value.type.endsWith('lookup')).length, 1);
});
test('closing popup cancels pending operation and prevents a late report from restoring its contents', async () => {
  const fixture = uiFixture(); let reply; const lifecycle = new AbortController(); let report;
  fixture.api.runtime.sendMessage = (value, callback) => {
    fixture.messages.push(value); if (value.type.endsWith('status')) callback({ kind: 'key-status', configured: true });
    else if (value.type.endsWith('cancel')) callback({ kind: 'cancelled' }); else reply = callback;
  };
  const controller = createReputationController(fixture.api, fixture.document, { signal: lifecycle.signal, onReport: value => { report = value; } });
  await controller.begin(); const task = controller.confirm(); await turn(); lifecycle.abort(); controller.clear();
  reply({ kind: 'report', report: normalizeReport(payload(), 'accounts.google.com') }); await task;
  assert.equal(fixture.document.getElementById('vt-result').textContent, ''); assert.equal(report, null);
  assert.ok(fixture.messages.some(value => value.type.endsWith('cancel')));
});
test('reopening has no response cache; next first click reads key metadata only', async () => {
  const fixture = uiFixture(); const controller = createReputationController(fixture.api, fixture.document);
  await controller.begin(); await controller.confirm(); controller.clear();
  await createReputationController(fixture.api, fixture.document).begin();
  assert.equal(fixture.document.getElementById('vt-result').textContent, '');
  assert.equal(fixture.messages.filter(value => value.type.endsWith('lookup')).length, 1);
});
test('malformed and unknown message responses render only fixed safe errors', async () => {
  const { api, document } = uiFixture(); api.runtime.sendMessage = (value, callback) => callback(value.type.endsWith('status')
    ? { kind: 'key-status', configured: true } : { kind: 'constructor', error: sampleKey });
  const controller = createReputationController(api, document); await controller.begin(); await controller.confirm();
  assert.match(document.getElementById('vt-result').textContent, /could not read.*no result to show/);
  assert.doesNotMatch(document.getElementById('vt-result').textContent, new RegExp(sampleKey));
  showReputationMessage(document, '__proto__'); assert.match(document.getElementById('vt-result').textContent, /could not read.*no result to show/);
});
test('options status never returns or prefills a key; Save is explicit session mode by default', async () => {
  const fixture = uiFixture(false); const controller = createOptionsController(fixture.api, fixture.document);
  fixture.api.runtime.sendMessage = (value, callback) => { fixture.messages.push(value); callback({ kind: 'key-status', configured: value.type.endsWith('save-key'), mode: value.type.endsWith('save-key') ? 'session' : 'none' }); };
  await controller.load(); assert.equal(fixture.document.getElementById('vt-key').value, '');
  fixture.document.getElementById('vt-key').value = sampleKey; await controller.save();
  assert.equal(fixture.document.getElementById('vt-key').value, ''); assert.equal(fixture.messages.at(-1).remember, false);
  assert.match(fixture.document.getElementById('key-status').textContent, /session memory/);
  assert.equal(fixture.messages.some(value => value.type.endsWith('lookup')), false);
});
test('Remember must be checked in options; Forget sends removal only and clears the input', async () => {
  const fixture = uiFixture(); const controller = createOptionsController(fixture.api, fixture.document);
  fixture.document.getElementById('vt-key').value = sampleKey; fixture.document.getElementById('remember-key').checked = true;
  await controller.save(); assert.equal(fixture.messages.at(-1).remember, true);
  fixture.document.getElementById('vt-key').value = sampleKey; await controller.forget();
  assert.deepEqual(fixture.messages.at(-1), { type: 'privacyLens:vt-forget-key' }); assert.equal(fixture.document.getElementById('vt-key').value, '');
  assert.equal(fixture.document.getElementById('remember-key').checked, false);
});
test('options rejects invalid key without any message and ignores late status after closing', async () => {
  const fixture = uiFixture(); const lifecycle = new AbortController(); const controller = createOptionsController(fixture.api, fixture.document, { signal: lifecycle.signal });
  fixture.document.getElementById('vt-key').value = 'tiny'; await controller.save(); assert.equal(fixture.messages.length, 0);
  let reply; fixture.api.runtime.sendMessage = (_value, callback) => { reply = callback; };
  const task = controller.load(); lifecycle.abort(); controller.clear(); reply({ kind: 'key-status', configured: true, mode: 'remembered' }); await task;
  assert.equal(fixture.document.getElementById('key-status').textContent, '');
});
test('reputation counts are text-only and do not replace site-permission Review with a clean report', () => {
  const document = documentFixture(); const local = analyzeUrl(tab().url);
  const advice = adviseReputation(local, normalizeReport(payload(), 'accounts.google.com'));
  renderResult(document, local, { status: 'Review', permissions: [], notes: [] }, { status: 'Normal' }, advice);
  assert.equal(document.getElementById('status').textContent, 'Review');
  renderReputation(document, normalizeReport(payload(), 'accounts.google.com'), advice);
  assert.match(document.getElementById('vt-result').textContent, /What these results mean.*local findings still apply/);
  assert.doesNotMatch(document.getElementById('vt-result').textContent, /Closing this popup/);
});
test('combined High Attention explains several signals without assuming HTTP', () => {
  const document = documentFixture(); const local = analyzeUrl('https://user@google-login-example.com');
  const external = adviseReputation(local, normalizeReport(payload({ malicious: 3 }), 'accounts.google.com'));
  renderResult(document, local, undefined, undefined, external);
  assert.equal(document.getElementById('status').textContent, 'High Attention');
  assert.doesNotMatch(document.getElementById('summary').textContent, /HTTP appears/);
});
test('static integration has one fixed GET adapter, no automatic lookup, submission, sync or secret logging', async () => {
  const source = name => readFile(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const [client, controller, worker, store, popup, options] = await Promise.all([
    source('reputation/virustotal-client.js'), source('reputation/reputation-controller.js'), source('reputation/reputation-worker.js'),
    source('reputation/key-store.js'), source('popup/popup.js'), source('options/options.js')]);
  assert.equal((client.match(/globalThis\.fetch/g) ?? []).length, 1);
  assert.match(client, /method: 'GET'/); assert.match(client, /api\/v3\/domains\//);
  assert.doesNotMatch(client, /method: '(?:POST|PUT|PATCH|DELETE)'|\/urls\/|\/files\/|\/analyse|\/rescan/);
  for (const text of [client, controller, worker, store, popup, options]) assert.doesNotMatch(text,
    /console\.|storage\.sync|localStorage|indexedDB|sendBeacon|WebSocket|XMLHttpRequest|tabs\.onUpdated|tabs\.onActivated/);
  assert.match(popup, /'vt-check'\)\.addEventListener\('click'/); assert.match(popup, /'vt-confirm'\)\.addEventListener\('click'/);
  assert.doesNotMatch(popup, /void reputationCheck\.(?:begin|confirm)\(\);/);
  assert.match(store, /remember \? areas\.local : areas\.session/);
  assert.doesNotMatch(store, /\b(?:hostname|domain|report|findings)\b/);
});
