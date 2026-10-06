import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderResult } from '../src/popup/popup-view.js';
import { renderPageScan } from '../src/page/page-view.js';
import { renderDownloadCheck } from '../src/downloads/download-view.js';
import { renderAudit } from '../src/extensions/audit-view.js';
import { renderReputation } from '../src/reputation/reputation-view.js';
import { renderNavigation } from '../src/navigation/navigation-view.js';
import { adviseNavigation, normalizeNavigation } from '../src/navigation/navigation-advisor.js';
import { adviseExtension, prepareInventory } from '../src/extensions/extension-advisor.js';
import { analyzeUrl } from '../src/analysis/url-analyzer.js';
import { advisePermissions } from '../src/permissions/permission-advisor.js';
import { permissionDefinitions } from '../src/permissions/permission-definitions.js';
import { explainDownload, normalizeDownload } from '../src/downloads/download-analyzer.js';
import { adviseReputation } from '../src/reputation/reputation-advisor.js';
import { initialPrivacyState, updateExternal, privacySummary } from '../src/ui/privacy-summary.js';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
class Element {
  constructor(tag = '') { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text ?? '') + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
}
function view() {
  const nodes = new Map();
  return { getElementById: id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); },
    createElement: tag => new Element(tag), createTextNode: text => { const node = new Element(); node.textContent = text; return node; } };
}
const finding = (id, level) => ({ id, level, title: id, detected: '<script>literal text</script>', why: 'Why it matters.', suggestion: 'Consider this.' });

test('popup starts with six closed check rows, then compact privacy and tool links', async () => {
  const html = await read('src/popup/popup.html');
  const rows = [...html.matchAll(/<details class="evidence-section" id="([^"]+)"([^>]*)>/g)];
  assert.equal(rows.length, 6);
  for (const row of rows) assert.doesNotMatch(row[2], /\bopen\b/);
  assert.ok(html.indexOf('id="domain"') < html.indexOf('id="status"'));
  assert.ok(html.indexOf('id="status"') < html.indexOf('id="summary"'));
  assert.ok(html.indexOf('id="reputation-section"') < html.indexOf('id="privacy-summary"'));
  assert.equal((html.match(/LOCAL/g) ?? []).length, 0);
  assert.doesNotMatch(html, /Milestone|transition qualifier|worker|identifier/);
});

test('permission cleanup keeps all six states and explanations, with lower-priority settings collapsed', () => {
  const document = view();
  const advice = advisePermissions(permissionDefinitions.map(item => ({ id: item.id, state: item.id === 'location' ? 'allow' : 'block' })));
  renderResult(document, analyzeUrl('https://example.com'), advice);
  const children = document.getElementById('site-permissions').children;
  assert.equal(children.length, 5);
  assert.deepEqual(children.slice(0, 4).map(row => row.children[0].textContent), ['CameraBlocked', 'MicrophoneBlocked', 'LocationAllowed', 'NotificationsBlocked']);
  assert.equal(children[4].tag, 'details'); assert.equal(children[4].children[0].textContent, 'More permissions');
  assert.deepEqual(children[4].children.slice(1).map(row => row.children[0].textContent), ['Pop-upsBlocked', 'Automatic downloadsBlocked']);
  assert.equal(document.getElementById('status').textContent, 'Normal');
  assert.equal(document.getElementById('permissions-state').textContent, '✓ Location: Allowed');
  for (const row of [...children.slice(0, 4), ...children[4].children.slice(1)]) assert.match(row.textContent, /What it allows.*Common legitimate uses.*Review when.*Consider/);
});

test('short popup summaries retain established status combinations without repeating caveats', () => {
  const document = view();
  for (const [url, status, summary] of [
    ['https://example.com', 'Normal', 'Nothing here needs your attention right now.'],
    ['https://google-login-example.com', 'Review', "There's something worth checking."],
    ['http://google-login-example.com/login', 'High Attention', 'Several strong signals are worth checking carefully.']
  ]) {
    renderResult(document, analyzeUrl(url));
    assert.equal(document.getElementById('status').textContent, status);
    assert.equal(document.getElementById('summary').textContent, summary);
  }
});

