import { collectPageMetadata } from './page-collector.js';
import { analyzePageMetadata, unavailablePageScan } from './page-analyzer.js';
import brands from '../../data/official-domains.js';

export async function readCurrentPage(chromeApi, { signal } = {}) {
  if (signal?.aborted) return unavailablePageScan();
  try {
    const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    if (signal?.aborted || !Number.isInteger(tab?.id) || tab.id < 0) return unavailablePageScan();
    const address = new URL(tab.url);
    if (!['http:', 'https:'].includes(address.protocol) || typeof chromeApi.scripting?.executeScript !== 'function') return unavailablePageScan();
    // No allFrames, MAIN world, persistent registration, CSS injection, or listeners.
    const results = await chromeApi.scripting.executeScript({ target: { tabId: tab.id },
      func: collectPageMetadata, args: [brands.map(brand => brand.name)] });
    if (signal?.aborted || !Array.isArray(results) || results.length !== 1 ||
        results[0]?.frameId !== 0 || results[0]?.result?.origin !== address.origin) return unavailablePageScan();
    return analyzePageMetadata(results[0].result);
  } catch {
    // Never log raw page data, tab URLs, identifiers, or browser errors.
    return unavailablePageScan();
  }
}
