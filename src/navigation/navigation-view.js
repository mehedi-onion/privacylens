import { setEvidenceState } from '../ui/status-copy.js';
import { renderFindings } from '../ui/finding-view.js';
export function clearNavigation(document) { document.getElementById('navigation-findings').replaceChildren(); }
export function renderNavigation(document, advice) {
  const redirected = advice.findings.some(item => ['server_redirect', 'client_redirect'].includes(item.id));
  setEvidenceState(document, 'navigation', advice, !advice.available ? 'No recent redirect info' :
    redirected ? 'Redirect observed' : 'No redirect reported');
  const container = document.getElementById('navigation-findings');
  renderFindings(document, container, advice.findings);
  if (!advice.available) {
    const context = document.createElement('p'); context.className = 'context'; context.textContent = advice.summary; container.append(context);
  }
}
