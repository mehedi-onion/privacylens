export const reputationMessages = {
  'no-key': 'Add your own VirusTotal key in settings to use this check. Local checks still work without one.',
  'invalid-domain': 'Only a public website hostname can be checked. Local/internal names, IP addresses and private tabs are excluded.',
  'invalid-key': 'VirusTotal rejected the key or account authentication. Check your key and account activation in settings.',
  restricted: 'VirusTotal did not allow this request. Check your account permissions and API terms.',
  'not-found': 'No existing VirusTotal report found. PrivacyLens will not submit or rescan it.',
  'rate-limit': 'VirusTotal rate limit reached. Try again later. PrivacyLens does not retry automatically.',
  'server-error': 'VirusTotal is unavailable right now. You can try again later.',
  'network-error': 'The VirusTotal request failed or timed out. Nothing was retried.',
  'invalid-request': 'VirusTotal could not process this domain lookup.',
  'invalid-response': 'PrivacyLens could not read the VirusTotal report, so it has no result to show.',
  'host-denied': 'Browser access to VirusTotal was not allowed. No lookup was sent.',
  'tab-changed': 'The current tab or hostname changed. Start a fresh check and confirm its hostname.',
  busy: 'A reputation lookup is already running. Wait or cancel it.',
  cancelled: 'Reputation check cancelled. A request already sent cannot be recalled.',
  unavailable: 'PrivacyLens could not read or update the VirusTotal settings. Local checks still work.'
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
