export const statusCopy = {
  Normal: 'No current signal from these checks needs your attention.',
  Review: 'PrivacyLens found something worth checking before you share sensitive information or grant access.',
  'High Attention': 'Several strong privacy or security signals deserve careful review.'
};
export const normalCaveat = 'This does not guarantee that a website is safe.';
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
