import { evidenceLabel } from './status-copy.js';

export const localFeatures = { address: 'Website address', permissions: 'Site permissions', page: 'Page structure',
  navigation: 'Navigation', download: 'Recent download' };
export function initialPrivacyState() {
  return { local: Object.fromEntries(Object.keys(localFeatures).map(id => [id, { checked: false }])),
    external: 'none', pending: false, keyMode: 'unknown', hostname: null, pendingHostname: null };
}
export function updateExternal(state, event) {
  if (event.keyMode) state.keyMode = ['none', 'session', 'remembered'].includes(event.keyMode) ? event.keyMode : 'unknown';
  if (event.phase === 'pending') {
    state.pending = true;
    state.pendingHostname = typeof event.hostname === 'string' && /^[a-z0-9.-]{1,253}$/.test(event.hostname) ? event.hostname : null;
  }
  if (event.phase === 'complete' || event.phase === 'cancel') {
    const transmission = event.phase === 'cancel' && state.pending ? 'possible' : event.transmission;
    if ((transmission === 'shared' || transmission === 'possible' && state.external !== 'shared') && state.pendingHostname) state.hostname = state.pendingHostname;
    state.pendingHostname = null;
    if (transmission === 'shared') state.external = 'shared';
    else if (transmission === 'possible' && state.external !== 'shared') state.external = 'possible';
    state.pending = false;
  }
}
export function privacySummary(state) {
  const external = state.external === 'shared'
    ? 'VirusTotal — hostname shared after confirmation. Your API key was sent as authentication.'
    : state.external === 'possible' || state.pending
      ? 'VirusTotal — confirmed lookup requested; the hostname and authentication key may have been shared.'
      : 'None. No external lookup was sent from this popup.';
  const key = { none: 'No VirusTotal key configured.', session: 'VirusTotal key: browser-session memory only.',
    remembered: 'VirusTotal key: remembered locally in this browser profile.',
    unknown: 'VirusTotal key storage: unavailable or not yet checked. See settings.' }[state.keyMode] ?? 'VirusTotal key storage: unavailable.';
  return { local: Object.entries(localFeatures).map(([id, label]) => `${label}: ${evidenceLabel(state.local[id])}`),
    external, stored: ['No browsing history saved.', 'No scan result saved.', key,
      'Anonymous request counters may remain in browser-session memory; no hostname or report is in them.'],
    overview: state.external === 'shared' ? `VirusTotal · shared: ${state.hostname ?? 'hostname'} · no results saved` :
      state.external === 'possible' || state.pending ? `VirusTotal · may have shared: ${state.pendingHostname ?? state.hostname ?? 'hostname'} · no results saved` :
        '✓ Local checks only · no results saved' };
}
export function renderPrivacySummary(document, state) {
  const model = privacySummary(state);
  for (const [id, value] of [['privacy-overview', model.overview], ['privacy-external', model.external]]) {
    const element = document.getElementById(id); if (element) element.textContent = value;
  }
  for (const [id, entries] of [['privacy-local', model.local], ['privacy-stored', model.stored]]) {
    const list = document.getElementById(id); if (!list) continue;
    list.replaceChildren();
    for (const text of entries) { const item = document.createElement('li'); item.textContent = text; list.append(item); }
  }
}
export function createPrivacyPresenter(document) {
  let state = initialPrivacyState();
  const render = () => renderPrivacySummary(document, state);
  render();
  return {
    local(id, reading) { if (Object.hasOwn(localFeatures, id)) state.local[id] = { ...reading }; render(); },
    external(event) { updateExternal(state, event); render(); },
    clear() {
      state = initialPrivacyState();
      for (const id of ['privacy-local', 'privacy-stored', 'privacy-overview', 'privacy-external']) {
        document.getElementById(id)?.replaceChildren();
      }
    }
  };
}
