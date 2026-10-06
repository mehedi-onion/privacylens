import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { collectPageMetadata } from '../src/page/page-collector.js';
import { analyzePageMetadata } from '../src/page/page-analyzer.js';
import { readCurrentPage } from '../src/page/page-reader.js';
import { createPageScanController } from '../src/page/page-controller.js';
import brands from '../data/official-domains.js';

// Read traps enforce the privacy boundary for every collector test below.
const allowedAttributes = new Set(['type', 'autocomplete', 'action', 'method', 'formaction', 'formmethod', 'href', 'src']);
class Node {
  constructor(attributes = {}, options = {}) { this.attributes = attributes; Object.assign(this, options); }
  getAttribute(name) { assert.ok(allowedAttributes.has(name), `Unexpected attribute read: ${name}`); return this.attributes[name] ?? null; }
  hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }
  get value() { assert.fail('Input value must NEVER be read'); }
  get defaultValue() { assert.fail('Default input value must NEVER be read'); }
  get textContent() { assert.fail('Form/page contents must NEVER be read'); }
  get innerHTML() { assert.fail('HTML must NEVER be serialized'); }
  get outerHTML() { assert.fail('HTML must NEVER be serialized'); }
  get contentDocument() { assert.fail('Frame documents must NEVER be read'); }
  get innerText() {
    assert.ok(!this.inForm && !this.nestedControl && !this.editable && !this.hidden, 'Do not read an ineligible link label');
    return this.label ?? '';
  }
  getClientRects() { return this.hidden ? [] : [{}]; }
  closest() { return this.inForm || this.editable ? this : null; }
  querySelector() { return this.nestedControl ? this : null; }
}
const field = (attributes = {}) => new Node({ value: 'PRIVATE_INPUT_SENTINEL', ...attributes });
const form = (action = '', elements = [], attributes = {}) => new Node({ action, ...attributes }, { elements });
const link = (href, label = '', options = {}) => new Node({ href }, { label, ...options });
function page({ address = 'https://example.com/path', base = address, forms = [], inputs = forms.flatMap(item => item.elements), links = [], frames = [], resources = [] } = {}) {
  const doc = { forms, baseURI: base, defaultView: { getComputedStyle: () => ({ visibility: 'visible' }) },
    querySelectorAll(selector) {
      const lists = { input: inputs, 'a[href]': links, iframe: frames,
        'script[src], img[src], link[href], source[src], video[src], audio[src]': resources };
      assert.ok(Object.prototype.hasOwnProperty.call(lists, selector), selector);
      return lists[selector];
    } };
  return { doc, address };
}
function metadata(options = {}) { const { doc, address } = page(options); return collectPageMetadata(brands.map(brand => brand.name), doc, address); }
const analysis = options => analyzePageMetadata(metadata(options));
const has = (result, id) => result.findings.some(finding => finding.id === id);

