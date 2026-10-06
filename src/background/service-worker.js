import { createDownloadObserver } from '../downloads/download-observer.js';
import { createNavigationObserver } from '../navigation/navigation-observer.js';

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

export function registerNavigationWorker(chromeApi, options) {
  const api = chromeApi.webNavigation;
  const events = [api?.onCommitted, api?.onBeforeNavigate, chromeApi.tabs?.onRemoved,
    chromeApi.tabs?.onActivated, chromeApi.tabs?.onReplaced, chromeApi.windows?.onFocusChanged];
  const supported = typeof api?.getFrame === 'function' && typeof chromeApi.tabs?.query === 'function' &&
    events.every(event => typeof event?.addListener === 'function');
  const observer = supported ? createNavigationObserver(chromeApi, options) : null;
  chromeApi.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'privacyLens:navigation' || sender?.id !== chromeApi.runtime.id ||
        sender.url !== chromeApi.runtime.getURL('src/popup/popup.html') || sender.tab?.incognito === true ||
        !Number.isSafeInteger(message.tabId) || message.tabId < 0) return false;
    if (!observer) { respond(null); return false; }
    observer.read(message.tabId, respond);
    return true; // Only this finite local read; no persistent connection.
  });
  return observer;
}

// Synchronous registration on initial execution; no startup scans or history query.
if (typeof chrome !== 'undefined') {
  registerDownloadWorker(chrome);
  registerNavigationWorker(chrome);
}
