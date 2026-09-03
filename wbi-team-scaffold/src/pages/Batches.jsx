import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Card } from "../components/UI";
import { useItems } from "../state/ItemsContext";
import { daysUntil } from "../utils/dates";

export default function Batches() {
  const navigate = useNavigate();
  const { items } = useItems();

  const rows = useMemo(() => {
    const flat = [];

    items.forEach((item) => {
      const sorted = [...item.batches].sort((a, b) => {
        const da = daysUntil(a.expiry);
        const db = daysUntil(b.expiry);
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });

      sorted.forEach((batch, index) => {
        flat.push({
          item,
          batch,
          daysLeft: daysUntil(batch.expiry),
          pickOrder: index + 1,
          isFirst: index === 0,
        });
      });
    });

    return flat.sort((a, b) => {
      if (a.daysLeft === null) return 1;
      if (b.daysLeft === null) return -1;
      return a.daysLeft - b.daysLeft;
    });
  }, [items]);

  return (
    <div>
      <PageHeader
        title="Batches"
        sub="Every received lot, ordered by nearest expiry (First-Expiry-First-Out)."
      />

      <Card title="Batch tracking, one row per received lot">
        <div className="table-scroll-wrap">
          <table className="data-table data-table-batches">
          <colgroup>
            <col style={{ width: "9%" }} />
            <col style={{ width: "27%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "9%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Batch</th>
              <th>Item</th>
              <th className="center">Qty remaining</th>
              <th className="center">Received</th>
              <th className="center">Expiry</th>
              <th className="center">Days left</th>
              <th className="center">Pick order</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, batch, daysLeft, pickOrder, isFirst }) => (
              <tr key={batch.id} onClick={() => navigate(`/items/${item.sku}`)}>
                <td data-label="Batch" className="cell-mono">{batch.id}</td>
                <td data-label="Item">
                  <div className="cell-primary">{item.name}</div>
                  <div className="cell-sub">{item.sku} &middot; bin {batch.bin}</div>
                </td>
                <td data-label="Qty remaining" className="center cell-mono">{batch.qty}</td>
                <td data-label="Received" className="center cell-mono">{batch.received}</td>
                <td data-label="Expiry" className="center cell-mono">
                  {batch.expiry || <span className="cell-dash">not tracked</span>}
                </td>
                <td data-label="Days left" className="center cell-mono">
                  {daysLeft !== null ? (
                    <span style={{ color: daysLeft <= 14 ? "var(--critical)" : daysLeft <= 60 ? "var(--warning)" : "inherit" }}>
                      {daysLeft}d
                    </span>
                  ) : (
                    <span className="cell-dash">-</span>
                  )}
                </td>
                <td data-label="Pick order" className="center">
                  {item.perishable ? (
                    isFirst ? (
                      <span className="pill pill-ok">#1 Next</span>
                    ) : (
                      <span className="pill pill-category">#{pickOrder}</span>
                    )
                  ) : (
                    <span className="cell-dash">-</span>
                  )}
                </td>
                <td data-label="Action" className="center">
                  <button
                    className="mini-btn-outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/items/${item.sku}`);
                    }}
                  >
                    Pick
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}