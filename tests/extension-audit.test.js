import test from 'node:test';
import assert from 'node:assert/strict';
import { extensionPermissionCatalog, explainExtensionPermission } from '../src/extensions/permission-catalog.js';
import { explainHostPattern } from '../src/extensions/host-patterns.js';
import { prepareInventory, adviseExtension, filterExtensions } from '../src/extensions/extension-advisor.js';
import { readInstalledExtensions } from '../src/extensions/extension-reader.js';
import { createAuditController } from '../src/extensions/extensions.js';

const extension = (overrides = {}) => ({ id: 'other-id', name: 'Simple Notes', type: 'extension',
  enabled: true, version: '1.0', installType: 'normal', permissions: [], hostPermissions: [], ...overrides });
const advice = overrides => adviseExtension(prepareInventory([extension(overrides)], 'self-id').items[0]);

function readOnlyChrome(items = [], warnings = []) {
  const calls = [];
  const management = new Proxy({
    getAll: async () => { calls.push('getAll'); return items; },
    getPermissionWarningsById: async id => { calls.push(['warnings', id]); return warnings; }
  }, { get(target, key) {
    assert.ok(['getAll', 'getPermissionWarningsById'].includes(key), `Unexpected management access: ${String(key)}`);
    return target[key];
  } });
  return { api: { runtime: { id: 'self-id' }, management }, calls };
}

test('permission catalog explains every requested capability with uses and advice', () => {
  for (const name of ['tabs', 'history', 'cookies', 'downloads', 'bookmarks', 'clipboardRead', 'clipboardWrite', 'geolocation', 'management', 'webRequest', 'webNavigation', 'notifications', 'storage', 'scripting', 'debugger', 'proxy', 'nativeMessaging']) {
    assert.ok(extensionPermissionCatalog[name], name);
    const detail = explainExtensionPermission(name);
    for (const field of ['what', 'uses', 'recommendation']) assert.ok(detail[field].length > 15, `${name}.${field}`);
    assert.doesNotMatch(JSON.stringify(detail), /spyware|steals|malicious/);
  }
});

test('unknown permission names, including object-property names, get an honest fallback', () => {
  for (const name of ['futureCapability', 'toString', '__proto__', 'constructor']) {
    const result = explainExtensionPermission(name);
    assert.equal(result.name, name);
    assert.match(result.what, /no detailed local explanation/);
  }
});

test('all_urls and all-host scheme patterns are interpreted as broad access', () => {
  for (const pattern of ['<all_urls>', 'http://*/*', 'https://*/*', '*://*/*', 'https://*:443/*', 'https://*/private*']) {
    const result = explainHostPattern(pattern);
    assert.equal(result.recognized, true, pattern);
    assert.equal(result.broad, true, pattern);
    assert.ok(result.explanation);
  }
});

test('specific domains, subdomains, ports and file patterns get scoped explanations', () => {
  for (const pattern of ['https://example.com/*', '*://*.example.com/*', 'http://localhost:3000/*', 'https://[::1]/*', 'file:///*']) {
    const result = explainHostPattern(pattern);
    assert.equal(result.recognized, true, pattern);
    assert.equal(result.broad, false, pattern);
    assert.match(result.recommendation, /ignores paths/);
  }
  assert.match(explainHostPattern('*://*.example.com/*').explanation, /example.com and its subdomains/);
  assert.match(explainHostPattern('file:///*').explanation, /separately controls/);
});

test('unsupported or malformed host patterns are not treated as known-safe scopes', () => {
  for (const pattern of [null, 4, '', 'not a pattern', 'chrome://settings/*', 'https://*example.com/*', 'https://user@example.com/*', 'https:///missing', 'https://example..com/*', 'https://*:70000/*', 'file://example.com/*']) {
    assert.equal(explainHostPattern(pattern).recognized, false, String(pattern));
  }
  assert.equal(advice({ hostPermissions: ['not a pattern'] }).status, 'Review');
});

test('no permissions, storage, notifications, bookmarks alone, and clipboardWrite stay Normal', () => {
  for (const permissions of [[], ['storage'], ['notifications', 'storage'], ['bookmarks'], ['clipboardWrite']]) {
    assert.equal(advice({ permissions }).status, 'Normal');
  }
});

test('history or broad host access receives an explainable Review label', () => {
  const history = advice({ permissions: ['history'] });
  assert.equal(history.status, 'Review');
  assert.match(history.reasons.join(' '), /history/);
  const broad = advice({ hostPermissions: ['<all_urls>'] });
  assert.equal(broad.status, 'Review');
  assert.match(broad.reasons.join(' '), /many websites/);
});

