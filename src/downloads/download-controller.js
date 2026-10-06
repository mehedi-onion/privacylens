import { DOWNLOAD_LIFETIME_MS } from './download-observer.js';

const empty = () => ({ available: false, check: null, remainingMs: 0 });
function validated(response) {
  if (response?.available === false) return empty();
  const check = response?.check;
  const short = (value, limit = 512) => typeof value === 'string' && value.length <= limit;
  if (response?.available !== true || !Number.isInteger(response.remainingMs) || response.remainingMs <= 0 ||
      response.remainingMs > DOWNLOAD_LIFETIME_MS || !check ||
      !['filename', 'source', 'finalSource', 'state', 'paused', 'mime'].every(key => short(check[key])) ||
      !['Normal', 'Review', 'High Attention'].includes(check.status) ||
      !(check.fileSize === null || Number.isSafeInteger(check.fileSize) && check.fileSize >= 0) ||
      !Array.isArray(check.findings) || check.findings.length > 32 ||
      !Array.from(check.findings).every(finding => finding && ['info', 'review'].includes(finding.level) &&
        ['id', 'title', 'detected', 'why', 'suggestion'].every(key => short(finding[key], 2048)))) return null;
  return { available: true, remainingMs: response.remainingMs, check: {
    ...Object.fromEntries(['filename', 'source', 'finalSource', 'state', 'paused', 'mime', 'status', 'fileSize'].map(key => [key, check[key]])),
    findings: check.findings.map(finding => Object.fromEntries(['id', 'level', 'title', 'detected', 'why', 'suggestion'].map(key => [key, finding[key]])))
  } };
}

export async function readRecentDownload(chromeApi, { signal, now = Date.now } = {}) {
  if (signal?.aborted) return empty();
  const requestedAt = now();
  try {
    const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    if (signal?.aborted || tab?.incognito !== false) return empty();
    return await new Promise(resolve => {
      chromeApi.runtime.sendMessage({ type: 'privacyLens:recent-download' }, response => {
        const failed = Boolean(chromeApi.runtime.lastError);
        if (signal?.aborted) { resolve(empty()); return; }
        const result = failed ? null : validated(response);
        if (result?.available) {
          result.remainingMs -= Math.max(0, now() - requestedAt);
          if (result.remainingMs <= 0) { resolve(empty()); return; }
        }
        resolve(result);
      });
    });
  } catch { return null; }
}

export function createDownloadController(chromeApi, document, render, clear, { signal, schedule = setTimeout, unschedule = clearTimeout } = {}) {
  let revision = 0;
  let expiryTimer;
  return {
    async read() {
      if (signal?.aborted) return;
      const currentRead = ++revision;
      unschedule(expiryTimer);
      clear(document);
      const result = await readRecentDownload(chromeApi, { signal });
      if (signal?.aborted || currentRead !== revision) return;
      render(document, result);
      if (result?.available) expiryTimer = schedule(() => {
        clear(document);
        render(document, empty());
      }, result.remainingMs);
    },
    clear() {
      revision++;
      unschedule(expiryTimer);
      clear(document);
    }
  };
}
