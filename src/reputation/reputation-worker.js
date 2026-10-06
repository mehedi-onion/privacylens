import { createKeyStore } from './key-store.js';
import { createQuotaLimiter } from './quota-limiter.js';
import { hostnameFromTab, publicHostname, VT_ORIGIN } from './domain-rules.js';
import { lookupDomain } from './virustotal-client.js';

export function registerReputationWorker(chromeApi, { lookup = lookupDomain, now = Date.now } = {}) {
  const supported = ['local', 'session'].every(name => ['get', 'set', 'remove', 'setAccessLevel'].every(method =>
    typeof chromeApi.storage?.[name]?.[method] === 'function'));
  const store = supported ? createKeyStore(chromeApi) : null;
  const limiter = store ? createQuotaLimiter(store, { now }) : null;
  let pending = null;
  async function perform(message, controller) {
    if (!publicHostname(message.hostname)) return { kind: 'invalid-domain' };
    const [tab] = await chromeApi.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id !== message.tabId || hostnameFromTab(tab) !== message.hostname) return { kind: 'tab-changed' };
    if (!await chromeApi.permissions.contains({ origins: [VT_ORIGIN] })) return { kind: 'host-denied' };
    const { key } = await store.get();
    if (!key) return { kind: 'no-key' };
    if (controller.signal.aborted) return { kind: 'cancelled' };
    if (!await limiter.reserve()) return { kind: 'rate-limit' };
    if (controller.signal.aborted) return { kind: 'cancelled' };
    let result;
    try { result = await lookup(message.hostname, key, { signal: controller.signal }); }
    catch { return { kind: 'unavailable', transmission: 'possible' }; }
    const transmission = ['report', 'invalid-key', 'restricted', 'not-found', 'rate-limit', 'server-error', 'invalid-request', 'invalid-response'].includes(result.kind)
      ? 'shared' : ['no-key', 'invalid-domain'].includes(result.kind) ? 'none' : 'possible';
    if (result.kind === 'rate-limit') {
      try { await limiter.cooldown(result.retryAfterMs, result.quotaExceeded); }
      catch { return { kind: 'unavailable', transmission }; }
    }
    if (controller.signal.aborted) return { kind: 'cancelled', transmission };
    // No response cache, raw payload, domain list or report written to any storage area.
    return result.kind === 'report' ? { kind: 'report', report: result.report, transmission } : { kind: result.kind, transmission };
  }
  chromeApi.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender?.id !== chromeApi.runtime.id || sender.tab?.incognito === true) return false;
    const popup = sender.url === chromeApi.runtime.getURL('src/popup/popup.html');
    const settings = sender.url === chromeApi.runtime.getURL('src/options/options.html');
    const type = message?.type;
    if (!(popup || settings) || !['privacyLens:vt-status', 'privacyLens:vt-save-key', 'privacyLens:vt-forget-key',
      'privacyLens:vt-lookup', 'privacyLens:vt-cancel'].includes(type)) return false;
    if ((type === 'privacyLens:vt-save-key' || type === 'privacyLens:vt-forget-key') && !settings ||
        (type === 'privacyLens:vt-lookup' || type === 'privacyLens:vt-cancel') && !popup) return false;
    if (!store) { respond({ kind: 'unavailable' }); return false; }
    if (type === 'privacyLens:vt-cancel') {
      if (pending?.id === message.requestId) pending.controller.abort();
      respond({ kind: 'cancelled' }); return false;
    }
    let operation;
    if (type === 'privacyLens:vt-status') operation = store.status();
    else if (type === 'privacyLens:vt-save-key' || type === 'privacyLens:vt-forget-key') {
      pending?.controller.abort();
      operation = type === 'privacyLens:vt-save-key' ? store.save(message.key, message.remember) : store.forget();
    } else {
      if (message.confirmed !== true || !Number.isSafeInteger(message.tabId) || message.tabId < 0 ||
          typeof message.requestId !== 'string' || !/^[a-z0-9-]{1,80}$/.test(message.requestId)) return false;
      if (pending) { respond({ kind: 'busy' }); return false; }
      const task = { id: message.requestId, controller: new AbortController() };
      pending = task;
      operation = perform(message, task.controller).finally(() => { if (pending === task) pending = null; });
    }
    Promise.resolve(operation).then(value => {
      try { respond(type === 'privacyLens:vt-status' || settings ? { kind: 'key-status', ...value } : value); } catch { /* Closed view. */ }
    }, () => { try { respond({ kind: 'unavailable' }); } catch { /* No raw error or key. */ } });
    return true; // Finite local operation or one timeout-bounded, explicit lookup.
  });
  return store;
}
