import { reputationMessages } from './reputation-messages.js';

export function clearReputation(document) {
  document.getElementById('vt-result').replaceChildren();
  document.getElementById('vt-consent').hidden = true;
  document.getElementById('vt-hostname').textContent = '';
}
export function showReputationMessage(document, kind) {
  const message = Object.hasOwn(reputationMessages, kind) ? reputationMessages[kind] : null;
  document.getElementById('vt-result').textContent = typeof message === 'string' ? message : reputationMessages['invalid-response'];
}
export function renderReputation(document, report, advice) {
  const container = document.getElementById('vt-result'); container.replaceChildren();
  const heading = document.createElement('p'); heading.textContent = advice.label;
  const status = document.createElement('p'); status.className = 'status'; status.dataset.status = advice.status;
  status.textContent = `URL + reputation guidance: ${advice.status}`;
  const source = document.createElement('p'); source.textContent = `Checked hostname: ${report.hostname}`;
  container.append(heading, status, source);
  const list = document.createElement('dl'); list.className = 'vt-counts';
  for (const [label, key] of [['Malicious', 'malicious'], ['Suspicious', 'suspicious'], ['Harmless', 'harmless'], ['Undetected', 'undetected']]) {
    const term = document.createElement('dt'); term.textContent = label;
    const count = document.createElement('dd'); count.textContent = String(report.counts[key]);
    list.append(term, count);
  }
  if (report.timeout !== null) {
    const term = document.createElement('dt'); term.textContent = 'Timeout';
    const count = document.createElement('dd'); count.textContent = String(report.timeout); list.append(term, count);
  }
  container.append(list);
  for (const text of [advice.explanation, advice.caveat, 'Closing this popup discards this reputation result.']) {
    const paragraph = document.createElement('p'); paragraph.className = 'permission-context'; paragraph.textContent = text; container.append(paragraph);
  }
}
