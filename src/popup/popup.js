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

export async function scanCurrentTab(chromeApi, document, { signal, now = Date.now, schedule = setTimeout, unschedule = clearTimeout } = {}) {
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
  renderResult(document, result, permissions, navigationAdvice);
  renderNavigation(document, navigationAdvice);
  if (navigation.available) {
    const expiry = schedule(() => {
      if (signal?.aborted) return;
      renderNavigation(document, adviseNavigation(null, result));
      renderResult(document, result, permissions);
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
  const pageScan = createPageScanController(chrome, document, { signal: lifecycle.signal });
  const downloadCheck = createDownloadController(chrome, document, renderDownloadCheck, clearDownloadCheck, { signal: lifecycle.signal });
  document.getElementById('scan-page').addEventListener('click', () => void pageScan.scan());
  document.getElementById('read-download').addEventListener('click', () => void downloadCheck.read());
  void downloadCheck.read();
  void scanCurrentTab(chrome, document, { signal: lifecycle.signal });
  window.addEventListener('pagehide', () => {
    lifecycle.abort();
    pageScan.clear();
    downloadCheck.clear();
    clearPopup(document);
  }, { once: true });
}