test('page warnings stay first and routine login facts remain available inside details', () => {
  const document = view();
  const result = { available: true, domain: 'example.com', status: 'Review', reviewCount: 1, message: 'Snapshot coverage: 2 links.',
    findings: [finding('Password fields present', 'info'), finding('Cross-origin form', 'review')] };
  renderPageScan(document, result);
  const rows = document.getElementById('page-scan-findings').children;
  assert.equal(rows[0].children[0].textContent, '⚠ Cross-origin form');
  assert.equal(rows[1].children[0].textContent, 'Other page details');
  assert.match(rows[1].textContent, /Password fields present/); assert.equal(rows[1].open, undefined);
  assert.equal(rows[2].children[0].textContent, 'Scan coverage');
  assert.equal(document.getElementById('page-state').textContent, '⚠ Review · 1 finding to check');
  assert.match(rows[0].textContent, /<script>literal text<\/script>.*Why this matters.*Consider/);
  assert.doesNotMatch(document.getElementById('page-scan-summary').textContent, /2 links/);
});

test('routine password information remains Normal when the page advisor says Normal', () => {
  const document = view(); renderPageScan(document, { available: true, status: 'Normal', reviewCount: 0,
    message: 'One password field.', findings: [finding('Password fields present', 'info')] });
  assert.equal(document.getElementById('page-scan-status').textContent, 'Normal');
  assert.equal(document.getElementById('page-state').textContent, '✓ No unusual form or link found');
  assert.doesNotMatch(document.getElementById('page-scan-findings').textContent, /⚠/);
});

test('navigation row says what was observed without treating a redirect as Review', () => {
  const document = view(); const local = analyzeUrl('https://example.com');
  const snapshot = normalizeNavigation({ tabId: 7, frameId: 0, url: 'https://example.com', transitionType: 'link', transitionQualifiers: ['server_redirect'] });
  renderNavigation(document, adviseNavigation(snapshot, local));
  assert.equal(document.getElementById('navigation-state').textContent, '✓ Redirect observed');
  assert.doesNotMatch(document.getElementById('navigation-findings').textContent, /documentId|transitionType|qualifier/);
  renderNavigation(document, adviseNavigation(null, local));
  assert.equal(document.getElementById('navigation-state').textContent, '— No recent redirect info');
});

test('download warnings remain visible while size and file type stay inside File details', () => {
  const document = view(); const check = explainDownload(normalizeDownload({ id: 1, incognito: false, filename: 'invoice.pdf.exe',
    danger: 'uncommon', url: 'https://example.com/file', finalUrl: 'https://example.com/file', mime: 'text/plain', fileSize: 21 }));
  renderDownloadCheck(document, { available: true, check });
  assert.equal(check.status, 'Review');
  const children = document.getElementById('download-check').children;
  assert.match(children.filter(node => node.tag === 'details').slice(0, 3).map(node => node.children[0].textContent).join(' '), /Chrome.*Executable.*Document-looking/);
  const extra = children.at(-1); assert.equal(extra.children[0].textContent, 'File details');
  assert.match(extra.textContent, /text\/plain.*21 bytes/);
  assert.doesNotMatch(children.slice(0, -1).map(node => node.textContent).join(' '), /21 bytes|text\/plain/);
});

test('extension technical fields and Chrome warnings remain reachable, not in the card summary', () => {
  const document = view();
  const raw = prepareInventory([{ id: 'a', name: 'Example', type: 'extension', enabled: false, version: '1.2.3', installType: 'development',
    permissions: ['history'], hostPermissions: ['<all_urls>'] }], 'self');
  const item = adviseExtension({ ...raw.items[0], warnings: ['Chrome warning text'], warningsAvailable: true });
  renderAudit(document, { ...raw, items: [item] }, [item]);
  const card = document.getElementById('extension-list').children[0];
  assert.match(card.children[0].textContent, /ExampleDisabledReview.*many websites.*history/);
  assert.doesNotMatch(card.children[0].textContent, /1\.2\.3|development|<all_urls>|Chrome warning text/);
  assert.match(card.children.find(node => node.children[0]?.textContent === 'Permissions and Chrome warnings').textContent, /<all_urls>.*Chrome warning text/);
  assert.match(card.children.at(-1).textContent, /Extension details.*1\.2\.3.*development/);
});

