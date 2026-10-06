import { analyzeUrl } from '../analysis/url-analyzer.js';
import { renderResult } from './popup-view.js';
import { readSitePermissions } from '../permissions/site-permission-reader.js';
import { advisePermissions } from '../permissions/permission-advisor.js';
import { createPageScanController } from '../page/page-controller.js';
import { createDownloadController } from '../downloads/download-controller.js';
import { renderDownloadCheck, clearDownloadCheck } from '../downloads/download-view.js';
import { readNavigation } from '../navigation/navigation-reader.js';
import { adviseNavigation } from '../navigation/navigation-advisor.js';
import { renderNavigation, clearNavigation } from '../navigation/navigation-view.js';
import { createReputationController } from '../reputation/reputation-controller.js';
import { adviseReputation } from '../reputation/reputation-advisor.js';
import { createPrivacyPresenter } from '../ui/privacy-summary.js';
import { sendReputationMessage } from '../reputation/reputation-messages.js';

export async function scanCurrentTab(chromeApi, document, { signal, now = Date.now, schedule = setTimeout, unschedule = clearTimeout, renderLocal = renderResult, onNavigation = () => {} } = {}) {
  let tab;
  try {
    [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  } catch {
    // Do not log tab addresses or raw errors, which could contain private data.
  }
  if (signal?.aborted) return;
  const result = analyzeUrl(tab?.url);
  const [readings, received] = await Promise.all([readSitePermissions(chromeApi, tab),
    readNavigation(chromeApi, tab, { signal, now }).then(value => ({ value, receivedAt: now() }))]);
  if (signal?.aborted) return;
  const navigation = received.value;
  navigation.remainingMs -= Math.max(0, now() - received.receivedAt);
  if (navigation.remainingMs <= 0) { navigation.available = false; navigation.snapshot = null; }
  const permissions = advisePermissions(readings);
  const navigationAdvice = adviseNavigation(navigation.snapshot, result);
  renderLocal(document, result, permissions, navigationAdvice);
  renderNavigation(document, navigationAdvice);
  onNavigation(navigationAdvice);
  if (navigation.available) {
    const expiry = schedule(() => {
      if (signal?.aborted) return;
      renderNavigation(document, adviseNavigation(null, result));
      onNavigation(adviseNavigation(null, result));
      renderLocal(document, result, permissions);
    }, navigation.remainingMs);
    signal?.addEventListener('abort', () => unschedule(expiry), { once: true });
  }
}

export function clearPopup(document) {
  for (const id of ['domain', 'scheme', 'summary', 'status', 'permissions-context']) {
    document.getElementById(id).textContent = '';
  }
  for (const id of ['findings', 'permission-notes', 'site-permissions']) {
    document.getElementById(id).replaceChildren();
  }
  clearNavigation(document);
}

// Browser globals stay here; the analyzer can also run in offline Node tests.
if (typeof chrome !== 'undefined' && typeof document !== 'undefined') {
  const lifecycle = new AbortController();
  const privacy = createPrivacyPresenter(document);
  let context = null;
  let reputation = null;
  function renderLocal(doc, result, permissions, navigation = { status: 'Normal' }) {
    context = { result, permissions, navigation };
    const external = reputation?.hostname === result.domain ? adviseReputation(result, reputation) : null;
    renderResult(doc, result, permissions, navigation, external);
    privacy.local('address', { available: result.available, status: result.status });
    privacy.local('permissions', { available: permissions.permissions.some(item => item.state !== 'unavailable'), status: permissions.status });
  }
  const reputationCheck = createReputationController(chrome, document, { signal: lifecycle.signal, onReport(report) {
    reputation = report;
    if (context && !lifecycle.signal.aborted) renderLocal(document, context.result, context.permissions, context.navigation);
  }, onPrivacy: event => { if (!lifecycle.signal.aborted) privacy.external(event); } });
  const pageScan = createPageScanController(chrome, document, { signal: lifecycle.signal, onState: state => privacy.local('page', state) });
  const downloadCheck = createDownloadController(chrome, document, (doc, result) => {
    renderDownloadCheck(doc, result);
    privacy.local('download', { available: result?.available, checked: result === null || result?.available === true, status: result?.check?.status });
  }, clearDownloadCheck, { signal: lifecycle.signal });
  document.getElementById('scan-page').addEventListener('click', () => void pageScan.scan());
  document.getElementById('read-download').addEventListener('click', () => void downloadCheck.read());
  document.getElementById('vt-check').addEventListener('click', () => void reputationCheck.begin());
  document.getElementById('vt-confirm').addEventListener('click', () => void reputationCheck.confirm());
  document.getElementById('vt-cancel').addEventListener('click', () => reputationCheck.cancel());
  void downloadCheck.read();
  void scanCurrentTab(chrome, document, { signal: lifecycle.signal, renderLocal, onNavigation: state => privacy.local('navigation', state) });
  // Configuration metadata only; no key is returned and this never starts a lookup.
  void sendReputationMessage(chrome, { type: 'privacyLens:vt-status' }).then(value => {
    if (!lifecycle.signal.aborted) privacy.external({ keyMode: value.kind === 'key-status' ? value.configured ? value.mode : 'none' : 'unknown' });
  });
  window.addEventListener('pagehide', () => {
    lifecycle.abort();
    pageScan.clear();
    downloadCheck.clear();
    reputationCheck.clear();
    reputation = null; context = null;
    clearPopup(document);
    privacy.clear();
  }, { once: true });
}
