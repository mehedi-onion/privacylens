import { hostnameFromTab, VT_ORIGIN } from './domain-rules.js';
import { analyzeUrl } from '../analysis/url-analyzer.js';
import { normalizeReport, adviseReputation } from './reputation-advisor.js';
import { sendReputationMessage } from './reputation-messages.js';
import { clearReputation, showReputationMessage, renderReputation } from './reputation-view.js';

export function createReputationController(chromeApi, document, { signal, onReport = () => {} } = {}) {
  let selection = null;
  let requestId = null;
  let revision = 0;
  const active = version => !signal?.aborted && version === revision;
  function cancelRequest() {
    if (requestId) void sendReputationMessage(chromeApi, { type: 'privacyLens:vt-cancel', requestId });
    requestId = null;
  }
  function clear() {
    revision++; selection = null; cancelRequest(); clearReputation(document); onReport(null);
    document.getElementById('vt-check').disabled = false;
    document.getElementById('vt-confirm').disabled = false;
  }
  return {
    async begin() {
      if (signal?.aborted) return;
      clear(); const version = revision;
      try {
        const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
        const hostname = hostnameFromTab(tab);
        if (!active(version)) return;
        if (!hostname) { showReputationMessage(document, 'invalid-domain'); return; }
        const status = await sendReputationMessage(chromeApi, { type: 'privacyLens:vt-status' });
        if (!active(version)) return;
        if (status.kind !== 'key-status' || status.configured !== true) { showReputationMessage(document, status.kind === 'key-status' ? 'no-key' : 'unavailable'); return; }
        selection = { hostname, tabId: tab.id };
        document.getElementById('vt-hostname').textContent = hostname;
        document.getElementById('vt-consent').hidden = false;
      } catch { if (active(version)) showReputationMessage(document, 'unavailable'); }
    },
    async confirm() {
      if (signal?.aborted || !selection || requestId) return;
      const chosen = selection; const version = revision; selection = null;
      document.getElementById('vt-confirm').disabled = true;
      document.getElementById('vt-check').disabled = true;
      try {
        // Called directly from the confirmation click, before any awaited work.
        const granted = await chromeApi.permissions.request({ origins: [VT_ORIGIN] });
        if (!active(version)) return;
        document.getElementById('vt-consent').hidden = true;
        if (!granted) { showReputationMessage(document, 'host-denied'); return; }
        requestId = `lookup-${Math.random().toString(36).slice(2)}`;
        document.getElementById('vt-result').textContent = 'Looking up the confirmed hostname…';
        const result = await sendReputationMessage(chromeApi, { type: 'privacyLens:vt-lookup', ...chosen, confirmed: true, requestId });
        if (!active(version)) return;
        requestId = null;
        const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
        if (!active(version)) return;
        if (tab?.id !== chosen.tabId || hostnameFromTab(tab) !== chosen.hostname) { showReputationMessage(document, 'tab-changed'); return; }
        if (result.kind !== 'report') { showReputationMessage(document, result.kind); return; }
        const raw = result.report;
        const report = normalizeReport({ data: { type: 'domain', id: raw?.hostname,
          attributes: { last_analysis_stats: { ...raw?.counts, ...(raw?.timeout === null ? {} : { timeout: raw?.timeout }) } } } }, chosen.hostname);
        if (!report) { showReputationMessage(document, 'invalid-response'); return; }
        renderReputation(document, report, adviseReputation(analyzeUrl(tab.url), report)); onReport(report);
      } catch { if (active(version)) showReputationMessage(document, 'unavailable'); }
      finally { if (active(version)) { document.getElementById('vt-check').disabled = false; document.getElementById('vt-confirm').disabled = false; } }
    },
    cancel() { clear(); if (!signal?.aborted) showReputationMessage(document, 'cancelled'); },
    clear
  };
}
