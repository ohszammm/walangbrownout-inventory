/**
 * Reorder point = Average Daily Usage x Lead Time (days) + Safety Stock
 *
 * "asOf" defaults to the real current date/time, so the seasonal window
 * check always reflects whenever this is actually being viewed - not a
 * fixed simulated date.
 *
 * For seasonal items, a multiplier is applied to average daily usage during
 * a window that starts one full lead-time period before the season begins
 * and ends when the season ends, so the reorder point rises ahead of demand
 * rather than reacting to it after stock has already run low.
 */
export function calculateReorderPoint(item, asOf = new Date()) {
  let effectiveDailyUsage = item.avgDailyUsage;
  let inSeasonWindow = false;

  if (item.seasonal && item.seasonalMultiplier && item.seasonalStartMonth) {
    inSeasonWindow = isWithinSeasonalWindow(
      asOf,
      item.seasonalStartMonth,
      item.seasonalEndMonth || item.seasonalStartMonth,
      item.leadTime
    );

    if (inSeasonWindow) {
      effectiveDailyUsage = Math.round(item.avgDailyUsage * item.seasonalMultiplier);
    }
  }

  const reorderPoint = effectiveDailyUsage * item.leadTime + item.safetyStock;

  return { reorderPoint, effectiveDailyUsage, inSeasonWindow };
}

function isWithinSeasonalWindow(asOf, startMonth, endMonth, leadTimeDays) {
  const year = asOf.getFullYear();
  const seasonStart = new Date(year, startMonth - 1, 1);
  const seasonEnd = new Date(year, endMonth, 0, 23, 59, 59); // last day of endMonth
  const windowStart = new Date(seasonStart);
  windowStart.setDate(windowStart.getDate() - leadTimeDays);

  if (asOf >= windowStart && asOf <= seasonEnd) return true;

  // Also check the prior year's window in case we're early in the current
  // year but still inside a window that started the previous December.
  const prevSeasonStart = new Date(year - 1, startMonth - 1, 1);
  const prevSeasonEnd = new Date(year - 1, endMonth, 0, 23, 59, 59);
  const prevWindowStart = new Date(prevSeasonStart);
  prevWindowStart.setDate(prevWindowStart.getDate() - leadTimeDays);

  return asOf >= prevWindowStart && asOf <= prevSeasonEnd;
}

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function seasonLabel(item) {
  if (!item.seasonal) return null;
  return `${MONTH_NAMES[item.seasonalStartMonth]}-${MONTH_NAMES[item.seasonalEndMonth]}`;
}

/** OK / WATCH / REORDER, derived from live on-hand vs. the computed reorder point. */
export function stockStatus(item) {
  const { reorderPoint } = calculateReorderPoint(item);
  const overstocked = item.onHand > item.maxStock;

  if (overstocked) return "OVERSTOCK";
  if (item.onHand < reorderPoint) return "REORDER";
  if (item.onHand < reorderPoint * 1.25) return "WATCH";
  return "OK";
}
