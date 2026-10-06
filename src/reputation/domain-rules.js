import { analyzeUrl } from '../analysis/url-analyzer.js';

export const VT_ORIGIN = 'https://www.virustotal.com/*';
export function publicHostname(input) {
  if (typeof input !== 'string' || input.length > 253 || input !== input.toLowerCase() || !input.includes('.')) return null;
  const labels = input.split('.');
  if (labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
      ['local', 'localdomain', 'internal', 'localhost', 'test', 'invalid', 'example', 'onion', 'lan', 'home', 'corp', 'intranet', 'arpa'].includes(labels[labels.length - 1])) return null;
  const analysis = analyzeUrl(`https://${input}`);
  return analysis.available && !analysis.findings.some(finding => ['internal', 'ip-address'].includes(finding.id)) ? input : null;
}
export function hostnameFromTab(tab) {
  if (tab?.incognito !== false || !Number.isSafeInteger(tab.id) || tab.id < 0 || typeof tab.url !== 'string') return null;
  try {
    const url = new URL(tab.url);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return publicHostname(url.hostname.toLowerCase().replace(/\.$/, ''));
  } catch { return null; }
}
