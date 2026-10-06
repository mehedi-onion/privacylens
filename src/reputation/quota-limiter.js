export const REQUEST_INTERVAL_MS = 20 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
export function createQuotaLimiter(store, { now = Date.now } = {}) {
  let queue = Promise.resolve();
  function exclusive(action) { const task = queue.then(action); queue = task.catch(() => {}); return task; }
  async function budget() {
    const time = now();
    const day = Math.floor(time / DAY_MS);
    const previous = await store.readQuota();
    return { time, quota: { day, count: previous?.day === day ? previous.count : 0,
      nextAt: previous?.nextAt ?? 0, blockedUntil: previous?.blockedUntil ?? 0 } };
  }
  return {
    reserve: () => exclusive(async () => {
      const { time, quota } = await budget();
      if (quota.count >= 500 || time < Math.max(quota.nextAt, quota.blockedUntil)) return false;
      quota.count++;
      quota.nextAt = time + REQUEST_INTERVAL_MS;
      await store.writeQuota(quota);
      return true;
    }),
    cooldown: (delay, quotaExceeded = false) => exclusive(async () => {
      const { time, quota } = await budget();
      const duration = Number.isSafeInteger(delay) && delay >= 60000 ? Math.min(delay, DAY_MS) : 60000;
      quota.blockedUntil = Math.max(quota.blockedUntil, time + duration,
        quotaExceeded ? (quota.day + 1) * DAY_MS : 0);
      await store.writeQuota(quota);
    })
  };
}
