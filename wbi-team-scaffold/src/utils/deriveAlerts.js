import { daysUntil } from "./dates";
import { calculateReorderPoint } from "./reorder";

const EXPIRY_WINDOW_DAYS = 60;
const EXPIRY_CRITICAL_DAYS = 14;

/**
 * Recomputes every alert from whatever items array is passed in - live
 * application state from ItemsContext, not a fixed snapshot. Nothing here
 * is a hardcoded string: change onHand, safetyStock, a batch's expiry
 * date, pick from a batch, or resolve a count, and the alerts that come
 * out of this function change immediately on the next render.
 *
 * In the full system this same logic runs server-side against the
 * database on every request (see the Laravel AlertEngine service) so it
 * stays correct across multiple staff members; here it runs against
 * client-side React state since there is no backend connected yet.
 */
export function deriveAlerts(itemsList) {
  const alerts = [];

  itemsList.forEach((item) => {
    alerts.push(...lowStockAlert(item));
    alerts.push(...overstockAlert(item));
    alerts.push(...expiringAlerts(item));
    alerts.push(...varianceAlerts(item));
  });

  return alerts.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

function severityRank(severity) {
  return { critical: 0, warning: 1, info: 2 }[severity] ?? 3;
}

function lowStockAlert(item) {
  const { reorderPoint, inSeasonWindow } = calculateReorderPoint(item);

  if (item.onHand >= reorderPoint) return [];

  return [
    {
      id: `low-${item.sku}`,
      type: "low_stock",
      severity: item.onHand === 0 ? "critical" : "warning",
      sku: item.sku,
      title: item.name,
      message: `On hand is ${item.onHand}, below the reorder point of ${reorderPoint}${inSeasonWindow ? " (seasonal demand window is active)" : ""}.`,
      action: "Reorder",
    },
  ];
}

function overstockAlert(item) {
  if (item.onHand <= item.maxStock) return [];

  return [
    {
      id: `over-${item.sku}`,
      type: "overstock",
      severity: "warning",
      sku: item.sku,
      title: item.name,
      message: `On hand is ${item.onHand}, above the maximum stock limit of ${item.maxStock}. No further reordering is recommended.`,
      action: "Review stock",
    },
  ];
}

function expiringAlerts(item) {
  if (!item.perishable) return [];

  return item.batches
    .filter((b) => {
      const d = daysUntil(b.expiry);
      return d !== null && d >= 0 && d <= EXPIRY_WINDOW_DAYS && b.qty > 0;
    })
    .map((b) => {
      const d = daysUntil(b.expiry);
      return {
        id: `exp-${item.sku}-${b.id}`,
        type: "expiring",
        severity: d <= EXPIRY_CRITICAL_DAYS ? "critical" : "warning",
        sku: item.sku,
        batch: b.id,
        title: item.name,
        message: `Batch ${b.id} expires in ${d} day${d === 1 ? "" : "s"}, ${b.qty} units remaining in bin ${b.bin}. Pick this batch first.`,
        action: "Prioritize pick",
      };
    });
}

function varianceAlerts(item) {
  return item.transactions
    .filter((t) => t.type === "count" && t.flagged)
    .map((t) => {
      const countedQty = item.onHand + t.delta;
      return {
        id: `var-${item.sku}-${t.batch}`,
        type: "variance",
        severity: "critical",
        sku: item.sku,
        batch: t.batch,
        countedQty,
        title: item.name,
        message: `Batch ${t.batch}: system shows ${item.onHand}, physical count found ${countedQty}. Not auto-corrected, pending review.`,
        action: "Review count",
      };
    });
}
