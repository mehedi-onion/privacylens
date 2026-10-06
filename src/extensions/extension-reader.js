import { prepareInventory } from './extension-advisor.js';

export async function readInstalledExtensions(chromeApi, { signal } = {}) {
  if (signal?.aborted) return { available: false, items: [], skipped: 0, excluded: 0 };
  const api = chromeApi?.management;
  if (typeof api?.getAll !== 'function') {
    return { available: false, items: [], skipped: 0, excluded: 0 };
  }
  let raw;
  try { raw = await api.getAll(); }
  catch { return { available: false, items: [], skipped: 0, excluded: 0 }; }
  if (signal?.aborted) return { available: false, items: [], skipped: 0, excluded: 0 };
  const inventory = prepareInventory(raw, chromeApi?.runtime?.id);
  // Read warnings sequentially. Only extension items shown in this scan are read.
  const items = [];
  for (const item of inventory.items) {
    if (signal?.aborted) break;
    let warnings = [];
    let warningsAvailable = false;
    if (typeof api.getPermissionWarningsById === 'function') {
      try {
        const result = await api.getPermissionWarningsById(item.id);
        warningsAvailable = Array.isArray(result) && result.every(warning => typeof warning === 'string');
        if (warningsAvailable) warnings = [...result];
      } catch { /* Do not log IDs, inventory data, or raw API errors. */ }
    }
    if (signal?.aborted) return { available: false, items: [], skipped: 0, excluded: 0 };
    const { id, ...metadata } = item;
    items.push({ ...metadata, warnings, warningsAvailable });
  }
  return { available: inventory.available, items, skipped: inventory.skipped, excluded: inventory.excluded };
}
