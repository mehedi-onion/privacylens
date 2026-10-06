export const statusCopy = {
  Normal: 'Nothing here needs your attention right now.',
  Review: "There's something worth checking.",
  'High Attention': 'Several strong signals are worth checking carefully.'
};

export function evidenceLabel({ available = false, status = 'Normal', checked = true, pending = false } = {}) {
  if (pending) return '— Checking…';
  if (!checked) return '— Not checked';
  if (!available) return '— Unavailable';
  return status === 'High Attention' ? '⚠ High Attention' : status === 'Review' ? '⚠ Review' : '✓ Normal';
}
export function setEvidenceState(document, id, state, description) {
  const element = document.getElementById(`${id}-state`);
  if (!element) return;
  if (!description) { element.textContent = evidenceLabel(state); return; }
  let prefix = '—';
  if (state.available) prefix = state.status && state.status !== 'Normal' ? `⚠ ${state.status} ·` : '✓';
  element.textContent = `${prefix} ${description}`;
}
