// Current Chrome DangerType values. Other spellings use an honest fallback.
const definitions = {
  safe: ['No known danger reported', 'Chrome has not reported a known download danger signal. This is not a guarantee of safety.', false],
  file: ['Filename warning', 'Chrome reported a suspicious filename. Review the name and source before opening it.', true],
  url: ['Source URL warning', 'Chrome flagged the download source URL. PrivacyLens has not independently checked that source.', true],
  content: ['Downloaded-content warning', 'Chrome flagged the downloaded content. PrivacyLens has not read or scanned the file.', true],
  uncommon: ['Uncommon download', 'Chrome reports an uncommon download source. Uncommon does not necessarily mean malicious.', false],
  host: ['Hosting-source warning', 'Chrome flagged the hosting source. Review where you obtained this file.', true],
  unwanted: ['Potentially unwanted download', 'Chrome reported a potentially unwanted download, which could affect browser or computer settings.', true],
  accepted: ['Flagged download accepted', 'Chrome reports that the user accepted a flagged download. Acceptance does not establish safety.', false]
};

export const enterpriseDangerValues = Object.freeze([
  'allowlistedByPolicy', 'asyncScanning', 'asyncLocalPasswordScanning', 'passwordProtected',
  'blockedTooLarge', 'sensitiveContentWarning', 'sensitiveContentBlock', 'deepScannedFailed',
  'deepScannedSafe', 'deepScannedOpenedDangerous', 'promptForScanning',
  'promptForLocalPasswordScanning', 'accountCompromise', 'blockedScanFailed',
  'forceSaveToGdrive', 'forceSaveToOnedrive'
]);
export const documentedDangerValues = Object.freeze([...Object.keys(definitions), ...enterpriseDangerValues]);

export function explainDanger(value) {
  const code = typeof value === 'string' && /^[a-z][a-zA-Z_]{0,59}$/.test(value) ? value : null;
  if (code && Object.prototype.hasOwnProperty.call(definitions, code)) {
    const [title, explanation, strong] = definitions[code];
    return { code, title, explanation, level: code === 'safe' ? 'info' : 'review', strong };
  }
  if (enterpriseDangerValues.includes(code)) return { code, title: 'Browser policy / security workflow',
    explanation: 'Chrome reported a policy or security workflow classification. Its effect depends on browser version and organization policy. PrivacyLens does not infer more from this value.', level: 'review', strong: false };
  return { code, title: code ? 'Unrecognized browser classification' : 'Browser classification unavailable',
    explanation: 'PrivacyLens cannot explain this classification from the documented catalog. No safety or misuse conclusion was made.', level: 'review', strong: false };
}
