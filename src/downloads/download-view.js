export function clearDownloadCheck(document) {
  document.getElementById('download-check').replaceChildren();
}

export function renderDownloadCheck(document, result) {
  const container = document.getElementById('download-check');
  container.replaceChildren();
  const paragraph = (text, parent = container, className) => {
    const element = document.createElement('p');
    element.textContent = text;
    if (className) element.className = className;
    parent.append(element);
    return element;
  };
  if (!result?.available) {
    paragraph(result === null ? 'Download check unavailable. Chrome could not provide the local check.' : 'No recent PrivacyLens-observed download.');
    return;
  }
  const { check } = result;
  paragraph(check.filename, container, 'download-name');
  const status = paragraph(check.status, container, 'status');
  status.dataset.status = check.status;
  paragraph(`Source: ${check.source}`);
  const signals = check.findings.filter(finding => finding.level === 'review');
  paragraph(signals.length ? signals.slice(0, 3).map(finding => finding.title).join(' · ') : 'No review signals from this metadata check.', container, 'permission-context');
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Details and guidance';
  details.append(summary);
  for (const [label, value] of [['Final source', check.finalSource], ['Download state', check.state], ['Paused', check.paused],
    ['Browser-reported type', check.mime], ['Browser-reported size', check.fileSize === null ? 'Unknown' : `${check.fileSize.toLocaleString()} bytes`]]) {
    paragraph(`${label}: ${value}`, details);
  }
  for (const finding of check.findings) {
    const heading = document.createElement('strong');
    heading.textContent = `${finding.level === 'review' ? '⚠' : 'ⓘ'} ${finding.title}`;
    const explanation = paragraph('', details);
    explanation.append(heading, document.createTextNode(`Detected: ${finding.detected}. ${finding.why} Suggestion: ${finding.suggestion}`));
  }
  container.append(details);
}
