import { publicHostname } from './domain-rules.js';

export function normalizeReport(payload, hostname) {
  if (!publicHostname(hostname) || payload?.data?.type !== 'domain' || payload.data.id !== hostname) return null;
  const raw = payload.data.attributes?.last_analysis_stats;
  const fields = ['malicious', 'suspicious', 'harmless', 'undetected'];
  if (!raw || !fields.every(field => Number.isSafeInteger(raw[field]) && raw[field] >= 0 && raw[field] <= 100000)) return null;
  if (raw.timeout !== undefined && (!Number.isSafeInteger(raw.timeout) || raw.timeout < 0 || raw.timeout > 100000)) return null;
  return { hostname, counts: Object.fromEntries(fields.map(field => [field, raw[field]])),
    timeout: raw.timeout ?? null };
}
export function adviseReputation(local, report) {
  const counts = report.counts;
  const flags = counts.malicious + counts.suspicious;
  const verdicts = flags + counts.harmless + counts.undetected;
  const has = id => local?.findings?.some(finding => finding.id === id);
  const strongLocal = has('brand-mismatch') && has('userinfo');
  const status = local?.status === 'High Attention' || counts.malicious >= 3 && strongLocal ? 'High Attention' :
    local?.status === 'Review' || flags > 0 ? 'Review' : 'Normal';
  return { status, label: !verdicts ? 'No vendor verdicts available' : !flags ? 'No strong warning found' :
    flags >= 3 ? 'Multiple VirusTotal engines flagged this domain' : 'A few VirusTotal engines flagged this domain',
    explanation: counts.malicious >= 3 && strongLocal
      ? 'At least three vendors reported malicious results, and the URL contains both a brand/domain mismatch and username/@ syntax. Review these signals together before sharing information.'
      : flags > 0 ? 'These vendor flags are not proof of abuse. Check the source and the local address findings.'
        : 'VirusTotal returned no strong warning. Any local findings still apply.',
    caveat: 'VirusTotal aggregates detections from multiple security vendors. A clean result does not guarantee safety. Existing reports may be old or incomplete.' };
}
