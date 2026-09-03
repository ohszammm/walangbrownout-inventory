import { useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { PageHeader, KpiTile, Card, CategoryPill } from "../components/UI";
import { useItems } from "../state/ItemsContext";
import { daysUntil, sortByNearestExpiry } from "../utils/dates";
import { calculateReorderPoint, seasonLabel } from "../utils/reorder";

function ReorderField({ label, value }) {
  return (
    <div className="reorder-field">
      <div className="reorder-field-label">{label}</div>
      <div className="reorder-field-value">{value}</div>
    </div>
  );
}

export default function ItemDetail() {
  const { sku } = useParams();
  const { items, pickBatch } = useItems();
  const item = items.find((i) => i.sku === sku);
  const [pickQty, setPickQty] = useState({});
  const [feedback, setFeedback] = useState({});

  if (!item) return <Navigate to="/" replace />;

  const available = Math.max(item.onHand - item.reserved, 0);
  const sortedBatches = sortByNearestExpiry(item.batches, (b) => b.expiry);
  const { reorderPoint, effectiveDailyUsage, inSeasonWindow } = calculateReorderPoint(item);

  const submitPick = (batchId) => {
    const qty = parseInt(pickQty[batchId], 10);
    const result = pickBatch(item.sku, batchId, qty);

    if (!result.ok) {
      setFeedback({ ...feedback, [batchId]: { ok: false, msg: result.error } });
      return;
    }

    setFeedback({ ...feedback, [batchId]: { ok: true, msg: `Picked ${qty}.` } });
    setPickQty({ ...pickQty, [batchId]: "" });
  };

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Overview", href: "/" }, { label: "Inventory", href: "/inventory" }, { label: item.sku }]}
        title={item.name}
        action={
          <div className="tag-row">
            {item.seasonal && (
              <span className="pill pill-overstock">
                Seasonal, {seasonLabel(item)}{inSeasonWindow ? ", active now" : ""}
              </span>
            )}
            {item.perishable && <span className="pill pill-watch">Perishable</span>}
            <CategoryPill category={item.category} full />
          </div>
        }
      />

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <KpiTile label="On hand" value={item.onHand} tone="ok" />
        <KpiTile label="Reserved" value={item.reserved} tone="info" />
        <KpiTile label="Available" value={available} tone="ok" />
      </div>

      <Card title="Reorder policy">
        <div className="reorder-fields">
          <ReorderField label="Reorder point" value={reorderPoint} />
          <ReorderField label="Safety stock" value={item.safetyStock} />
          <ReorderField label="Max stock" value={item.maxStock} />
          <ReorderField
            label="Avg daily usage"
            value={inSeasonWindow ? `${effectiveDailyUsage} (seasonal, base ${item.avgDailyUsage})` : item.avgDailyUsage}
          />
          <ReorderField label="Lead time" value={`${item.leadTime} days`} />
        </div>
      </Card>

      <Card title="Batches, sorted by nearest expiry">
        <div>
          {sortedBatches.map((b, i) => {
            const d = daysUntil(b.expiry);
            const isNext = i === 0;
            const fb = feedback[b.id];
            return (
              <div key={b.id} className="batch-row">
                <div className="batch-info">
                  <div className="batch-id">{b.id}</div>
                  <div className="batch-meta">received {b.received}, bin {b.bin}</div>
                </div>
                <div className="batch-qty">Qty {b.qty}</div>
                <div
                  className="batch-expiry"
                  style={{ color: item.perishable && d !== null && d <= 60 ? "var(--critical)" : "var(--ink-muted)" }}
                >
                  {b.expiry ? `${b.expiry}${d !== null ? `, ${d}d left` : ""}` : "no expiry tracked"}
                </div>
                {isNext && item.perishable && <span className="pill pill-ok">Pick next</span>}
                <div>
                  <div className="mini-form">
                    <input
                      type="number"
                      placeholder="Pick #"
                      className="mini-input"
                      value={pickQty[b.id] || ""}
                      onChange={(e) => setPickQty({ ...pickQty, [b.id]: e.target.value })}
                    />
                    <button className="mini-btn" onClick={() => submitPick(b.id)}>Pick</button>
                  </div>
                  {fb && (
                    <div className={fb.ok ? "mini-feedback" : "mini-feedback-error"} style={{ marginTop: 4 }}>
                      {fb.msg}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Recent transactions">
        <div>
          {item.transactions.map((t, i) => (
            <div
              key={i}
              className="tx-row"
              style={{ borderLeft: t.flagged ? "3px solid var(--critical)" : "3px solid transparent" }}
            >
              <span className="tx-date">{t.date}</span>
              <span className="tx-type">{t.type}</span>
              <span className="tx-ref">{t.batch}, {t.ref}</span>
              {t.flagged && <span className="pill pill-reorder">Variance flagged</span>}
              <span
                className="tx-delta"
                style={{ color: t.delta > 0 ? "var(--success)" : t.delta < 0 ? "var(--critical)" : "var(--ink-faint)" }}
              >
                {t.delta > 0 ? `+${t.delta}` : t.delta}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}