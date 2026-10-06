import { reputationMessages } from './reputation-messages.js';
import { appendExplanation, moreDetails } from '../ui/finding-view.js';
import { setEvidenceState } from '../ui/status-copy.js';

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
  const flags = report.counts.malicious + report.counts.suspicious;
  const verdicts = flags + report.counts.harmless + report.counts.undetected;
  setEvidenceState(document, 'reputation', { available: verdicts > 0, status: flags ? 'Review' : 'Normal' },
    verdicts ? `${flags} of ${verdicts} engines flagged this domain` : 'No vendor verdicts');
  const heading = document.createElement('p'); heading.textContent = advice.label;
  const source = document.createElement('p'); source.className = 'context'; source.textContent = `Checked: ${report.hostname}`;
  container.append(heading, source);
  const list = document.createElement('dl'); list.className = 'vt-counts';
  for (const [label, key] of [['Malicious', 'malicious'], ['Suspicious', 'suspicious'], ['Harmless', 'harmless'], ['Undetected', 'undetected']]) {
    const term = document.createElement('dt'); term.textContent = label;
    const count = document.createElement('dd'); count.textContent = String(report.counts[key]);
    list.append(term, count);
  }
  container.append(list);
  const details = moreDetails(document, 'What these results mean');
  for (const [label, text] of [['What was noticed', `VirusTotal reports ${report.counts.malicious} malicious and ${report.counts.suspicious} suspicious vendor verdicts for this hostname.`],
    ['Why this matters', advice.explanation], ['Consider', 'Check the official address through a source you trust. Keep the local findings in mind too.']]) {
    appendExplanation(document, details, label, text);
  }
  const caveat = document.createElement('p'); caveat.className = 'context'; caveat.textContent = advice.caveat; details.append(caveat);
  if (report.timeout !== null) { const timeout = document.createElement('p'); timeout.textContent = `Engines that timed out: ${report.timeout}`; details.append(timeout); }
  container.append(details);
}
