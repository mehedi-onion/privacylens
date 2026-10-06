// Text-only rendering shared by local findings and external explanations.
export function appendExplanation(document, parent, label, text) {
  const paragraph = document.createElement('p');
  const heading = document.createElement('strong');
  heading.textContent = label;
  paragraph.append(heading, document.createTextNode(text));
  parent.append(paragraph);
}

export function findingDetails(document, finding) {
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = `${finding.level === 'review' ? '⚠' : finding.id === 'https' ? '✓' : 'ⓘ'} ${finding.title}`;
  details.append(summary);
  for (const [label, text] of [['What was noticed', finding.detected], ['Why this matters', finding.why], ['Consider', finding.suggestion]]) {
    appendExplanation(document, details, label, text);
  }
  return details;
}

export function moreDetails(document, title) {
  const details = document.createElement('details'); details.className = 'more-details';
  const summary = document.createElement('summary'); summary.textContent = title; details.append(summary);
  return details;
}

export function renderFindings(document, container, findings, { collapseInfo = false } = {}) {
  container.replaceChildren();
  const ordered = [...findings.filter(item => item.level === 'review'), ...findings.filter(item => item.level !== 'review')];
  const info = collapseInfo ? moreDetails(document, 'Other page details') : null;
  for (const finding of ordered) (info && finding.level !== 'review' ? info : container).append(findingDetails(document, finding));
  if (info && info.children.length > 1) container.append(info);
}
