export const statusCopy = {
  Normal: 'Nothing here needs your attention right now.',
  Review: 'Something here is worth checking before you share sensitive information or allow access.',
  'High Attention': 'Several strong warning signs need a closer look.'
};
export const normalCaveat = 'These checks cannot prove a site is safe.';
export const evidenceSources = { local: 'LOCAL', external: 'EXTERNAL · USER REQUESTED' };

export function evidenceLabel({ available = false, status = 'Normal', checked = true, pending = false } = {}) {
  if (pending) return '— Checking…';
  if (!checked) return '— Not checked';
  if (!available) return '— Unavailable';
  return status === 'High Attention' ? '⚠ High Attention' : status === 'Review' ? '⚠ Review suggested' : '✓ No review signal';
}
export function setEvidenceState(document, id, state) {
  const element = document.getElementById(`${id}-state`);
  if (element) element.textContent = evidenceLabel(state);
}
