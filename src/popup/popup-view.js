import { advisePermissions, combineStatuses } from '../permissions/permission-advisor.js';

import { statusCopy, setEvidenceState } from '../ui/status-copy.js';
import { appendExplanation, findingDetails, moreDetails, renderFindings } from '../ui/finding-view.js';

export function renderResult(document, result, advice = advisePermissions(), navigation = { status: 'Normal' }, reputation = null) {
  document.getElementById('domain').textContent = result.domain ?? 'Address unavailable';
  document.getElementById('scheme').textContent = result.scheme ? `Connection scheme: ${result.scheme}` : 'Website analysis unavailable';
  const status = document.getElementById('status');
  const combinedStatus = combineStatuses(combineStatuses(combineStatuses(result.status, advice.status), navigation.status), reputation?.status ?? 'Normal');
  status.textContent = combinedStatus;
  status.dataset.status = combinedStatus;
  status.hidden = false;
  document.getElementById('summary').textContent = result.available
    ? statusCopy[combinedStatus] : 'No website assessment was made. Open an HTTP or HTTPS website to use PrivacyLens.';
  renderFindings(document, document.getElementById('findings'), result.findings);
  document.getElementById('permissions-context').textContent =
    'Allowed means the browser permits access, not that the site is using it. Ask may be a default or a site choice.';
  const notes = document.getElementById('permission-notes');
  notes.replaceChildren();
  for (const note of advice.notes) {
    const details = findingDetails(document, note);
    details.className = 'permission-note';
    notes.append(details);
  }
  const permissionContainer = document.getElementById('site-permissions');
  permissionContainer.replaceChildren();
  const more = moreDetails(document, 'More permissions');
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
    (['popups', 'automaticDownloads'].includes(permission.id) ? more : permissionContainer).append(details);
  }
  if (more.children.length > 1) permissionContainer.append(more);
  setEvidenceState(document, 'address', { available: result.available, status: result.status },
    result.available ? result.status === 'Normal' ? 'No address warning' : 'Check the address' : 'Address unavailable');
  const primary = advice.permissions.filter(item => ['camera', 'microphone', 'location', 'notifications'].includes(item.id));
  const allowed = primary.filter(item => item.state === 'allow');
  const permissionSummary = allowed.length ? `${allowed[0].name}: Allowed${allowed.length > 1 ? ` · ${allowed.length - 1} more` : ''}`
    : primary.some(item => item.state === 'unavailable') ? 'Some settings unavailable' : 'Ask or blocked';
  setEvidenceState(document, 'permissions', { available: primary.some(item => item.state !== 'unavailable'), status: advice.status }, permissionSummary);
  document.getElementById('result').setAttribute('aria-busy', 'false');
}