test('reputation keeps four vendor counts and attribution, with timeout and caveat in details', () => {
  const document = view(); const report = { hostname: 'example.com', counts: { malicious: 0, suspicious: 1, harmless: 72, undetected: 15 }, timeout: 2 };
  const advice = adviseReputation(analyzeUrl('https://example.com'), report);
  renderReputation(document, report, advice);
  const children = document.getElementById('vt-result').children;
  assert.equal(children.find(node => node.tag === 'dl').children.length, 8);
  assert.equal(document.getElementById('reputation-state').textContent, '⚠ Review · 1 of 88 engines flagged this domain');
  assert.match(children.at(-1).textContent, /What was noticed.*Why this matters.*Consider.*does not guarantee safety.*timed out: 2/);
  assert.doesNotMatch(children.slice(0, -1).map(node => node.textContent).join(' '), /timed out|guarantee|Closing this popup/);
});

test('compact privacy disclosure distinguishes local, pending and shared hostname states', () => {
  const state = initialPrivacyState();
  assert.equal(privacySummary(state).overview, '✓ Local checks only · no results saved');
  updateExternal(state, { phase: 'pending', hostname: 'example.com' });
  assert.match(privacySummary(state).overview, /may have shared: example\.com/);
  updateExternal(state, { phase: 'complete', transmission: 'shared', keyMode: 'remembered' });
  assert.match(privacySummary(state).overview, /shared: example\.com.*no results saved/);
  assert.match(privacySummary(state).stored.join(' '), /remembered locally/);
  assert.doesNotMatch(privacySummary(state).overview, /Nothing saved|Local checks only/);
});

test('local rejection cannot falsely attribute a different hostname to an earlier external check', () => {
  const state = initialPrivacyState();
  updateExternal(state, { phase: 'pending', hostname: 'example.com' });
  updateExternal(state, { phase: 'complete', transmission: 'shared' });
  updateExternal(state, { phase: 'pending', hostname: 'other.example' });
  updateExternal(state, { phase: 'complete', transmission: 'none' });
  assert.match(privacySummary(state).overview, /shared: example\.com/);
  assert.doesNotMatch(privacySummary(state).overview, /other\.example/);
});

test('settings keep key controls and link to relocated disclosures without external embeds', async () => {
  const html = await read('src/options/options.html');
  for (const id of ['vt-key', 'remember-key', 'save-key', 'forget-key', 'key-status']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /type="password".*aria-describedby="key-privacy"/);
  assert.match(html, /transparency.html#virustotal/);
  assert.doesNotMatch(html, /<h2>|https?:\/\/|Milestone/);
  const transparency = await read('src/transparency/transparency.html');
  for (const phrase of ['someone with profile access', 'does not revoke', 'shared dataset', '4 requests per minute', 'No full URL']) assert.ok(transparency.includes(phrase));
});

test('logo and icon assets are bundled, correctly sized and referenced without new grants', async () => {
  const manifest = JSON.parse(await read('manifest.json'));
  for (const size of [16, 32, 48, 128]) {
    const path = manifest.icons[size]; assert.equal(path, manifest.action.default_icon[size]);
    const png = await readFile(new URL(path, root));
    assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
  for (const area of ['popup', 'options', 'extensions', 'transparency']) {
    const html = await read(`src/${area}/${area}.html`);
    assert.match(html, /src="\.\.\/\.\.\/assets\/logo.png" alt="PrivacyLens"/);
  }
  assert.equal(manifest.version, '0.8.0'); assert.equal(manifest.permissions.length, 7);
  assert.deepEqual(manifest.optional_host_permissions, ['https://www.virustotal.com/*']);
  const policy = manifest.content_security_policy.extension_pages;
  assert.match(policy, /img-src 'self';/);
  assert.match(policy, /connect-src https:\/\/www\.virustotal\.com\/api\/v3\/domains\/;/);
  assert.doesNotMatch(policy, /img-src[^;]*(?:https:|data:|\*)/);
});
