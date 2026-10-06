export function clearPageScan(document) {
  for (const id of ['page-scan-summary', 'page-scan-status']) document.getElementById(id).textContent = '';
  document.getElementById('page-scan-status').hidden = true;
  document.getElementById('page-scan-findings').replaceChildren();
}

export function setPageScanBusy(document, busy) {
  document.getElementById('scan-page').disabled = busy;
  document.getElementById('page-scan').setAttribute('aria-busy', String(busy));
}

export function renderPageScan(document, result) {
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
    for (const [label, text] of [['Detected', finding.detected], ['Why it matters', finding.why], ['Suggestion', finding.suggestion]]) {
      const paragraph = document.createElement('p');
      const heading = document.createElement('strong');
      heading.textContent = label;
      paragraph.append(heading, document.createTextNode(text));
      details.append(paragraph);
    }
    findings.append(details);
  }
}
