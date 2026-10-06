import { setEvidenceState } from '../ui/status-copy.js';
export function clearPageScan(document) {
  setEvidenceState(document, 'page', { checked: false });
  for (const id of ['page-scan-summary', 'page-scan-status']) document.getElementById(id).textContent = '';
  document.getElementById('page-scan-status').hidden = true;
  document.getElementById('page-scan-findings').replaceChildren();
}

export function setPageScanBusy(document, busy) {
  if (busy) setEvidenceState(document, 'page', { pending: true });
  document.getElementById('scan-page').disabled = busy;
  document.getElementById('page-scan').setAttribute('aria-busy', String(busy));
}

export function renderPageScan(document, result) {
  setEvidenceState(document, 'page', result);
  document.getElementById('page-scan-summary').textContent = result.available
    ? `${result.domain} — ${result.message}` : result.message;
  const status = document.getElementById('page-scan-status');
  status.hidden = !result.available;
  status.textContent = result.status || '';
  status.dataset.status = result.status || '';
  const findings = document.getElementById('page-scan-findings');
  findings.replaceChildren();
  if (result.available && !result.findings.length) {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'No structural review signals found in the inspected portion. This is not a guarantee of safety.';
    findings.append(paragraph);
  }
  for (const finding of result.findings) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${finding.level === 'review' ? '⚠' : 'ⓘ'} ${finding.title}`;
    details.append(summary);
    for (const [label, text] of [['What was noticed', finding.detected], ['Why this matters', finding.why], ['Consider', finding.suggestion]]) {
      const paragraph = document.createElement('p');
      const heading = document.createElement('strong');
      heading.textContent = label;
      paragraph.append(heading, document.createTextNode(text));
      details.append(paragraph);
    }
    findings.append(details);
  }
}
