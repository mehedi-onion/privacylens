import { VT_ORIGIN } from '../reputation/domain-rules.js';

export const permissionUses = [
  { permission: 'activeTab', title: 'The current website', why: 'Read the website you choose to check.',
    uses: 'Read the active tab address after you open PrivacyLens; permit a page scan after your click.',
    doesNot: 'No persistent access to every website and no browsing-history database.',
    boundary: 'Temporary access can also support page changes. PrivacyLens uses it to read, not change, the page.' },
  { permission: 'contentSettings', title: 'Site settings', why: 'Explain what the current site is allowed to request.',
    uses: 'Read camera, microphone, location, notification, pop-up and automatic-download settings.',
    doesNot: 'No setting changes, device recordings, location collection or proof that a permission was used.',
    boundary: 'Chrome bundles reading and changing settings. PrivacyLens calls only the reading API.' },
  { permission: 'management', title: 'Installed extensions', why: 'Explain your other extensions’ listed capabilities.',
    uses: 'Read installed-extension metadata and Chrome permission warnings when the audit opens.',
    doesNot: 'No disabling, uninstalling, launching, permission changes, monitoring or saved inventory.',
    boundary: 'Chrome grants management powers as well as reading. PrivacyLens deliberately uses only the two read APIs.' },
  { permission: 'scripting', title: 'Page structure', why: 'Inspect the page only after Scan this page.',
    uses: 'Run one bundled collector in the top frame to read structural form and link metadata.',
    doesNot: 'No typed values, passwords, page changes, form submission, crawling or continuous content script.',
    boundary: 'The API can change pages. PrivacyLens uses only a one-shot, read-only collector.' },
  { permission: 'downloads', title: 'Download metadata', why: 'Explain a newly observed download.',
    uses: 'Read basename, Chrome danger classification, source/final origins, MIME/type, size and state when available. Keep one temporary event.',
    doesNot: 'No opening files, reading contents, hashing, uploading, deleting, cancelling or download-history list.',
    boundary: 'Chrome grants broader download management and history access. PrivacyLens observes events and reads only the changed event ID.' },
  { permission: 'webNavigation', title: 'Current navigation', why: 'Explain Chrome-reported redirects for the current tab.',
    uses: 'Read top-level navigation qualifiers and verify the current frame/document. Keep at most one current snapshot.',
    doesNot: 'No complete redirect-chain reconstruction, traffic recording, browsing-history log or navigation changes.',
    boundary: 'This API can observe more navigation. The implementation restricts records to the focused active regular tab and clears them on lifecycle changes.' },
  { permission: 'storage', title: 'Optional key and request budget', why: 'Keep your optional key and avoid excessive reputation requests.',
    uses: 'Use trusted-context session memory for the key and four anonymous quota numbers. Save only the key locally when Remember is checked.',
    doesNot: 'No sync, scan results, URLs, domains, reports, inventories, history or user profiles in storage.',
    boundary: 'Chrome storage can hold other data. PrivacyLens restricts writes to these named key/quota fields; it is not an encrypted secret vault.' },
  { permission: VT_ORIGIN, optional: true, title: 'Optional VirusTotal access', why: 'Retrieve an existing domain report after confirmation.',
    uses: 'One HTTPS domain GET with the selected hostname and your key as authentication, after each confirmed request.',
    doesNot: 'No automatic lookup, full URL/query/fragment sharing, submission, rescan, file upload or other external reputation service.',
    boundary: 'Chrome grants the whole API host, not one path. Code and connection policy restrict use to the domain-report path. VirusTotal can retain/share queried indicators.' }
];
export const dataBoundaries = [
  ...['URL analysis', 'Site permissions', 'Page scan', 'Extension audit', 'Download metadata', 'Navigation'].map(feature =>
    ({ feature, local: 'Yes', external: 'No', persisted: 'No' })),
  { feature: 'VirusTotal lookup', local: 'Partly', external: 'Hostname, after confirmation; normal connection metadata such as IP address.', persisted: 'Result: No' },
  { feature: 'VirusTotal API key', local: 'Yes', external: 'Sent to VirusTotal as authentication during a requested lookup.', persisted: 'Session only by default; local only if Remember is selected.' },
  { feature: 'Anonymous request budget', local: 'Yes', external: 'No', persisted: 'Session memory only; four numbers, no hostname or report.' }
];
export const limitations = [
  'A website’s honesty or what it will do later.',
  'Whether a website will misuse an allowed permission.',
  'Whether an extension actually misuses its capabilities.',
  'Whether a downloaded file is harmless; file contents are not inspected.',
  'Whether a clean VirusTotal result guarantees safety; it does not, and reports may be incomplete or old.',
  'A complete redirect history when Chrome only exposes qualifiers.',
  'Activities Chrome does not expose through the approved extension APIs.'
];
