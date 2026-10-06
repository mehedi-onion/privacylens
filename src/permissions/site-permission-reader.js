import { permissionDefinitions, normalizePermissionState } from './permission-definitions.js';

function unavailable(reason) {
  return permissionDefinitions.map(({ id }) => ({ id, state: 'unavailable', reason }));
}

export async function readSitePermissions(chromeApi, tab) {
  let origin;
  try {
    const url = new URL(tab?.url);
    if (!['http:', 'https:'].includes(url.protocol)) return unavailable('unsupported-page');
    // Content settings use the origin. Drop credentials, paths and query values.
    origin = `${url.origin}/`;
  } catch {
    return unavailable('unsupported-page');
  }

  return Promise.all(permissionDefinitions.map(definition => {
    const api = chromeApi?.contentSettings?.[definition.id];
    if (typeof api?.get !== 'function') {
      return { id: definition.id, state: 'unavailable', reason: 'unsupported-api' };
    }
    // The callback form supports the existing Chrome 88+ baseline. Promise
    // support for this API starts at Chrome 96; no version bump is necessary.
    return new Promise(resolve => {
      try {
        api.get({ primaryUrl: origin, secondaryUrl: origin, incognito: tab?.incognito === true }, response => {
          // Read lastError inside the callback, without displaying or logging it.
          if (chromeApi.runtime?.lastError) {
            resolve({ id: definition.id, state: 'unavailable', reason: 'read-failed' });
            return;
          }
          const state = normalizePermissionState(response, definition);
          resolve({ id: definition.id, state,
            reason: state === 'unavailable' ? 'invalid-response' : null });
        });
      } catch {
        resolve({ id: definition.id, state: 'unavailable', reason: 'read-failed' });
      }
    });
  }));
}
