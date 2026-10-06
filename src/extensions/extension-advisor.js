import { explainExtensionPermission } from './permission-catalog.js';
import { explainHostPattern } from './host-patterns.js';

const reviewPermissions = new Set(['tabs', 'history', 'cookies', 'downloads', 'clipboardRead', 'geolocation', 'management', 'webRequest', 'webNavigation', 'scripting', 'contentSettings', 'debugger', 'proxy', 'nativeMessaging']);
const powerfulPermissions = new Set(['debugger', 'proxy', 'nativeMessaging']);
const itemTypes = new Set(['extension', 'login_screen_extension']);
const otherTypes = new Set(['theme', 'hosted_app', 'packaged_app', 'legacy_packaged_app']);
const installTypes = new Set(['normal', 'development', 'admin', 'sideload', 'other']);

function stringList(value) {
  const valid = item => typeof item === 'string' && item.trim().length > 0;
  return { values: Array.isArray(value) ? [...new Set(value.filter(valid).map(item => item.trim()))] : [],
    complete: Array.isArray(value) && value.every(valid) };
}

export function prepareInventory(raw, selfId) {
  if (!Array.isArray(raw)) return { available: false, items: [], skipped: 0, excluded: 0 };
  const items = [];
  const seen = new Set();
  let skipped = 0;
  let excluded = 0;
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        typeof item.id !== 'string' || !item.id.trim() ||
        typeof item.name !== 'string' || !item.name.trim()) {
      skipped++;
      continue;
    }
    if (item.id === selfId || otherTypes.has(item.type)) { excluded++; continue; }
    if (!itemTypes.has(item.type) || seen.has(item.id)) { skipped++; continue; }
    seen.add(item.id);
    const permissions = stringList(item.permissions);
    const hosts = stringList(item.hostPermissions);
    items.push({ id: item.id, name: item.name, type: item.type,
      description: typeof item.description === 'string' ? item.description : '',
      enabled: typeof item.enabled === 'boolean' ? item.enabled : null,
      version: typeof item.version === 'string' ? item.version : null,
      installType: installTypes.has(item.installType) ? item.installType : null,
      permissions: permissions.values, hostPermissions: hosts.values,
      incomplete: !permissions.complete || !hosts.complete || typeof item.enabled !== 'boolean' });
  }
  return { available: true, items, skipped, excluded };
}

export function adviseExtension(item) {
  const permissionDetails = item.permissions.map(explainExtensionPermission);
  const hostDetails = item.hostPermissions.map(explainHostPattern);
  const broad = hostDetails.some(host => host.broad);
  const powerful = item.permissions.filter(permission => powerfulPermissions.has(permission));
  const reasons = [];
  if (broad) reasons.push('Chrome reports host access across many websites.');
  for (const permission of item.permissions.filter(permission => reviewPermissions.has(permission))) {
    reasons.push(`The ${permission} permission gives privacy-relevant capability; compare its explanation with the extension’s purpose.`);
  }
  const has = permission => item.permissions.includes(permission);
  if (has('history') && has('cookies')) reasons.push('History and cookies appear together. Review whether access to visited sites and session information both fit the intended features.');
  if (broad && has('history')) reasons.push('History access is combined with access across many websites. Review whether both are needed.');
  if (broad && has('cookies')) reasons.push('Cookie access is combined with access across many websites. Review whether that scope fits the intended features.');
  if (broad && has('webRequest')) reasons.push('Network-request visibility is combined with access across many websites. Review whether this matches the extension’s purpose.');
  if (item.incomplete || hostDetails.some(host => !host.recognized)) {
    reasons.push('Some metadata or host patterns could not be fully interpreted. Review the browser’s details.');
  }
  const highAttention = broad && powerful.length > 0;
  if (highAttention) reasons.push(`Broad host access is combined with ${powerful.join(', ')}. This extension has several powerful permissions. Review whether they match what the extension is supposed to do.`);
  // IDs are deliberately omitted from the display model.
  return { name: item.name, description: item.description, type: item.type, version: item.version, installType: item.installType,
    enabled: item.enabled, stateLabel: item.enabled === true ? 'Enabled' : item.enabled === false ? 'Disabled' : 'State unavailable',
    stateExplanation: item.enabled === false
      ? 'Disabled: these are listed capabilities if the extension is enabled, not a claim of current activity.'
      : 'Enabled state does not show whether a capability is being used.',
    status: highAttention ? 'High Attention' : reasons.length ? 'Review' : 'Normal',
    reasons, permissionDetails, hostDetails,
    capabilitySummary: [
      ...(broad ? ['Can access many websites'] : []),
      ...(has('history') ? ['Can read and change browsing history'] : []),
      ...(has('cookies') ? ['Can read and change cookies on permitted sites'] : []),
      ...(has('webRequest') ? ['Can inspect requests on permitted sites'] : []),
      ...(has('debugger') ? ['Can use browser debugging tools'] : []),
      ...(has('nativeMessaging') ? ['Can communicate with desktop software'] : []),
      ...(has('proxy') ? ['Can change browser proxy settings'] : []),
      ...(has('downloads') ? ['Can interact with browser downloads'] : []),
      ...(has('clipboardRead') ? ['Can read clipboard content'] : [])
    ].slice(0, 3),
    warnings: item.warnings ?? [], warningsAvailable: item.warningsAvailable === true,
    recommendation: 'Review whether the listed capabilities match the features you use. Permissions indicate capability, not actual misuse.' };
}

export function filterExtensions(items, query = '', status = 'all') {
  const text = query.trim().toLowerCase();
  return items.filter(item => item.name.toLowerCase().includes(text) && (status === 'all' || item.status === status));
}
