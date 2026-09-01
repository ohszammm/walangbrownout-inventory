import { createContext, useContext, useState, useCallback } from "react";
import { items as seedItems } from "../data/items";

const ItemsContext = createContext(null);

function cloneSeed() {
  return JSON.parse(JSON.stringify(seedItems));
}

function formatNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function nextBatchCode(item) {
  const numbers = item.batches
    .map((b) => parseInt(String(b.id).replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const next = (numbers.length ? Math.max(...numbers) : 1000) + 1;
  return `B-${next}`;
}

export function ItemsProvider({ children }) {
  const [items, setItems] = useState(cloneSeed);

  /** Picks qty from a specific batch: decrements on-hand and logs a transaction. */
  const pickBatch = useCallback((sku, batchId, qty) => {
    if (!qty || qty < 1) return { ok: false, error: "Enter a quantity of at least 1." };

    let result = { ok: false, error: "Batch not found." };

    setItems((prev) =>
      prev.map((item) => {
        if (item.sku !== sku) return item;

        const batch = item.batches.find((b) => b.id === batchId);
        if (!batch) return item;

        if (qty > batch.qty) {
          result = { ok: false, error: `Only ${batch.qty} available in this batch.` };
          return item;
        }

        result = { ok: true };

        return {
          ...item,
          onHand: item.onHand - qty,
          batches: item.batches.map((b) => (b.id === batchId ? { ...b, qty: b.qty - qty } : b)),
          transactions: [
            { date: formatNow(), type: "pick", ref: "manual pick", batch: batchId, delta: -qty },
            ...item.transactions,
          ],
        };
      })
    );

    return result;
  }, []);

  /**
   * Resolves a flagged count variance: the corrected quantity becomes the
   * new on-hand figure, and the flagged transaction is cleared - this is
   * the explicit staff action the case study requires, since the system
   * itself never auto-corrects a discrepancy.
   */
  const resolveVariance = useCallback((sku, batchId, correctedQty) => {
    if (correctedQty === "" || correctedQty === null || Number.isNaN(correctedQty) || correctedQty < 0) {
      return { ok: false, error: "Enter a valid corrected quantity." };
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.sku !== sku) return item;

        const delta = correctedQty - item.onHand;

        return {
          ...item,
          onHand: correctedQty,
          transactions: [
            { date: formatNow(), type: "count", ref: "recount resolved", batch: batchId, delta, flagged: false },
            ...item.transactions.map((t) =>
              t.batch === batchId && t.type === "count" && t.flagged ? { ...t, flagged: false } : t
            ),
          ],
        };
      })
    );

    return { ok: true };
  }, []);

  /** Creates a new batch for an existing item and updates on-hand immediately. */
  const receiveBatch = useCallback((sku, { qty, receivedDate, expiryDate, bin }) => {
    let result = { ok: false, error: "Item not found." };

    setItems((prev) =>
      prev.map((item) => {
        if (item.sku !== sku) return item;

        const code = nextBatchCode(item);
        result = { ok: true, batchCode: code };

        return {
          ...item,
          onHand: item.onHand + qty,
          batches: [
            ...item.batches,
            { id: code, qty, received: receivedDate, expiry: expiryDate || null, bin: bin || "-" },
          ],
          transactions: [
            { date: formatNow(), type: "received", ref: "manual receipt", batch: code, delta: qty },
            ...item.transactions,
          ],
        };
      })
    );

    return result;
  }, []);

  return (
    <ItemsContext.Provider value={{ items, pickBatch, resolveVariance, receiveBatch }}>
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  const ctx = useContext(ItemsContext);
  if (!ctx) throw new Error("useItems must be used inside ItemsProvider");
  return ctx;
}
