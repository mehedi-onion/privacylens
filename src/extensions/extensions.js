import { readInstalledExtensions } from './extension-reader.js';
import { adviseExtension, filterExtensions } from './extension-advisor.js';
import { renderAudit, clearAuditView, setAuditBusy } from './audit-view.js';

export function createAuditController(chromeApi, document, { signal } = {}) {
  // One snapshot in this page's memory only. No inventory is shared or cached.
  let inventory = null;
  let revision = 0;
  const render = () => {
    if (inventory) renderAudit(document, inventory, filterExtensions(inventory.items,
      document.getElementById('extension-search').value, document.getElementById('extension-filter').value));
  };
  return {
    async refresh() {
      const currentRead = ++revision;
      inventory = null;
      clearAuditView(document);
      setAuditBusy(document, true);
      document.getElementById('inventory-summary').textContent = 'Reading installed extensions…';
      const result = await readInstalledExtensions(chromeApi, { signal });
      if (signal?.aborted || currentRead !== revision) return;
      inventory = { ...result, items: result.items.map(adviseExtension) };
      render();
      setAuditBusy(document, false);
    },
    filter: render,
    clear() {
      revision++;
      inventory = null;
      clearAuditView(document);
      setAuditBusy(document, false);
    }
  };
}

if (typeof chrome !== 'undefined' && typeof document !== 'undefined') {
  const lifecycle = new AbortController();
  const controller = createAuditController(chrome, document, { signal: lifecycle.signal });
  document.getElementById('read-again').addEventListener('click', () => void controller.refresh());
  document.getElementById('extension-search').addEventListener('input', controller.filter);
  document.getElementById('extension-filter').addEventListener('change', controller.filter);
  window.addEventListener('pagehide', () => {
    lifecycle.abort();
    controller.clear();
  }, { once: true });
  void controller.refresh();
}
