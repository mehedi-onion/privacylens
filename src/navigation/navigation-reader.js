import { NAVIGATION_LIFETIME_MS, navigationOrigin, qualifierNames, transitionTypes } from './navigation-advisor.js';

const empty = () => ({ available: false, snapshot: null, remainingMs: 0 });
export async function readNavigation(chromeApi, tab, { signal, now = Date.now } = {}) {
  const destination = navigationOrigin(tab?.url);
  if (signal?.aborted || tab?.incognito !== false || !Number.isSafeInteger(tab.id) || tab.id < 0 || !destination) return empty();
  const started = now();
  try {
    return await new Promise(resolve => {
      chromeApi.runtime.sendMessage({ type: 'privacyLens:navigation', tabId: tab.id }, response => {
        const failed = Boolean(chromeApi.runtime.lastError);
        if (signal?.aborted || failed || response?.available !== true) { resolve(empty()); return; }
        const snapshot = response.snapshot;
        const origin = navigationOrigin(snapshot?.origin);
        if (!snapshot || !origin || origin.origin !== snapshot.origin || origin.origin !== destination.origin ||
            snapshot.domain !== origin.domain || snapshot.scheme !== origin.scheme || !transitionTypes.includes(snapshot.transitionType) ||
            !Array.isArray(snapshot.qualifiers) || snapshot.qualifiers.length > 4 ||
            !Array.from(snapshot.qualifiers).every(value => qualifierNames.includes(value)) ||
            !Number.isInteger(response.remainingMs) || response.remainingMs <= 0 || response.remainingMs > NAVIGATION_LIFETIME_MS) {
          resolve(empty()); return;
        }
        const remainingMs = response.remainingMs - Math.max(0, now() - started);
        if (remainingMs <= 0) { resolve(empty()); return; }
        resolve({ available: true, remainingMs, snapshot: { ...origin, transitionType: snapshot.transitionType,
          qualifiers: qualifierNames.filter(value => snapshot.qualifiers.includes(value)) } });
      });
    });
  } catch { return empty(); }
}
