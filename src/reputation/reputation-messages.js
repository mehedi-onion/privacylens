export const reputationMessages = {
  'no-key': 'No VirusTotal key configured. Add your own key in settings; local checks still work.',
  'invalid-domain': 'Only a public website hostname can be checked. Local/internal names, IP addresses and private tabs are excluded.',
  'invalid-key': 'VirusTotal rejected the key or account authentication. Check your key and account activation in settings.',
  restricted: 'VirusTotal restricted this request. Check your account permissions and API terms.',
  'not-found': 'No existing VirusTotal report found. PrivacyLens will not submit or rescan it.',
  'rate-limit': 'VirusTotal rate limit reached. Try again later. PrivacyLens does not retry automatically.',
  'server-error': 'VirusTotal is temporarily unavailable. Try again later if you choose.',
  'network-error': 'The VirusTotal request failed or timed out. Nothing was retried.',
  'invalid-request': 'VirusTotal could not process this domain lookup.',
  'invalid-response': 'VirusTotal returned an unreadable or incomplete report. No reputation assessment was made.',
  'host-denied': 'VirusTotal host access was not granted. No lookup was sent.',
  'tab-changed': 'The current tab or hostname changed. Start a fresh check and confirm its hostname.',
  busy: 'A reputation lookup is already running. Wait or cancel it.',
  cancelled: 'Reputation check cancelled. A request already sent cannot be recalled.',
  unavailable: 'VirusTotal configuration could not be read or updated. Local checks remain available.'
};

export function sendReputationMessage(chromeApi, message) {
  return new Promise(resolve => {
    try {
      chromeApi.runtime.sendMessage(message, response => {
        resolve(chromeApi.runtime.lastError ? { kind: 'unavailable' } : response ?? { kind: 'unavailable' });
      });
    } catch { resolve({ kind: 'unavailable' }); }
  });
}