test('cookies, downloads and clipboardRead each ask for Review without escalating alone', () => {
  for (const permission of ['cookies', 'downloads', 'clipboardRead']) {
    const result = advice({ permissions: [permission] });
    assert.equal(result.status, 'Review');
    assert.ok(result.reasons.some(reason => reason.includes(permission)));
    assert.ok(result.capabilitySummary.length > 0);
  }
});

test('history and broad hosts add a combination explanation while remaining Review', () => {
  const result = advice({ permissions: ['history'], hostPermissions: ['<all_urls>'] });
  assert.equal(result.status, 'Review');
  assert.match(result.reasons.join(' '), /History access is combined with access across many websites/);
  assert.equal(result.reasons.length, 3);
});

test('webRequest and broad hosts add a request-visibility combination explanation', () => {
  const result = advice({ permissions: ['webRequest'], hostPermissions: ['<all_urls>'] });
  assert.equal(result.status, 'Review');
  assert.match(result.reasons.join(' '), /Network-request visibility is combined with access across many websites/);
});

test('cookies and history add a combination reason even without broad hosts', () => {
  const result = advice({ permissions: ['cookies', 'history'] });
  assert.equal(result.status, 'Review');
  assert.match(result.reasons.join(' '), /History and cookies appear together/);
});

test('several sensitive permissions without the powerful broad-host rule remain Review', () => {
  assert.equal(advice({ permissions: ['history', 'cookies', 'downloads', 'clipboardRead'] }).status, 'Review');
  assert.equal(advice({ permissions: ['debugger', 'proxy', 'nativeMessaging'] }).status, 'Review');
});

test('cookies plus broad hosts remain Review; history/cookies together add a visible reason', () => {
  assert.equal(advice({ permissions: ['cookies'], hostPermissions: ['<all_urls>'] }).status, 'Review');
  const result = advice({ permissions: ['history', 'cookies'], hostPermissions: ['<all_urls>'] });
  assert.equal(result.status, 'Review');
  assert.match(result.reasons.join(' '), /History and cookies appear together/);
  assert.match(result.reasons.join(' '), /History access is combined with access across many websites/);
});

test('powerful capabilities require broad hosts to reach High Attention', () => {
  for (const permission of ['debugger', 'proxy', 'nativeMessaging']) {
    assert.equal(advice({ permissions: [permission] }).status, 'Review');
    const result = advice({ permissions: [permission], hostPermissions: ['https://*/*'] });
    assert.equal(result.status, 'High Attention');
    assert.match(result.reasons.join(' '), new RegExp(permission));
    assert.match(result.reasons.join(' '), /can access a lot.*permissions make sense/);
    assert.doesNotMatch(JSON.stringify(result), /spyware|steals data|is malicious/);
  }
});

test('disabled items preserve capability labels while clearly disclaiming current activity', () => {
  const result = advice({ enabled: false, permissions: ['history'], hostPermissions: ['<all_urls>'] });
  assert.equal(result.stateLabel, 'Disabled');
  assert.equal(result.status, 'Review');
  assert.match(result.stateExplanation, /if you enable it.*do not mean it is active now/);
  assert.equal(advice({ enabled: true }).stateLabel, 'Enabled');
});

test('PrivacyLens is excluded by ID, not by its name; apps/themes are omitted', () => {
  const result = prepareInventory([
    extension({ id: 'self-id', name: 'PrivacyLens' }),
    extension({ id: 'different-id', name: 'PrivacyLens' }),
    extension({ id: 'theme-id', type: 'theme' }),
    extension({ id: 'app-id', type: 'hosted_app' }),
    extension({ id: 'login-id', type: 'login_screen_extension' })
  ], 'self-id');
  assert.equal(result.items.length, 2);
  assert.equal(result.excluded, 3);
  assert.equal(result.items[0].id, 'different-id');
});

test('empty extension list is available and distinct from an unavailable API', async () => {
  const { api } = readOnlyChrome([]);
  assert.deepEqual(await readInstalledExtensions(api), { available: true, items: [], skipped: 0, excluded: 0 });
  assert.equal((await readInstalledExtensions({})).available, false);
});

test('malformed inventory, invalid records, and duplicate IDs fail safely', () => {
  for (const raw of [null, undefined, {}, 'private-value']) assert.equal(prepareInventory(raw).available, false);
  const result = prepareInventory([null, {}, extension({ id: null }), extension({ name: '' }), extension({ type: 'invented' }), extension(), extension()]);
  assert.equal(result.items.length, 1);
  assert.equal(result.skipped, 6);
});

