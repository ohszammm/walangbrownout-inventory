// Reorder point is intentionally NOT stored here. It is calculated live by
// src/utils/reorder.js from avgDailyUsage, leadTime, safetyStock, and the
// seasonal fields below, per the case study's formula:
//   Reorder point = Average Daily Usage x Lead Time (days) + Safety Stock
// This means editing any of those numbers changes the computed reorder
// point, the stock status pill, and any resulting alert automatically.

export const items = [
  {
    sku: "ACU-1000",
    name: "Portable Air Conditioner 1.0HP",
    category: "A",
    perishable: false,
    seasonal: true,
    onHand: 18,
    reserved: 6,
    safetyStock: 12,
    maxStock: 700,
    avgDailyUsage: 3,
    leadTime: 14,
    seasonalMultiplier: 4,
    seasonalStartMonth: 4, // April
    seasonalEndMonth: 7,   // July
    batches: [
      { id: "B-3391", qty: 18, received: "2026-07-02", expiry: null, bin: "A-04" },
    ],
    transactions: [
      { date: "2026-08-24 09:12", type: "pick", ref: "order #5521", batch: "B-3391", delta: -4 },
      { date: "2026-08-18 14:03", type: "received", ref: "PO #1187", batch: "B-3391", delta: 22 },
      { date: "2026-08-10 08:44", type: "pick", ref: "order #5488", batch: "B-3391", delta: -3 },
    ],
  },
  {
    sku: "THM-2200",
    name: "Smart Thermostat v2",
    category: "A",
    perishable: false,
    seasonal: false,
    // The system's recorded figure is intentionally left at 45, matching the
    // case study: a physical count found only 12, but that figure is NOT
    // auto-corrected. It stays flagged (see the "count" transaction below)
    // until a staff member reviews it.
    onHand: 45,
    reserved: 8,
    safetyStock: 10,
    maxStock: 80,
    avgDailyUsage: 2,
    leadTime: 10,
    batches: [
      { id: "B-4410", qty: 45, received: "2026-06-15", expiry: null, bin: "B-11" },
    ],
    transactions: [
      { date: "2026-08-25 16:20", type: "count", ref: "cycle count", batch: "B-4410", delta: -33, flagged: true },
      { date: "2026-07-30 11:02", type: "pick", ref: "order #5290", batch: "B-4410", delta: -2 },
    ],
  },
  {
    sku: "FLT-0750",
    name: "Air Purifier Filter, Carbon-Lined",
    category: "B",
    perishable: true,
    seasonal: false,
    onHand: 64,
    reserved: 10,
    safetyStock: 15,
    maxStock: 120,
    avgDailyUsage: 4,
    leadTime: 7,
    batches: [
      { id: "B-2207", qty: 22, received: "2025-12-01", expiry: "2026-09-01", bin: "C-02" },
      { id: "B-2298", qty: 42, received: "2026-03-14", expiry: "2026-12-14", bin: "C-03" },
    ],
    transactions: [
      { date: "2026-08-22 10:05", type: "pick", ref: "order #5501", batch: "B-2207", delta: -6 },
      { date: "2026-08-15 09:30", type: "received", ref: "PO #1201", batch: "B-2298", delta: 42 },
      { date: "2026-07-28 13:11", type: "pick", ref: "order #5410", batch: "B-2207", delta: -8 },
    ],
  },
  {
    sku: "PUR-0500",
    name: "Air Purifier, Desktop",
    category: "B",
    perishable: false,
    seasonal: false,
    onHand: 96,
    reserved: 4,
    safetyStock: 12,
    maxStock: 70,
    avgDailyUsage: 2,
    leadTime: 12,
    batches: [
      { id: "B-1188", qty: 96, received: "2026-05-20", expiry: null, bin: "A-09" },
    ],
    transactions: [
      { date: "2026-08-20 15:44", type: "received", ref: "PO #1150", batch: "B-1188", delta: 60 },
    ],
  },
];

export function getItem(sku) {
  return items.find((i) => i.sku === sku);
}
