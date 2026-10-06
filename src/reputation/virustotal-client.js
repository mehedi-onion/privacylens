import { publicHostname } from './domain-rules.js';
import { validKey } from './key-store.js';
import { normalizeReport } from './reputation-advisor.js';

const endpoint = 'https://www.virustotal.com/api/v3/domains/';
export async function lookupDomain(hostname, key, { request = globalThis.fetch, signal,
  schedule = setTimeout, unschedule = clearTimeout, now = Date.now } = {}) {
  if (!publicHostname(hostname)) return { kind: 'invalid-domain' };
  if (!validKey(key)) return { kind: 'no-key' };
  if (signal?.aborted) return { kind: 'cancelled' };
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = schedule(abort, 12000);
  try {
    const response = await request(endpoint + encodeURIComponent(hostname), { method: 'GET',
      headers: { accept: 'application/json', 'x-apikey': key }, credentials: 'omit', cache: 'no-store',
      redirect: 'error', referrerPolicy: 'no-referrer', signal: controller.signal });
    if (controller.signal.aborted) return { kind: signal?.aborted ? 'cancelled' : 'network-error' };
    if (response.status === 429) {
      let code;
      try { code = (await response.json())?.error?.code; } catch { /* Ignore raw errors. */ }
      const retry = response.headers?.get('Retry-After');
      const delay = typeof retry === 'string' && /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - now();
      return { kind: 'rate-limit', retryAfterMs: Number.isSafeInteger(delay) && delay >= 60000 ? Math.min(delay, 86400000) : 60000,
        quotaExceeded: code === 'QuotaExceededError' };
    }
    const errors = { 400: 'invalid-request', 401: 'invalid-key', 403: 'restricted', 404: 'not-found' };
    if (errors[response.status]) return { kind: errors[response.status] };
    if (response.status >= 500) return { kind: 'server-error' };
    if (response.status !== 200) return { kind: 'invalid-response' };
    let payload;
    try { payload = await response.json(); } catch { return { kind: 'invalid-response' }; }
    const report = normalizeReport(payload, hostname);
    if (controller.signal.aborted) return { kind: signal?.aborted ? 'cancelled' : 'network-error' };
    return report ? { kind: 'report', report } : { kind: 'invalid-response' };
  } catch { return { kind: signal?.aborted ? 'cancelled' : 'network-error' }; }
  finally { unschedule(timer); signal?.removeEventListener('abort', abort); }
}