test('simple page without forms stays Normal', () => {
  const result = analysis();
  assert.equal(result.status, 'Normal');
  assert.equal(result.reviewCount, 0);
  assert.deepEqual(result.findings, []);
});
test('normal same-origin password/login form on accounts.google.com stays Normal', () => {
  const result = analysis({ address: 'https://accounts.google.com/login', forms: [form('/signin', [field({ type: 'password' })])] });
  assert.equal(result.status, 'Normal');
  assert.ok(has(result, 'password-fields'));
  assert.ok(has(result, 'authentication-forms'));
  assert.match(result.findings[0].detected, /Password forms with only same-origin HTTP\/HTTPS destinations: 1/);
});
test('cross-origin login form receives Review and an explicit destination explanation', () => {
  const result = analysis({ forms: [form('https://login-provider.example/authorize', [field({ type: 'password' })])] });
  assert.equal(result.status, 'Review');
  assert.ok(has(result, 'sensitive-cross-origin-form'));
  assert.match(result.findings.find(item => item.id === 'cross-origin-form').detected, /login-provider.example/);
});
test('password field outside a form is informational, never High Attention', () => {
  const result = analysis({ inputs: [field({ type: 'password' })] });
  assert.equal(result.status, 'Normal');
  assert.ok(has(result, 'password-fields'));
});
test('same-origin payment-like form is normal and does not imply misuse', () => {
  const result = analysis({ forms: [form('/checkout', [field({ type: 'text', autocomplete: 'cc-number' })])] });
  assert.equal(result.status, 'Normal');
  assert.ok(has(result, 'payment-forms'));
});
test('cross-origin payment-like form receives Review without an abuse verdict', () => {
  const result = analysis({ forms: [form('https://processor.example/pay', [field({ autocomplete: 'cc-csc' })])] });
  assert.equal(result.status, 'Review');
  assert.ok(has(result, 'sensitive-cross-origin-form'));
  assert.doesNotMatch(JSON.stringify(result), /card skimming|credential theft|confirmed phishing|steals|spyware/);
});
test('authentication autocomplete hints are structural, and email alone is not called login', () => {
  assert.ok(has(analysis({ forms: [form('', [field({ autocomplete: 'one-time-code' })])] }), 'authentication-forms'));
  assert.equal(has(analysis({ forms: [form('', [field({ type: 'email' })])] }), 'authentication-forms'), false);
});
test('every cross-origin form is explained even without sensitive controls', () => {
  const result = analysis({ forms: [form('https://search.example/query', [field({ type: 'search' })])] });
  assert.equal(result.status, 'Review');
  assert.ok(has(result, 'cross-origin-form'));
  assert.equal(has(result, 'sensitive-cross-origin-form'), false);
});
test('relative and empty actions resolve correctly, including an external base element', () => {
  assert.equal(analysis({ forms: [form('/login', [field({ type: 'password' })])] }).status, 'Normal');
  const raw = metadata({ base: 'https://other.example/base/', forms: [form(''), form('signin')] });
  assert.equal(raw.forms[0].destinations[0].origin, 'https://example.com');
  assert.equal(raw.forms[1].destinations[0].origin, 'https://other.example');
  assert.ok(has(analyzePageMetadata(raw), 'cross-origin-form'));
});
test('submit-button action overrides and dialog methods are handled structurally', () => {
  const result = analysis({ forms: [form('', [field({ type: 'password' }), field({ type: 'submit', formaction: 'https://other.example/send' })])] });
  assert.ok(has(result, 'sensitive-cross-origin-form'));
  assert.equal(analysis({ forms: [form('https://other.example', [], { method: 'dialog' })] }).status, 'Normal');
});
test('matching visible domain labels and legitimate subdomains stay Normal', () => {
  for (const [label, href] of [['paypal.com', 'https://paypal.com/pay'], ['paypal.com', 'https://www.paypal.com/pay'], ['accounts.google.com', 'https://accounts.google.com/signin']]) {
    assert.equal(analysis({ links: [link(href, label)] }).status, 'Normal');
  }
});
test('paypal.com label pointing elsewhere receives Review', () => {
  const result = analysis({ links: [link('https://unrelated-domain.example/path', 'paypal.com')] });
  assert.equal(result.status, 'Review');
  assert.ok(has(result, 'misleading-link'));
  assert.ok(has(result, 'link-brand-reference'));
});
test('plain brand labels and brand-like destination hostnames have local review explanations', () => {
  assert.ok(has(analysis({ links: [link('https://unrelated.example', 'PayPal')] }), 'link-brand-reference'));
  assert.ok(has(analysis({ links: [link('https://bkash-login-example.com', 'Continue')] }), 'link-brand-mismatch'));
});
test('shortener, public IP and punycode link signals reuse the URL analyzer', () => {
  for (const [href, id] of [['https://bit.ly/example', 'link-shortener'], ['https://8.8.8.8/path', 'link-ip-address'], ['https://xn--pple-43d.com', 'link-punycode']]) {
    const result = analysis({ links: [link(href)] });
    assert.equal(result.status, 'Review');
    assert.ok(has(result, id));
  }
});
test('malformed hrefs, javascript, mailto, tel and data links are safely ignored', () => {
  const result = analysis({ links: ['http://[broken', 'javascript:alert(1)', 'mailto:person@example.com', 'tel:+10000000', 'data:text/plain,example'].map(href => link(href)) });
  assert.equal(result.status, 'Normal');
  assert.equal(result.reviewCount, 0);
});
test('HTTP references on HTTPS get Review but ordinary HTTP-page links do not accumulate HTTP warnings', () => {
  assert.ok(has(analysis({ links: [link('http://other.example')] }), 'link-http'));
  assert.equal(has(analysis({ address: 'http://example.com', links: [link('http://other.example')] }), 'link-http'), false);
  assert.ok(has(analysis({ forms: [form('http://example.com/send')] }), 'http-form'));
});
test('cross-origin iframe source counts are informational and no frame documents are read', () => {
  const frames = [new Node({ src: '/frame' }), new Node({ src: 'https://other.example/embed' }), new Node({ src: '' }), new Node({ src: 'https://ignored.example', srcdoc: 'PRIVATE_INPUT_SENTINEL' })];
  const raw = metadata({ frames });
  assert.deepEqual(raw.frames, { inspected: 4, crossOrigin: 1, unknown: 2 });
  assert.equal(analyzePageMetadata(raw).status, 'Normal');
  assert.doesNotMatch(JSON.stringify(raw), /PRIVATE_INPUT_SENTINEL|ignored.example/);
});
test('many external resource hostnames are context, not proof of tracking', () => {
  const result = analysis({ resources: Array.from({ length: 25 }, (_, i) => new Node({ src: `https://cdn${i}.example/resource` })) });
  assert.equal(result.status, 'Normal');
  assert.ok(has(result, 'external-hosts'));
  assert.match(result.findings[0].why, /do not prove requests happened/);
});
test('typed/default password, text, email, card and textarea values are never accessed or returned', () => {
  const controls = [field({ type: 'password' }), field({ type: 'text' }), field({ type: 'email' }), field({ autocomplete: 'cc-number' }), field({ autocomplete: 'off' })];
  const raw = metadata({ forms: [form('/send?private-query', controls)], inputs: controls });
  assert.doesNotMatch(JSON.stringify(raw), /PRIVATE_INPUT_SENTINEL|private-query|value/);
  assert.doesNotMatch(JSON.stringify(analyzePageMetadata(raw)), /PRIVATE_INPUT_SENTINEL|private-query/);
});
test('form, editable, hidden and nested-control link labels are never read', () => {
  const raw = metadata({ links: [link('https://other.example', 'PRIVATE_INPUT_SENTINEL', { inForm: true }),
    link('https://other.example', 'PRIVATE_INPUT_SENTINEL', { editable: true }),
    link('https://other.example', 'PRIVATE_INPUT_SENTINEL', { nestedControl: true }),
    link('https://other.example', 'PRIVATE_INPUT_SENTINEL', { hidden: true })] });
  assert.equal(raw.links.length, 1);
  assert.equal(raw.links[0].claimedHost, null);
  assert.doesNotMatch(JSON.stringify(raw), /PRIVATE_INPUT_SENTINEL/);
});
test('URL credentials, paths, queries, fragments and raw link labels are not returned', () => {
  const raw = metadata({ address: 'https://example.com/private-path?private-query#private-fragment',
    links: [link('https://user:private-test-value@other.example/private-path?private-query#private-fragment', 'Ordinary private label')] });
  assert.equal(raw.links[0].origin, 'https://other.example');
  assert.equal(raw.links[0].hasUserInfo, true);
  assert.doesNotMatch(JSON.stringify(raw), /private-test-value|private-path|private-query|private-fragment|Ordinary private label/);
});
test('repeated destinations are deduplicated while distinct domain claims are preserved', () => {
  const raw = metadata({ links: [link('https://other.example/a'), link('https://other.example/b'), link('https://other.example/a', 'paypal.com')] });
  assert.equal(raw.links.length, 2);
  assert.equal(raw.linksInspected, 3);
  assert.ok(has(analyzePageMetadata(raw), 'misleading-link'));
});
test('large pages obey explicit caps and report partial coverage', () => {
  const raw = metadata({ links: Array.from({ length: 1000 }, (_, i) => link(`https://host${i}.example`)),
    forms: Array.from({ length: 70 }, () => form()), inputs: Array.from({ length: 500 }, () => field()), frames: Array.from({ length: 150 }, () => new Node({ src: '/frame' })) });
  assert.equal(raw.links.length, 200);
  assert.equal(raw.linksInspected, 400);
  assert.equal(raw.forms.length, 50);
  assert.equal(raw.frames.inspected, 100);
  assert.equal(raw.externalHostCount, 100);
  assert.equal(raw.capped, true);
  assert.ok(has(analyzePageMetadata(raw), 'scan-capped'));
});
test('High Attention requires several connected signals at the same destination', () => {
  const target = 'http://paypal-login-example.com';
  const result = analysis({ forms: [form(target, [field({ type: 'password' })])], links: [link(target, 'paypal.com')] });
  assert.equal(result.status, 'High Attention');
  assert.ok(has(result, 'page-combination'));
  assert.equal(analysis({ links: [link(target, 'paypal.com')] }).status, 'Review');
  assert.equal(analysis({ forms: [form('http://different.example', [field({ type: 'password' })])], links: [link(target, 'paypal.com')] }).status, 'Review');
});
test('serialized collector runs without imported helpers or enclosing scope', () => {
  const { doc, address } = page({ forms: [form('', [field({ type: 'password' })])] });
  const raw = runInNewContext(`(${collectPageMetadata.toString()})`, { document: doc, location: { href: address }, URL })(brands.map(brand => brand.name));
  assert.equal(raw.passwordFields, 1);
});
test('malformed snapshot data fails safely without echoing arbitrary fields', () => {
  for (const raw of [null, {}, { ...metadata(), forms: null }, { ...metadata(), passwordFields: 'yes' },
    { ...metadata(), links: [{ origin: 'https://other.example', claimedHost: '<script>', claimedBrands: [], hasUserInfo: false }] },
    { ...metadata(), links: [{ origin: 'https://other.example', claimedHost: null, claimedBrands: new Array(1), hasUserInfo: false }] },
    { ...metadata(), forms: [{ password: true, authentication: true, payment: false, destinations: [] }] },
    { ...metadata(), frames: { inspected: 0, crossOrigin: 3, unknown: 0 } }]) {
    assert.equal(analyzePageMetadata(raw).available, false);
  }
  assert.doesNotMatch(JSON.stringify(analyzePageMetadata({ ...metadata(), value: 'PRIVATE_INPUT_SENTINEL' })), /PRIVATE_INPUT_SENTINEL/);
});

