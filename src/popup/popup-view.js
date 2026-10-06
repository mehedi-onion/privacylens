import { advisePermissions, combineStatuses } from '../permissions/permission-advisor.js';

const summaries = {
  Normal: 'No review signals from these limited checks. This is not a guarantee of safety.',
  Review: 'Review local findings, site permissions, navigation and any requested reputation evidence before sharing sensitive information. A warning does not mean this site is malicious.',
  'High Attention': 'Several signals deserve close review. Check the URL findings and any requested reputation evidence before sharing private information.'
};

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
    ? summaries[combinedStatus] : 'No website assessment was made. Open an HTTP or HTTPS website to use PrivacyLens.';
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
    for (const [label, value] of [['Detected', finding.detected], ['Why it matters', finding.why], ['Suggestion', finding.suggestion]]) {
      appendExplanation(document, details, label, value);
    }
    container.append(details);
  }
  document.getElementById('permissions-context').textContent =
    'Browser-reported settings for this top-level site, not evidence of feature use. Default and site-specific choices cannot be distinguished. PrivacyLens only reads these settings.';
  const notes = document.getElementById('permission-notes');
  notes.replaceChildren();
  for (const note of advice.notes) {
    const paragraph = document.createElement('p');
    paragraph.className = 'permission-note';
    const heading = document.createElement('strong');
    heading.textContent = note.title;
    paragraph.append(heading, document.createTextNode(`${note.detected} ${note.why} ${note.suggestion}`));
    notes.append(paragraph);
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
      ['Suggestion', permission.recommendation]
    ]) {
      appendExplanation(document, details, heading, value);
    }
    permissionContainer.append(details);
  }
  document.getElementById('result').setAttribute('aria-busy', 'false');
}
