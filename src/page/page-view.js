import { setEvidenceState } from '../ui/status-copy.js';
import { moreDetails, renderFindings } from '../ui/finding-view.js';
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
  setEvidenceState(document, 'page', result, result.available
    ? result.reviewCount ? `${result.reviewCount} finding${result.reviewCount === 1 ? '' : 's'} to check` : 'No unusual form or link found' : undefined);
  document.getElementById('page-scan-summary').textContent = result.available
    ? '' : result.message;
  const status = document.getElementById('page-scan-status');
  status.hidden = !result.available;
  status.textContent = result.status || '';
  status.dataset.status = result.status || '';
  const findings = document.getElementById('page-scan-findings');
  renderFindings(document, findings, result.findings ?? [], { collapseInfo: true });
  if (result.available) {
    const scope = moreDetails(document, 'Scan coverage');
    const paragraph = document.createElement('p'); paragraph.textContent = `One snapshot of the main page; linked pages are not opened. ${result.message}`; scope.append(paragraph);
    findings.append(scope);
  }
}
