import test from 'node:test';
import assert from 'node:assert/strict';
import { permissionDefinitions, normalizePermissionState } from '../src/permissions/permission-definitions.js';
import { readSitePermissions } from '../src/permissions/site-permission-reader.js';
import { advisePermissions, combineStatuses } from '../src/permissions/permission-advisor.js';

const readingsFor = (states = {}) => permissionDefinitions.map(({ id }) => ({ id, state: states[id] ?? 'block' }));
const mockApi = handler => ({
  runtime: {},
  contentSettings: Object.fromEntries(permissionDefinitions.map(({ id }) => [id, {
    get: (details, callback) => handler(id, details, callback),
    set: () => assert.fail('PrivacyLens must never change a setting'),
    clear: () => assert.fail('PrivacyLens must never clear a setting')
  }]))
});

test('all six permission definitions contain useful explanations and documented states', () => {
  assert.deepEqual(permissionDefinitions.map(({ id }) => id), ['camera', 'microphone', 'location', 'notifications', 'popups', 'automaticDownloads']);
  for (const definition of permissionDefinitions) {
    for (const field of ['name', 'allows', 'legitimateUses', 'reviewWhen', 'recommendation']) {
      assert.equal(typeof definition[field], 'string');
      assert.ok(definition[field].length > (field === 'name' ? 0 : 15), `${definition.id}.${field}`);
    }
    assert.deepEqual(definition.states, definition.id === 'popups' ? ['allow', 'block'] : ['allow', 'block', 'ask']);
  }
});

test('allow, block and ask normalize exactly without inventing a default state', () => {
  for (const definition of permissionDefinitions) {
    for (const state of ['allow', 'block', 'ask']) {
      assert.equal(normalizePermissionState({ setting: state }, definition),
        state === 'ask' && definition.id === 'popups' ? 'unavailable' : state);
    }
    assert.equal(normalizePermissionState({ setting: 'default' }, definition), 'unavailable');
  }
});

test('malformed response values normalize to unavailable instead of Ask or Allowed', () => {
  const camera = permissionDefinitions[0];
  for (const response of [null, undefined, 'allow', [], {}, { setting: null }, { setting: 1 }, { setting: true }, { setting: 'ALLOW' }, { setting: 'granted' }, { setting: 'session_only' }]) {
    assert.equal(normalizePermissionState(response, camera), 'unavailable');
  }
});

test('reader calls only six getters for a sanitized current-site origin', async () => {
  const calls = [];
  const api = mockApi((id, details, callback) => { calls.push([id, details]); callback({ setting: id === 'popups' ? 'block' : 'ask' }); });
  const results = await readSitePermissions(api, { url: 'https://user:do-not-keep@example.com:8443/login?secret=private#fragment', incognito: false });
  assert.equal(calls.length, 6);
  for (const [, details] of calls) {
    assert.deepEqual(details, { primaryUrl: 'https://example.com:8443/', secondaryUrl: 'https://example.com:8443/', incognito: false });
  }
  assert.doesNotMatch(JSON.stringify(results), /example\.com|do-not-keep|private|fragment/);
  assert.equal(results.filter(result => result.state === 'ask').length, 5);
});

test('reader uses incognito state for an incognito tab without persisting a scope', async () => {
  const api = mockApi((_id, details, callback) => { assert.equal(details.incognito, true); callback({ setting: 'block' }); });
  assert.ok((await readSitePermissions(api, { url: 'https://example.com', incognito: true })).every(result => result.state === 'block'));
});

test('unsupported pages are not sent to contentSettings', async () => {
  const api = mockApi(() => assert.fail('No setting read expected'));
  for (const url of [undefined, 'not a URL', 'chrome://settings', 'file:///private/data', 'about:blank', 'data:text/html,hello']) {
    const results = await readSitePermissions(api, { url });
    assert.equal(results.length, 6);
    assert.ok(results.every(result => result.state === 'unavailable' && result.reason === 'unsupported-page'));
  }
});

test('missing APIs and getter methods produce individual Unavailable rows', async () => {
  for (const api of [null, {}, { contentSettings: {} }, { contentSettings: { camera: { get: 1 } } }]) {
    const results = await readSitePermissions(api, { url: 'https://example.com' });
    assert.ok(results.every(result => result.state === 'unavailable' && result.reason === 'unsupported-api'));
  }
});

