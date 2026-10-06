export const NAVIGATION_LIFETIME_MS = 5 * 60 * 1000;
export const transitionTypes = ['link', 'typed', 'auto_bookmark', 'auto_subframe', 'manual_subframe',
  'generated', 'start_page', 'form_submit', 'reload', 'keyword', 'keyword_generated'];
export const qualifierNames = ['server_redirect', 'client_redirect', 'forward_back', 'from_address_bar'];

export function navigationOrigin(input) {
  if (typeof input !== 'string') return null;
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return { origin: url.origin, domain: url.hostname.toLowerCase().replace(/\.$/, ''),
      scheme: url.protocol.slice(0, -1).toUpperCase() };
  } catch { return null; }
}

export function normalizeNavigation(event) {
  if (!event || Array.isArray(event) || event.frameId !== 0 || !Number.isSafeInteger(event.tabId) || event.tabId < 0 ||
      !transitionTypes.includes(event.transitionType) || !Array.isArray(event.transitionQualifiers) ||
      event.transitionQualifiers.length > 8 || !Array.from(event.transitionQualifiers).every(value => qualifierNames.includes(value)) ||
      (event.documentLifecycle !== undefined && event.documentLifecycle !== 'active') ||
      (event.frameType !== undefined && event.frameType !== 'outermost_frame')) return null;
  const documentId = event.documentId;
  // Chromium also returns compact UUIDs; preserve the exact browser identifier for correlation.
  if (documentId !== undefined && (typeof documentId !== 'string' || !/^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.test(documentId))) return null;
  const destination = navigationOrigin(event.url);
  if (!destination) return null;
  // No paths, queries, fragments, credentials, previous URLs or event timestamps.
  return { ...destination, documentId: documentId ?? null, transitionType: event.transitionType,
    qualifiers: qualifierNames.filter(value => event.transitionQualifiers.includes(value)) };
}

export function adviseNavigation(snapshot, urlResult) {
  const findings = [];
  const add = (id, level, title, detected, why, suggestion) => findings.push({ id, level, title, detected, why, suggestion });
  const available = Boolean(snapshot && urlResult?.available && snapshot.domain === urlResult.domain && snapshot.scheme === urlResult.scheme);
  if (!available) return { available: false, status: 'Normal', findings: [], summary:
    'Navigation details unavailable. PrivacyLens may not have observed this page, or the temporary snapshot was discarded. This does not mean there was no redirect.' };
  const redirects = snapshot.qualifiers.filter(value => ['server_redirect', 'client_redirect'].includes(value));
  for (const type of redirects) {
    const server = type === 'server_redirect';
    add(type, 'info', server ? 'Server redirect reported' : 'Client redirect reported',
      `Chrome reports one or more ${server ? 'server' : 'page-initiated'} redirects before this page loaded.`,
      server ? 'Server redirects use HTTP headers. They are common for HTTPS upgrades, sign-in and moving pages.' :
        'Client redirects use page scripts or refresh instructions. They are often part of ordinary site navigation.',
      'Check the final address if you were not expecting this destination.');
  }
  if (!redirects.length) add('no-redirect-qualifier', 'info', 'No redirect qualifier reported',
    'Chrome did not report a server or client redirect qualifier for this observed navigation.',
    'This is a limited browser signal, not proof of a direct path or site safety.', 'Still check the current address.');
  if (snapshot.qualifiers.includes('forward_back')) add('forward_back', 'info', 'Back or Forward navigation',
    'Chrome reports that Back or Forward initiated this navigation.', 'Returning to an earlier page is normal browser behavior.', 'Check that this is the page you intended to return to.');
  if (snapshot.qualifiers.includes('from_address_bar')) add('from_address_bar', 'info', 'Started from the address bar',
    'Chrome reports that this navigation started from the address bar.', 'This identifies how navigation began, not whether the destination is trustworthy.', 'Compare the final domain with the address you expected.');
  const reviewSignals = urlResult.findings.filter(finding => finding.level === 'review');
  if (redirects.length && reviewSignals.length) add('redirect-url-context', 'review', 'Redirect with URL review signals',
    `The final address also has these URL signals: ${reviewSignals.map(finding => finding.title).join('; ')}.`,
    'A redirect does not explain intent. Existing address signals make checking the destination more useful; no earlier domain or redirect chain is known.',
    'Review the URL findings and use an official address before entering sensitive information.');
  return { available: true, status: findings.some(finding => finding.level === 'review') ? 'Review' : 'Normal', findings,
    summary: redirects.length ? 'Chrome reports that this page was reached through a redirect. Redirects are common and often legitimate.' :
      'Chrome reported no redirect qualifier for this observed navigation.' };
}
