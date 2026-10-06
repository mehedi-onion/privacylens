// Labels express review priority, never the probability of malicious intent.
export function overallStatus(findings, internal = false) {
  const has = id => findings.some(finding => finding.id === id);
  if (!internal && has('http') &&
      (has('sensitive-words') || has('brand-mismatch') || has('userinfo'))) {
    return 'High Attention';
  }
  if (findings.some(finding => finding.level === 'review')) return 'Review';
  return 'Normal';
}
