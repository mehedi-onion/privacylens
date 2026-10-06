import { setEvidenceState } from '../ui/status-copy.js';
export function clearNavigation(document) { document.getElementById('navigation-findings').replaceChildren(); }
export function renderNavigation(document, advice) {
  setEvidenceState(document, 'navigation', advice);
  const container = document.getElementById('navigation-findings');
  container.replaceChildren();
  if (advice.available) {
    const status = document.createElement('p');
    status.className = 'status';
    status.dataset.status = advice.status;
    status.textContent = advice.status;
    container.append(status);
  }
  const context = document.createElement('p');
  context.className = 'permission-context';
  context.textContent = advice.summary;
  container.append(context);
  for (const finding of advice.findings) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${finding.level === 'review' ? '⚠' : 'ⓘ'} ${finding.title}`;
    details.append(summary);
    for (const [label, value] of [['What was noticed', finding.detected], ['Why this matters', finding.why], ['Consider', finding.suggestion]]) {
      const paragraph = document.createElement('p');
      const heading = document.createElement('strong');
      heading.textContent = label;
      paragraph.append(heading, document.createTextNode(value));
      details.append(paragraph);
    }
    container.append(details);
  }
}
