import { readCurrentPage } from './page-reader.js';
import { clearPageScan, renderPageScan, setPageScanBusy } from './page-view.js';

export function createPageScanController(chromeApi, document, { signal } = {}) {
  let revision = 0;
  // Construction never scans. Only the popup's explicit button invokes scan().
  return {
    async scan() {
      if (signal?.aborted) return;
      const currentRead = ++revision;
      clearPageScan(document);
      setPageScanBusy(document, true);
      document.getElementById('page-scan-summary').textContent = 'Reading this page’s structure…';
      const result = await readCurrentPage(chromeApi, { signal });
      if (signal?.aborted || currentRead !== revision) return;
      renderPageScan(document, result);
      setPageScanBusy(document, false);
    },
    clear() {
      revision++;
      clearPageScan(document);
      setPageScanBusy(document, false);
    }
  };
}
