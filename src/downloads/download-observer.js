import { normalizeDownload, explainDownload } from './download-analyzer.js';

export const DOWNLOAD_LIFETIME_MS = 5 * 60 * 1000;
const relevantChanges = ['danger', 'filename', 'finalUrl', 'url', 'mime', 'fileSize', 'paused', 'state'];

export function createDownloadObserver(chromeApi, { now = Date.now, schedule = setTimeout, unschedule = clearTimeout } = {}) {
  const api = chromeApi.downloads;
  let latest = null;
  let expiresAt = 0;
  let expiryTimer;
  let revision = 0;
  const clear = () => {
    revision++;
    latest = null;
    expiresAt = 0;
    unschedule(expiryTimer);
    expiryTimer = undefined;
  };
  const record = item => {
    const metadata = normalizeDownload(item);
    if (!metadata) return;
    clear();
    latest = metadata;
    expiresAt = now() + DOWNLOAD_LIFETIME_MS;
    expiryTimer = schedule(clear, DOWNLOAD_LIFETIME_MS); // One cleanup, never polling or keep-alive.
  };
  const onCreated = item => { revision++; record(item); };
  const onChanged = delta => {
    if (!delta || !Number.isSafeInteger(delta.id) || delta.id < 0 ||
        !relevantChanges.some(key => delta[key] && typeof delta[key] === 'object' && Object.prototype.hasOwnProperty.call(delta[key], 'current'))) return;
    const currentRead = ++revision;
    try {
      // Event ID only: never query a history list or retrieve previous downloads.
      api.search({ id: delta.id }, items => {
        const failed = Boolean(chromeApi.runtime.lastError);
        if (failed || currentRead !== revision || !Array.isArray(items) || items.length !== 1 || items[0]?.id !== delta.id) return;
        record(items[0]); // Incognito items are discarded before filenames and sources are read.
      });
    } catch { /* Do not log raw browser errors, IDs, names or addresses. */ }
  };
  const onErased = id => {
    revision++; // A pending lookup must not restore metadata erased in Chrome.
    if (latest?.id === id) clear();
  };
  // Registration is synchronous so Chrome can wake the MV3 worker for these events.
  api.onCreated.addListener(onCreated);
  api.onChanged.addListener(onChanged);
  api.onErased.addListener(onErased);
  return {
    read() {
      if (latest && now() >= expiresAt) clear();
      return latest ? { available: true, check: explainDownload(latest), remainingMs: Math.max(1, expiresAt - now()) }
        : { available: false, check: null, remainingMs: 0 };
    },
    dispose() {
      clear();
      api.onCreated.removeListener(onCreated);
      api.onChanged.removeListener(onChanged);
      api.onErased.removeListener(onErased);
    }
  };
}
