import { analyzeUrl } from '../analysis/url-analyzer.js';
import { describeFilename } from './filename-rules.js';
import { explainDanger } from './danger-definitions.js';

function describeSource(value) {
  try {
    if (typeof value !== 'string' || value.length > 8192) throw new Error();
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return { available: false, label: 'Unavailable (non-HTTP source)', findings: [] };
    const result = analyzeUrl(url.origin);
    const selected = new Set(['http', 'ip-address', 'punycode', 'shortener', 'brand-mismatch', 'long-hostname', 'deep-hostname', 'nonstandard-port']);
    return { available: true, origin: url.origin, domain: result.domain, scheme: result.scheme,
      label: `${result.domain} (${result.scheme})`, findings: result.findings.filter(finding => selected.has(finding.id) && finding.level === 'review') };
  } catch { return { available: false, label: 'Unavailable', findings: [] }; }
}

// Copy a tiny whitelist only. No absolute paths, full URLs, timestamps or hashes.
export function normalizeDownload(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item) || item.incognito !== false || !Number.isSafeInteger(item.id) || item.id < 0) return null;
  const mime = typeof item.mime === 'string' ? item.mime.split(';')[0].trim().toLowerCase() : '';
  const danger = explainDanger(item.danger);
  return { id: item.id, filename: describeFilename(item.filename), source: describeSource(item.url),
    finalSource: describeSource(item.finalUrl), danger,
    state: ['in_progress', 'interrupted', 'complete'].includes(item.state) ? item.state : null,
    paused: typeof item.paused === 'boolean' ? item.paused : null,
    mime: /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime) && mime.length <= 120 ? mime : null,
    fileSize: Number.isSafeInteger(item.fileSize) && item.fileSize >= 0 ? item.fileSize : null };
}

export function explainDownload(metadata) {
  if (!metadata) return null;
  const findings = [];
  const add = (id, level, title, detected, why, suggestion) => findings.push({ id, level, title, detected, why, suggestion });
  const { filename, danger, source, finalSource } = metadata;
  add('browser-danger', danger.level, `Chrome: ${danger.title}`, danger.code || 'Unavailable', danger.explanation,
    'Use Chrome’s download information and check that you expected this file. PrivacyLens does not override Chrome warnings.');
  if (!filename.available) add('filename-unavailable', 'review', 'Filename unavailable', 'No usable basename was reported.',
    'Filename checks could not run. Missing metadata is not evidence of misuse.', 'Review Chrome’s download information.');
  if (filename.executable) add('executable', 'review', 'Executable / installer / script type', `Final filename extension: .${filename.extension}`,
    'This type can run code or install software when used. Legitimate installers use these extensions too.', 'Open it only if you expected it and trust the source.');
  if (filename.archive) add('archive', 'info', 'Archive / disk-image type', `Final filename extension: .${filename.extension}`,
    'An archive can contain other files; a disk image can contain software. PrivacyLens does not inspect what is inside.', 'Review the contents and source before using included files.');
  if (filename.doubleExtension) add('double-extension', 'review', 'Document-looking name ends in a runnable type', filename.display,
    'The earlier extension can make the file look like a document or image, while the final extension identifies a runnable type. The name alone does not establish intent.', 'Read the final extension before opening the file.');
  if (filename.spacing) add('filename-spacing', 'review', 'Large gap before filename extension', 'At least five spaces appear before the final extension.',
    'Spacing can make the final extension harder to notice. This is a naming signal only.', 'Read the whole name and final extension.');
  if (filename.directional) add('filename-direction', 'review', 'Filename contains directional formatting', 'Bidirectional control characters were replaced with visible Unicode escape labels.',
    'These formatting controls can change how a filename appears. Ordinary non-English letters alone are not flagged.', 'Review the escaped name and final extension in Chrome before opening.');
  const seen = new Set();
  for (const [label, address] of [['Source', source], ['Final source', finalSource]]) {
    if (!address.available) continue;
    for (const finding of address.findings) {
      const key = `${address.origin}|${finding.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      add(`source-${finding.id}`, 'review', `${label}: ${finding.title}`, address.domain, finding.why, finding.suggestion);
    }
  }
  if (!source.available || !finalSource.available) add('source-unavailable', 'info', 'Source comparison incomplete', 'At least one HTTP/HTTPS source could not be compared.',
    'Browser-generated, local, missing, or malformed addresses can limit this metadata check. No address was fetched.', 'Check the source shown by Chrome and confirm you intended this download.');
  if (source.available && finalSource.available && source.domain !== finalSource.domain) add('source-change', 'info', 'Source and final hostnames differ', `${source.domain} → ${finalSource.domain}`,
    'Chrome reports different original and final hosts. CDNs and download services often do this legitimately. PrivacyLens does not follow a redirect chain.', 'Check that the receiving download service is expected.');
  const additionalReview = findings.some(finding => finding.id !== 'browser-danger' && finding.id !== 'filename-unavailable' && finding.level === 'review');
  const high = danger.strong && additionalReview;
  if (high) add('download-combination', 'review', 'Browser warning plus another review signal', 'Chrome’s filename/source/content warning appears with a filename or source review signal.',
    'This combination deserves closer review. PrivacyLens has not inspected the file and does not make a malware verdict.', 'Review Chrome’s warning and verify the source before deciding what to do.');
  return { filename: filename.display, source: source.label, finalSource: finalSource.label,
    state: ({ in_progress: 'In progress', interrupted: 'Interrupted', complete: 'Complete' })[metadata.state] || 'Unavailable',
    paused: metadata.paused === null ? 'Unavailable' : metadata.paused ? 'Yes' : 'No',
    mime: metadata.mime || 'Unavailable', fileSize: metadata.fileSize,
    status: high ? 'High Attention' : findings.some(finding => finding.level === 'review') ? 'Review' : 'Normal', findings };
}
