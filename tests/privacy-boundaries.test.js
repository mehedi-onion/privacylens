import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const groups = await Promise.all(entries.map(entry => {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  }));
  return groups.flat();
}

test('manifest has only activeTab/contentSettings/management/scripting/downloads and blocks outgoing connections', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', root), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ['activeTab', 'contentSettings', 'management', 'scripting', 'downloads']);
  assert.equal(manifest.minimum_chrome_version, '92');
  assert.deepEqual(manifest.background, { service_worker: 'src/background/service-worker.js', type: 'module' });
  for (const field of ['host_permissions', 'optional_permissions', 'optional_host_permissions', 'content_scripts', 'externally_connectable', 'web_accessible_resources']) {
    assert.equal(manifest[field], undefined, field);
  }
  assert.match(manifest.content_security_policy.extension_pages, /connect-src 'none'/);
  assert.match(manifest.content_security_policy.extension_pages, /form-action 'none'/);
  const html = await readFile(new URL(manifest.action.default_popup, root), 'utf8');
  assert.match(html, /type="module" src="popup.js"/);
  assert.match(html, /href="popup.css"/);
  assert.match(html, /id="scan-page" type="button">Scan this page/);
  assert.match(html, /href="\.\.\/extensions\/extensions.html" target="_blank" rel="noopener"/);
  const auditHtml = await readFile(new URL('src/extensions/extensions.html', root), 'utf8');
  assert.match(auditHtml, /type="module" src="extensions.js"/);
});

test('shipped source has no network, persistence, analytics, unsafe HTML or secret APIs', async () => {
  const files = [...await sourceFiles(new URL('src/', root)), ...await sourceFiles(new URL('data/', root))];
  // Static guardrail for this small, fully inspected source tree, not a general security scanner.
  const forbidden = /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|innerHTML|eval)\b|chrome\.(?:storage|history|webRequest|cookies)|document\.cookie|console\.|https?:\/\/|\b(?:analytics|telemetry|gtag|mixpanel|segment)\b/i;
  const mutations = /\b(?:setEnabled|uninstall|uninstallSelf|launchApp|createAppShortcut|generateAppForLink|setLaunchType|installReplacementWebApp)\s*\(|\bmanagement\s*\[|\bon(?:Installed|Enabled|Disabled|Uninstalled)\b/;
  const secret = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk-[a-zA-Z0-9_-]{16,}|gh[pousr]_[a-zA-Z0-9]{16,}|github_pat_[a-zA-Z0-9_]{16,})|\b(?:api[_-]?key|client[_-]?secret)\s*[:=]|\b[a-f0-9]{64}\b/i;
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, forbidden, file.pathname);
    assert.doesNotMatch(source, mutations, file.pathname);
    assert.doesNotMatch(source, secret, file.pathname);
  }
  const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
});

test('reference data contains only local domain strings and the six intended brands', async () => {
  const { default: brands } = await import('../data/official-domains.js');
  const { default: shorteners } = await import('../data/url-shorteners.js');
  assert.deepEqual(brands.map(brand => brand.name), ['Google', 'Microsoft', 'Facebook', 'PayPal', 'bKash', 'Nagad']);
  for (const domain of [...brands.flatMap(brand => brand.domains), ...shorteners]) {
    assert.match(domain, /^[a-z0-9.-]+$/);
    assert.ok(domain.includes('.'));
  }
});