test('all documented app and theme types are omitted without being scored', () => {
  const types = ['theme', 'hosted_app', 'packaged_app', 'legacy_packaged_app'];
  const result = prepareInventory(types.map((type, index) => extension({ id: `item-${index}`, type })), 'self-id');
  assert.equal(result.available, true);
  assert.deepEqual(result.items, []);
  assert.equal(result.excluded, 4);
});

test('permission lists are deduplicated without changing returned browser metadata', () => {
  const raw = extension({ permissions: ['history', ' history ', 'cookies'], hostPermissions: ['<all_urls>', '<all_urls>'] });
  const original = JSON.stringify(raw);
  const prepared = prepareInventory([raw], 'self-id').items[0];
  assert.deepEqual(prepared.permissions, ['history', 'cookies']);
  assert.deepEqual(prepared.hostPermissions, ['<all_urls>']);
  adviseExtension(prepared);
  assert.equal(JSON.stringify(raw), original);
});

test('missing or malformed permission/state data produces Review without inventing metadata', () => {
  const result = advice({ enabled: 'yes', permissions: null, hostPermissions: [4, 'https://example.com/*'] });
  assert.equal(result.stateLabel, 'State unavailable');
  assert.equal(result.status, 'Review');
  assert.match(result.reasons.join(' '), /metadata.*could not be fully interpreted/);
  assert.equal(result.hostDetails.length, 1);
});

test('reader uses only documented getters, excludes self warnings, and drops internal IDs', async () => {
  const { api, calls } = readOnlyChrome([extension({ id: 'self-id' }), extension()], ['Read and change data']);
  const result = await readInstalledExtensions(api);
  assert.deepEqual(calls, ['getAll', ['warnings', 'other-id']]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].warningsAvailable, true);
  assert.deepEqual(result.items[0].warnings, ['Read and change data']);
  assert.doesNotMatch(JSON.stringify(result), /self-id|other-id/);
});

test('Chrome warning failures and malformed responses do not hide extension metadata', async () => {
  for (const warningReader of [undefined, async () => { throw new Error('private-error-value'); }, async () => null, async () => [3]]) {
    const result = await readInstalledExtensions({ runtime: { id: 'self-id' }, management: {
      getAll: async () => [extension()], getPermissionWarningsById: warningReader
    } });
    assert.equal(result.available, true);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].warningsAvailable, false);
    assert.deepEqual(result.items[0].warnings, []);
    assert.doesNotMatch(JSON.stringify(result), /private-error-value/);
  }
});

test('getAll errors do not leak raw errors or create a false empty audit', async () => {
  const result = await readInstalledExtensions({ management: { getAll: async () => { throw new Error('private-error-value'); } } });
  assert.equal(result.available, false);
  assert.doesNotMatch(JSON.stringify(result), /private-error-value/);
});

test('malformed getAll responses return unavailable without warning queries', async () => {
  for (const response of [null, undefined, {}, 'not an inventory']) {
    const result = await readInstalledExtensions({ management: {
      getAll: async () => response,
      getPermissionWarningsById: () => assert.fail('No warning query for malformed inventory')
    } });
    assert.equal(result.available, false);
    assert.deepEqual(result.items, []);
  }
});

test('an already closed page makes no management calls', async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await readInstalledExtensions({ management: {
    getAll: () => assert.fail('No inventory read after closure')
  } }, { signal: controller.signal });
  assert.deepEqual(result.items, []);
});