function chromeFixture(raw = metadata()) {
  const calls = [];
  const scripting = new Proxy({ executeScript: async options => {
    calls.push(options);
    assert.deepEqual(options.target, { tabId: 7 });
    assert.equal(options.func, collectPageMetadata);
    assert.deepEqual(options.args, [brands.map(brand => brand.name)]);
    assert.deepEqual(Object.keys(options).sort(), ['args', 'func', 'target']);
    return [{ frameId: 0, result: raw }];
  } }, { get(target, key) { assert.equal(key, 'executeScript', 'No other scripting API allowed'); return target[key]; } });
  return { calls, api: { tabs: { query: async options => { assert.deepEqual(options, { active: true, currentWindow: true }); return [{ id: 7, url: 'https://example.com' }]; } }, scripting } };
}
test('reader injects exactly once in the current top frame using only executeScript', async () => {
  const { api, calls } = chromeFixture();
  assert.equal((await readCurrentPage(api)).available, true);
  assert.equal(calls.length, 1);
});
test('restricted tabs and absent API fail safely without injection', async () => {
  for (const tab of [undefined, {}, { id: 7, url: 'chrome://extensions' }, { id: 7, url: 'file:///tmp/example.html' }]) {
    const result = await readCurrentPage({ tabs: { query: async () => tab ? [tab] : [] }, scripting: { executeScript: () => assert.fail('No injection') } });
    assert.equal(result.available, false);
  }
});
test('Chrome API errors, malformed injection results and navigation races fail safely', async () => {
  for (const response of [null, [], [{ frameId: 1, result: metadata() }], [{ frameId: 0, result: metadata({ address: 'https://changed.example' }) }], [{ frameId: 0, result: null }]]) {
    const { api } = chromeFixture();
    api.scripting = { executeScript: async () => response };
    assert.equal((await readCurrentPage(api)).available, false);
  }
  const { api } = chromeFixture();
  api.scripting = { executeScript: async () => { throw new Error('PRIVATE_INPUT_SENTINEL'); } };
  const result = await readCurrentPage(api);
  assert.equal(result.available, false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_INPUT_SENTINEL/);
});

