export const KEY_SLOT = 'privacyLensVtKey';
export const QUOTA_SLOT = 'privacyLensVtQuota';
export const validKey = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{16,256}$/.test(value);
export function validQuota(value) {
  return value && Object.keys(value).length === 4 && ['day', 'count', 'nextAt', 'blockedUntil'].every(field =>
    Number.isSafeInteger(value[field]) && value[field] >= 0) && value.count <= 500;
}

export function createKeyStore(chromeApi) {
  const areas = chromeApi.storage;
  // Set before any secret is written/read; never expose storage to content scripts.
  const ready = Promise.all([areas.local, areas.session].map(area => Promise.resolve().then(() =>
    area.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })))).then(() => true, () => false);
  let queue = Promise.resolve();
  function exclusive(action) {
    const task = queue.then(async () => {
      if (!await ready) throw new Error('Key storage unavailable');
      return action();
    });
    queue = task.catch(() => {});
    return task;
  }
  async function readKey() {
    const session = await areas.session.get(KEY_SLOT);
    if (validKey(session?.[KEY_SLOT])) return { key: session[KEY_SLOT], mode: 'session' };
    const local = await areas.local.get(KEY_SLOT);
    return validKey(local?.[KEY_SLOT]) ? { key: local[KEY_SLOT], mode: 'remembered' } : { key: null, mode: 'none' };
  }
  return {
    get: () => exclusive(readKey),
    status: () => exclusive(async () => { const { key, mode } = await readKey(); return { configured: Boolean(key), mode }; }),
    save(value, remember) {
      const key = typeof value === 'string' ? value.trim() : '';
      if (!validKey(key) || typeof remember !== 'boolean') return Promise.reject(new Error('Invalid key input'));
      return exclusive(async () => {
        await areas.local.remove(KEY_SLOT);
        await areas.session.remove(KEY_SLOT);
        await (remember ? areas.local : areas.session).set({ [KEY_SLOT]: key });
        return { configured: true, mode: remember ? 'remembered' : 'session' };
      });
    },
    forget: () => exclusive(async () => {
      const results = await Promise.allSettled([areas.local.remove(KEY_SLOT), areas.session.remove(KEY_SLOT)]);
      if (results.some(result => result.status === 'rejected')) throw new Error('Key removal failed');
      return { configured: false, mode: 'none' };
    }),
    readQuota: () => exclusive(async () => {
      const data = await areas.session.get(QUOTA_SLOT);
      const quota = data?.[QUOTA_SLOT];
      if (quota === undefined) return null;
      if (!validQuota(quota)) throw new Error('Quota state unavailable');
      return Object.fromEntries(['day', 'count', 'nextAt', 'blockedUntil'].map(field => [field, quota[field]]));
    }),
    writeQuota(value) {
      if (!validQuota(value)) return Promise.reject(new Error('Invalid quota state'));
      return exclusive(() => areas.session.set({ [QUOTA_SLOT]: { ...value } }));
    }
  };
}
