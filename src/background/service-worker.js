import { createDownloadObserver } from '../downloads/download-observer.js';

export function registerDownloadWorker(chromeApi, options) {
  const api = chromeApi.downloads;
  const supported = typeof api?.search === 'function' &&
    ['onCreated', 'onChanged', 'onErased'].every(event => typeof api[event]?.addListener === 'function');
  const observer = supported ? createDownloadObserver(chromeApi, options) : null;
  chromeApi.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'privacyLens:recent-download' || sender?.id !== chromeApi.runtime.id ||
        sender.url !== chromeApi.runtime.getURL('src/popup/popup.html') || sender.tab?.incognito === true) return false;
    respond(observer ? observer.read() : null);
    return false; // Synchronous local response; no open port or keep-alive.
  });
  return observer;
}

// Top-level synchronous event registration, with no startup scans or history query.
if (typeof chrome !== 'undefined') registerDownloadWorker(chrome);
