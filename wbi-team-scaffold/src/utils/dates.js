/**
 * "Today" is always the real current date/time (new Date()) - not a fixed
 * simulated date. Every expiry countdown, FEFO sort, and seasonal-window
 * check reflects whenever the system is actually being viewed.
 */

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysUntil(dateStr, asOf = new Date()) {
  if (!dateStr) return null;
  const diff = Math.round((startOfDay(dateStr) - startOfDay(asOf)) / 86400000);
  return diff;
}

export function sortByNearestExpiry(list, getExpiry) {
  return [...list].sort((a, b) => {
    const da = daysUntil(getExpiry(a));
    const db = daysUntil(getExpiry(b));
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}