test('closing during a warning read discards the result and stops further reads', async () => {
  const controller = new AbortController();
  let finish;
  let calls = 0;
  const pending = readInstalledExtensions({ management: {
    getAll: async () => [extension(), extension({ id: 'second-id' })],
    getPermissionWarningsById: () => { calls++; return new Promise(resolve => { finish = resolve; }); }
  } }, { signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  controller.abort();
  finish(['Late warning']);
  assert.deepEqual((await pending).items, []);
  assert.equal(calls, 1);
});

test('search and filters operate locally on names and exact review labels', () => {
  const items = [advice({ name: 'Simple Notes' }), advice({ name: 'History Helper', permissions: ['history'] })];
  assert.equal(filterExtensions(items, ' NOTES ').length, 1);
  assert.equal(filterExtensions(items, '', 'Review')[0].name, 'History Helper');
  assert.equal(filterExtensions(items, 'notes', 'Review').length, 0);
});

class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.value = ''; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return (this.text ?? '') + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
function documentFixture() {
  const elements = new Map(['extension-list', 'inventory-summary', 'inventory-note', 'extension-search', 'extension-filter', 'read-again', 'audit'].map(id => [id, new Element()]));
  elements.get('extension-filter').value = 'all';
  return { getElementById: id => elements.get(id), createElement: tag => new Element(tag) };
}

test('audit displays Chrome warnings safely as text without internal IDs or mutating controls', async () => {
  const document = documentFixture();
  const { api } = readOnlyChrome([extension({ name: '<script>sample</script>' })], ['<img src=x> warning text']);
  await createAuditController(api, document).refresh();
  const list = document.getElementById('extension-list');
  assert.equal(list.children[0].tag, 'details');
  assert.match(list.textContent, /Chrome permission warnings.*<img src=x> warning text/);
  assert.match(list.textContent, /<script>sample<\/script>/);
  assert.doesNotMatch(list.textContent, /other-id/);
  assert.equal(document.getElementById('audit').attributes['aria-busy'], 'false');
});

test('Chrome warning text is displayed without turning warnings into behavior claims', async () => {
  const document = documentFixture();
  const { api } = readOnlyChrome([extension({ description: 'A sample notes tool', permissions: ['storage'] })], ['A localized browser warning']);
  await createAuditController(api, document).refresh();
  assert.match(document.getElementById('extension-list').textContent, /A localized browser warning/);
  assert.match(document.getElementById('extension-list').textContent, /A sample notes tool/);
  assert.match(document.getElementById('inventory-summary').textContent, /0 Review or High Attention/);
});

test('a later read wins and an older response cannot restore an earlier inventory', async () => {
  const document = documentFixture();
  const reads = [];
  const api = { management: { getAll: () => new Promise(resolve => reads.push(resolve)), getPermissionWarningsById: async () => [] } };
  const controller = createAuditController(api, document);
  const first = controller.refresh();
  const second = controller.refresh();
  reads[1]([extension({ name: 'Current Name' })]);
  await second;
  reads[0]([extension({ name: 'Old Name' })]);
  await first;
  assert.match(document.getElementById('extension-list').textContent, /Current Name/);
  assert.doesNotMatch(document.getElementById('extension-list').textContent, /Old Name/);
});

test('empty list, search with no matches, and unavailable audit have distinct messages', async () => {
  for (const [api, message] of [[readOnlyChrome([]).api, /No other extension items/], [{}, /Extension audit unavailable/]]) {
    const document = documentFixture();
    await createAuditController(api, document).refresh();
    assert.match(document.getElementById('extension-list').textContent + document.getElementById('inventory-summary').textContent, message);
  }
  const document = documentFixture();
  const { api, calls } = readOnlyChrome([extension()]);
  const controller = createAuditController(api, document);
  await controller.refresh();
  document.getElementById('extension-search').value = 'absent';
  controller.filter();
  assert.match(document.getElementById('extension-list').textContent, /No extensions match/);
  assert.equal(calls.filter(call => call === 'getAll').length, 1);
});

test('fresh reads replace the snapshot and page clearing discards names and filter state', async () => {
  const document = documentFixture();
  let current = [extension({ name: 'First Name' })];
  const api = { runtime: { id: 'self-id' }, management: { getAll: async () => current, getPermissionWarningsById: async () => [] } };
  const controller = createAuditController(api, document);
  await controller.refresh();
  current = [extension({ name: 'Second Name', enabled: false })];
  await controller.refresh();
  assert.doesNotMatch(document.getElementById('extension-list').textContent, /First Name/);
  assert.match(document.getElementById('extension-list').textContent, /Second NameDisabled/);
  document.getElementById('extension-search').value = 'Second';
  controller.clear();
  controller.filter();
  assert.equal(document.getElementById('extension-list').textContent, '');
  assert.equal(document.getElementById('inventory-summary').textContent, '');
  assert.equal(document.getElementById('extension-search').value, '');
});

test('closing during a pending read prevents late inventory from repainting or requesting warnings', async () => {
  const document = documentFixture();
  const lifecycle = new AbortController();
  let resolveRead;
  const api = { management: { getAll: () => new Promise(resolve => { resolveRead = resolve; }),
    getPermissionWarningsById: () => assert.fail('No warnings after closure') } };
  const controller = createAuditController(api, document, { signal: lifecycle.signal });
  const pending = controller.refresh();
  lifecycle.abort();
  controller.clear();
  resolveRead([extension({ name: 'Late Name' })]);
  await pending;
  assert.equal(document.getElementById('extension-list').textContent, '');
  assert.equal(document.getElementById('inventory-summary').textContent, '');
});