class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; }
  set textContent(text) { this.text = text; this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(name, text) { this.attributes[name] = text; }
}
function view() {
  const elements = new Map(['page-scan', 'scan-page', 'page-scan-summary', 'page-scan-status', 'page-scan-findings'].map(id => [id, new Element()]));
  return { getElementById: id => elements.get(id), createElement: tag => new Element(tag), createTextNode: text => { const node = new Element(); node.textContent = text; return node; } };
}
test('controller does nothing before explicit scan and renders only text explanations', async () => {
  const doc = view();
  const { api, calls } = chromeFixture(metadata({ links: [link('https://other.example', 'paypal.com')] }));
  const controller = createPageScanController(api, doc);
  assert.equal(calls.length, 0);
  await controller.scan();
  assert.equal(calls.length, 1);
  assert.equal(doc.getElementById('page-scan-status').textContent, 'Review');
  assert.match(doc.getElementById('page-scan-findings').textContent, /What was noticed.*Why this matters.*Consider/);
  assert.equal(doc.getElementById('scan-page').disabled, false);
});
test('repeated scans replace results and clearing removes the snapshot', async () => {
  const doc = view();
  const { api } = chromeFixture(metadata({ links: [link('https://bit.ly/example')] }));
  const controller = createPageScanController(api, doc);
  await controller.scan();
  api.scripting = { executeScript: async () => [{ frameId: 0, result: metadata() }] };
  await controller.scan();
  assert.equal(doc.getElementById('page-scan-status').textContent, 'Normal');
  assert.doesNotMatch(doc.getElementById('page-scan-findings').textContent, /shortener/);
  controller.clear();
  for (const id of ['page-scan-summary', 'page-scan-status', 'page-scan-findings']) assert.equal(doc.getElementById(id).textContent, '');
});
test('closing during an injection prevents late results from repainting', async () => {
  const doc = view();
  const lifecycle = new AbortController();
  const { api } = chromeFixture();
  let finish;
  api.scripting = { executeScript: () => new Promise(resolve => { finish = resolve; }) };
  const controller = createPageScanController(api, doc, { signal: lifecycle.signal });
  const pending = controller.scan();
  await new Promise(resolve => setImmediate(resolve));
  lifecycle.abort();
  controller.clear();
  finish([{ frameId: 0, result: metadata() }]);
  await pending;
  assert.equal(doc.getElementById('page-scan-summary').textContent, '');
  await controller.scan();
  assert.equal(doc.getElementById('page-scan-summary').textContent, '');
});
test('collector static guard forbids value reads, serialization, form submission, networking and DOM mutation', async () => {
  const source = await readFile(new URL('../src/page/page-collector.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.(?:value|defaultValue|textContent|innerHTML|outerHTML|contentDocument|contentWindow)\b|getAttribute\(['"]value|\b(?:FormData|fetch|XMLHttpRequest|WebSocket|sendBeacon|MutationObserver|setInterval)\b|\.(?:submit|requestSubmit|setAttribute|append|remove|dispatchEvent)\s*\(/);
  const reader = await readFile(new URL('../src/page/page-reader.js', import.meta.url), 'utf8');
  assert.deepEqual([...reader.matchAll(/chromeApi\.scripting\??\.(\w+)/g)].map(match => match[1]), ['executeScript', 'executeScript']);
  assert.doesNotMatch(reader, /registerContentScripts|insertCSS|removeCSS|allFrames\s*:|world\s*:|addListener/);
});
