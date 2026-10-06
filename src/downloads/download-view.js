import { setEvidenceState } from '../ui/status-copy.js';
import { findingDetails, moreDetails } from '../ui/finding-view.js';
export function clearDownloadCheck(document) {
  document.getElementById('download-check').replaceChildren();
}

export function renderDownloadCheck(document, result) {
  setEvidenceState(document, 'download', { available: result?.available, checked: result === null || result?.available === true, status: result?.check?.status }, result?.available ? result.check.filename : result === null ? 'Unavailable' : 'No recent download');
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
    paragraph(result === null ? 'Download details unavailable.' : 'No recent download.');
    return;
  }
  const { check } = result;
  paragraph(check.filename, container, 'download-name');
  const status = paragraph(check.status, container, 'status');
  status.dataset.status = check.status;
  paragraph(`Source: ${check.source}`);
  const details = moreDetails(document, 'File details');
  for (const finding of check.findings) (finding.level === 'review' || finding.id === 'browser-danger' ? container : details).append(findingDetails(document, finding));
  for (const [label, value] of [['Final source', check.finalSource], ['Download state', check.state], ['Paused', check.paused],
    ['File type', check.mime], ['Size', check.fileSize === null ? 'Unknown' : `${check.fileSize.toLocaleString()} bytes`]]) {
    paragraph(`${label}: ${value}`, details);
  }
  container.append(details);
}
