import { validKey } from '../reputation/key-store.js';
import { sendReputationMessage } from '../reputation/reputation-messages.js';

export function createOptionsController(chromeApi, document, { signal } = {}) {
  let revision = 0;
  const status = document.getElementById('key-status');
  function show(response) {
    const valid = response?.kind === 'key-status' && typeof response.configured === 'boolean' &&
      (response.configured ? ['session', 'remembered'].includes(response.mode) : response.mode === 'none');
    status.textContent = !valid ? 'Configuration could not be read or changed. No key is displayed; try again.' :
      response.configured !== true ? 'No key configured. Local checks remain available.' : response.mode === 'remembered'
        ? 'Key remembered locally in this browser profile.' : 'Key available in browser-session memory only.';
  }
  function busy(value) { for (const id of ['save-key', 'forget-key']) document.getElementById(id).disabled = value; }
  async function run(message) {
    if (signal?.aborted) return;
    const version = ++revision; busy(true);
    const response = await sendReputationMessage(chromeApi, message);
    if (signal?.aborted || version !== revision) return;
    show(response); busy(false);
  }
  return {
    load: () => run({ type: 'privacyLens:vt-status' }),
    save() {
      if (signal?.aborted) return Promise.resolve();
      const input = document.getElementById('vt-key');
      const key = input.value.trim(); // Only this user-provided settings field; never webpage inputs.
      input.value = '';
      if (!validKey(key)) { status.textContent = 'Enter the API key from your VirusTotal account. No request was sent.'; return Promise.resolve(); }
      return run({ type: 'privacyLens:vt-save-key', key, remember: document.getElementById('remember-key').checked === true });
    },
    forget() {
      document.getElementById('vt-key').value = '';
      document.getElementById('remember-key').checked = false;
      return run({ type: 'privacyLens:vt-forget-key' });
    },
    clear() { revision++; document.getElementById('vt-key').value = ''; document.getElementById('remember-key').checked = false; status.textContent = ''; }
  };
}
if (typeof chrome !== 'undefined' && typeof document !== 'undefined') {
  const lifecycle = new AbortController();
  const settings = createOptionsController(chrome, document, { signal: lifecycle.signal });
  document.getElementById('save-key').addEventListener('click', () => void settings.save());
  document.getElementById('forget-key').addEventListener('click', () => void settings.forget());
  void settings.load();
  window.addEventListener('pagehide', () => { lifecycle.abort(); settings.clear(); }, { once: true });
}
