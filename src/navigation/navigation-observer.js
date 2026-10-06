import { NAVIGATION_LIFETIME_MS, navigationOrigin, normalizeNavigation } from './navigation-advisor.js';

const empty = () => ({ available: false, snapshot: null, remainingMs: 0 });
export function createNavigationObserver(chromeApi, { now = Date.now, schedule = setTimeout, unschedule = clearTimeout } = {}) {
  let current = null;
  let pendingTabId = null;
  let deadline = 0;
  let timer;
  let revision = 0;
  let disposed = false;
  const bindings = [];
  function clear() {
    revision++;
    current = null;
    pendingTabId = null;
    deadline = 0;
    unschedule(timer);
  }
  function expire() { if (current && now() >= deadline) clear(); }
  function onCommitted(details) {
    if (disposed || details?.frameId !== 0 || !Number.isSafeInteger(details.tabId) || details.tabId < 0) return;
    const version = ++revision;
    pendingTabId = details.tabId;
    // Check only the focused active tab's basic metadata before inspecting its URL.
    try {
      chromeApi.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
        const failed = Boolean(chromeApi.runtime.lastError);
        if (disposed || version !== revision) return;
        pendingTabId = null;
        const tab = Array.isArray(tabs) && tabs.length === 1 ? tabs[0] : null;
        if (failed || tab?.id !== details.tabId) return;
        if (tab.incognito !== false || tab.active !== true || !Number.isSafeInteger(tab.windowId) || tab.windowId < 0) { clear(); return; }
        const snapshot = normalizeNavigation(details);
        clear(); // A new active document replaces the old one, even if unsupported.
        if (!snapshot) return;
        current = { ...snapshot, tabId: tab.id, windowId: tab.windowId };
        deadline = now() + NAVIGATION_LIFETIME_MS;
        timer = schedule(clear, NAVIGATION_LIFETIME_MS);
      });
    } catch { if (version === revision) clear(); }
  }
  function invalidateTab(tabId) { if (tabId === current?.tabId || tabId === pendingTabId) clear(); }
  function onBeforeNavigate(details) { if (details?.frameId === 0) invalidateTab(details.tabId); }
  function onActivated() { clear(); }
  function onFocusChanged() { clear(); }
  function onReplaced(_added, removed) { invalidateTab(removed); }
  function bind(event, handler) { event.addListener(handler); bindings.push([event, handler]); }
  bind(chromeApi.webNavigation.onCommitted, onCommitted);
  bind(chromeApi.webNavigation.onBeforeNavigate, onBeforeNavigate);
  bind(chromeApi.tabs.onRemoved, invalidateTab);
  bind(chromeApi.tabs.onActivated, onActivated);
  bind(chromeApi.tabs.onReplaced, onReplaced);
  bind(chromeApi.windows.onFocusChanged, onFocusChanged);
  return {
    read(tabId, respond) {
      expire();
      const captured = current;
      const version = revision;
      if (disposed || !captured || captured.tabId !== tabId) { respond(empty()); return; }
      try {
        chromeApi.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
          const failed = Boolean(chromeApi.runtime.lastError);
          expire();
          const tab = Array.isArray(tabs) && tabs.length === 1 ? tabs[0] : null;
          if (disposed || version !== revision) { respond(empty()); return; }
          if (failed || tab?.id !== tabId || tab.incognito !== false || tab.active !== true || tab.windowId !== captured.windowId) {
            clear(); respond(empty()); return;
          }
          try {
            chromeApi.webNavigation.getFrame({ tabId, frameId: 0 }, frame => {
              const frameFailed = Boolean(chromeApi.runtime.lastError);
              expire();
              if (disposed || version !== revision) { respond(empty()); return; }
              const origin = navigationOrigin(frame?.url);
              const sameDocument = captured.documentId === null || frame?.documentId === captured.documentId;
              if (frameFailed || frame?.errorOccurred !== false || !sameDocument || origin?.origin !== captured.origin ||
                  (frame.documentLifecycle !== undefined && frame.documentLifecycle !== 'active')) {
                clear(); respond(empty()); return;
              }
              respond({ available: true, remainingMs: deadline - now(), snapshot: {
                origin: captured.origin, domain: captured.domain, scheme: captured.scheme,
                transitionType: captured.transitionType, qualifiers: [...captured.qualifiers]
              } });
            });
          } catch { if (version === revision) clear(); respond(empty()); }
        });
      } catch { if (version === revision) clear(); respond(empty()); }
    },
    dispose() {
      disposed = true;
      clear();
      for (const [event, handler] of bindings) event.removeListener(handler);
    }
  };
}