test('one failed or malformed setting does not hide successfully read settings', async () => {
  const api = mockApi((id, _details, callback) => {
    if (id === 'camera') throw new Error('private-error-value');
    callback(id === 'location' ? { setting: 'default' } : { setting: 'block' });
  });
  const results = await readSitePermissions(api, { url: 'https://example.com' });
  assert.equal(results[0].reason, 'read-failed');
  assert.equal(results[2].reason, 'invalid-response');
  assert.equal(results[1].state, 'block');
  assert.doesNotMatch(JSON.stringify(results), /private-error-value/);
});

test('Chrome callback lastError is consumed and becomes Unavailable', async () => {
  const api = mockApi((_id, _details, callback) => callback({ setting: 'allow' }));
  let reads = 0;
  Object.defineProperty(api.runtime, 'lastError', { get() { reads++; return { message: 'private-error-value' }; } });
  const results = await readSitePermissions(api, { url: 'https://example.com' });
  assert.equal(reads, 6);
  assert.ok(results.every(result => result.state === 'unavailable'));
  assert.doesNotMatch(JSON.stringify(results), /private-error-value/);
});

test('all blocked or Ask settings remain Normal', () => {
  assert.equal(advisePermissions(readingsFor()).status, 'Normal');
  assert.equal(advisePermissions(readingsFor(Object.fromEntries(permissionDefinitions.filter(d => d.id !== 'popups').map(d => [d.id, 'ask'])))).status, 'Normal');
});

test('camera, microphone, or notifications allowed alone does not claim malicious intent', () => {
  for (const id of ['camera', 'microphone', 'location', 'notifications', 'popups', 'automaticDownloads']) {
    const advice = advisePermissions(readingsFor({ [id]: 'allow' }));
    assert.equal(advice.status, 'Normal', id);
    assert.deepEqual(advice.notes, []);
    assert.doesNotMatch(JSON.stringify(advice), /malicious|spying/);
  }
});

test('all three sensitive permissions justify Review, never High Attention', () => {
  const advice = advisePermissions(readingsFor({ camera: 'allow', microphone: 'allow', location: 'allow' }));
  assert.equal(advice.status, 'Review');
  assert.equal(advice.notes.length, 1);
  assert.match(advice.notes[0].suggestion, /Review whether you still need them/);
  assert.equal(advisePermissions(readingsFor({ camera: 'allow', microphone: 'allow' })).status, 'Normal');
  assert.equal(combineStatuses('Normal', advice.status), 'Review');
  assert.equal(combineStatuses('Review', advice.status), 'Review');
  assert.equal(combineStatuses('High Attention', advice.status), 'High Attention');
});

test('unknown and duplicate IDs do not manufacture a sensitive permission combination', () => {
  const advice = advisePermissions([{ id: 'camera', state: 'allow' }, { id: 'camera', state: 'allow' }, { id: 'other', state: 'allow' }]);
  assert.equal(advice.status, 'Normal');
  assert.equal(advice.permissions.length, 6);
  assert.equal(advisePermissions(null).status, 'Normal');
});

test('effective Ask and Unavailable explain platform limits without guessing defaults', () => {
  const advice = advisePermissions([{ id: 'camera', state: 'ask' }, { id: 'location', state: 'unavailable', reason: 'read-failed' }]);
  assert.equal(advice.permissions[0].label, 'Ask');
  assert.match(advice.permissions[0].stateExplanation, /does not identify.*default/);
  assert.equal(advice.permissions[2].label, 'Unavailable');
  assert.equal(advice.status, 'Normal');
});

test('repeated reads keep no permission or domain history and do not reuse prior findings', async () => {
  let currentState = 'allow';
  const api = mockApi((_id, _details, callback) => callback({ setting: currentState }));
  const first = advisePermissions(await readSitePermissions(api, { url: 'https://first.example' }));
  currentState = 'block';
  const second = advisePermissions(await readSitePermissions(api, { url: 'https://second.example' }));
  assert.equal(first.status, 'Review');
  assert.equal(second.status, 'Normal');
  assert.ok(second.permissions.every(permission => permission.state === 'block'));
  assert.doesNotMatch(JSON.stringify(second), /first\.example|second\.example|timestamp|history/);
});
