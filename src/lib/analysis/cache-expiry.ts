/**
 * Cache expires at 3:00 AM EST (UTC-5) each day.
 * If the current time is before 3 AM EST, the boundary is 3 AM EST yesterday.
 */
function getExpiryBoundary(): Date {
  const now = new Date();
  // 3 AM EST = 08:00 UTC
  const todayUtc = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    8, 0, 0, 0
  ));

  if (now < todayUtc) {
    todayUtc.setUTCDate(todayUtc.getUTCDate() - 1);
  }

  return todayUtc;
}

/** Returns true if the given ISO timestamp is older than today's 3 AM EST boundary. */
export function isCacheExpired(updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return true;

  try {
    const ts = new Date(updatedAt);
    if (isNaN(ts.getTime())) return true;
    return ts < getExpiryBoundary();
  } catch {
    return true;
  }
}
