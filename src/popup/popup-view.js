import { advisePermissions, combineStatuses } from '../permissions/permission-advisor.js';

import { statusCopy, normalCaveat, setEvidenceState } from '../ui/status-copy.js';

function appendExplanation(document, details, label, value) {
  const paragraph = document.createElement('p');
  const heading = document.createElement('strong');
  heading.textContent = label;
  paragraph.append(heading, document.createTextNode(value));
  details.append(paragraph);
}

export function renderResult(document, result, advice = advisePermissions(), navigation = { status: 'Normal' }, reputation = null) {
  document.getElementById('domain').textContent = result.domain ?? 'Address unavailable';
  document.getElementById('scheme').textContent = result.scheme ? `Connection scheme: ${result.scheme}` : 'Website analysis unavailable';
  const status = document.getElementById('status');
  const combinedStatus = combineStatuses(combineStatuses(combineStatuses(result.status, advice.status), navigation.status), reputation?.status ?? 'Normal');
  status.textContent = combinedStatus;
  status.dataset.status = combinedStatus;
  status.hidden = false;
  document.getElementById('summary').textContent = result.available
    ? `${statusCopy[combinedStatus]}${combinedStatus === 'Normal' ? ` ${normalCaveat}` : ''}` : 'No website assessment was made. Open an HTTP or HTTPS website to use PrivacyLens.';
  const container = document.getElementById('findings');
  container.replaceChildren();
  for (const finding of result.findings) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    const symbol = document.createElement('span');
    symbol.className = 'symbol';
    symbol.setAttribute('aria-hidden', 'true');
    symbol.textContent = finding.level === 'review' ? '⚠' : finding.id === 'https' ? '✓' : 'ⓘ';
    summary.append(symbol, document.createTextNode(finding.title));
    details.append(summary);
    for (const [label, value] of [['What was noticed', finding.detected], ['Why this matters', finding.why], ['Consider', finding.suggestion]]) {
      appendExplanation(document, details, label, value);
    }
    container.append(details);
  }
  document.getElementById('permissions-context').textContent =
    'These are Chrome’s settings, not evidence of actual use. Default and site-specific choices may look the same.';
  const notes = document.getElementById('permission-notes');
  notes.replaceChildren();
  for (const note of advice.notes) {
    const details = document.createElement('details');
    details.className = 'permission-note';
    const summary = document.createElement('summary'); summary.textContent = `⚠ ${note.title}`; details.append(summary);
    for (const [label, text] of [['What was noticed', note.detected], ['Why this matters', note.why], ['Consider', note.suggestion]]) {
      appendExplanation(document, details, label, text);
    }
    notes.append(details);
  }
  const permissionContainer = document.getElementById('site-permissions');
  permissionContainer.replaceChildren();
  for (const permission of advice.permissions) {
    const details = document.createElement('details');
    details.className = 'permission-row';
    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.className = 'permission-label';
    label.textContent = permission.name;
    const state = document.createElement('span');
    state.className = 'permission-state';
    state.textContent = permission.label;
    summary.append(label, state);
    details.append(summary);
    for (const [heading, value] of [
      ['Browser setting', permission.stateExplanation], ['What it allows', permission.allows],
      ['Common legitimate uses', permission.legitimateUses], ['Review when', permission.reviewWhen],
      ['Consider', permission.recommendation]
    ]) {
      appendExplanation(document, details, heading, value);
    }
    permissionContainer.append(details);
  }
  setEvidenceState(document, 'address', { available: result.available, status: result.status });
  setEvidenceState(document, 'permissions', { available: advice.permissions.some(item => item.state !== 'unavailable'), status: advice.status });
  document.getElementById('result').setAttribute('aria-busy', 'false');
}
