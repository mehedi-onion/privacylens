import { analyzeUrl } from '../analysis/url-analyzer.js';
import { renderResult } from './popup-view.js';
import { readSitePermissions } from '../permissions/site-permission-reader.js';
import { advisePermissions } from '../permissions/permission-advisor.js';
import { createPageScanController } from '../page/page-controller.js';

export async function scanCurrentTab(chromeApi, document, { signal } = {}) {
  let tab;
  try {
    [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
  } catch {
    // Do not log tab addresses or raw errors, which could contain private data.
  }
  if (signal?.aborted) return;
  const result = analyzeUrl(tab?.url);
  const readings = await readSitePermissions(chromeApi, tab);
  if (signal?.aborted) return;
  renderResult(document, result, advisePermissions(readings));
}

export function clearPopup(document) {
  for (const id of ['domain', 'scheme', 'summary', 'status', 'permissions-context']) {
    document.getElementById(id).textContent = '';
  }
  for (const id of ['findings', 'permission-notes', 'site-permissions']) {
    document.getElementById(id).replaceChildren();
  }
}

// Browser globals stay here; the analyzer can also run in offline Node tests.
if (typeof chrome !== 'undefined' && typeof document !== 'undefined') {
  const lifecycle = new AbortController();
  const pageScan = createPageScanController(chrome, document, { signal: lifecycle.signal });
  document.getElementById('scan-page').addEventListener('click', () => void pageScan.scan());
  void scanCurrentTab(chrome, document, { signal: lifecycle.signal });
  window.addEventListener('pagehide', () => {
    lifecycle.abort();
    pageScan.clear();
    clearPopup(document);
  }, { once: true });
}
