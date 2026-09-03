import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader, Card, Pill, CategoryPill, StockBar } from "../components/UI";
import { useItems } from "../state/ItemsContext";
import { calculateReorderPoint, stockStatus, seasonLabel } from "../utils/reorder";
import { deriveAlerts } from "../utils/deriveAlerts";

const TABS = [
  { id: "all", label: "All" },
  { id: "A", label: "Class A" },
  { id: "B", label: "Class B" },
  { id: "C", label: "Class C" },
  { id: "fefo", label: "FEFO-critical" },
  { id: "seasonal", label: "Seasonal" },
];

export default function Inventory() {
  const navigate = useNavigate();
  const { items } = useItems();
  const [tab, setTab] = useState("all");
  const alerts = deriveAlerts(items);
  const expiringSkus = new Set(alerts.filter((a) => a.type === "expiring").map((a) => a.sku));

  const rows = useMemo(() => {
    return items
      .map((item) => {
        const r = calculateReorderPoint(item);
        return {
          item,
          status: stockStatus(item),
          reorderPoint: r.reorderPoint,
          inSeasonWindow: r.inSeasonWindow,
          available: Math.max(item.onHand - item.reserved, 0),
        };
      })
      .filter((r) => {
        if (tab === "all") return true;
        if (tab === "fefo") return expiringSkus.has(r.item.sku);
        if (tab === "seasonal") return r.item.seasonal;
        return r.item.category === tab;
      });
  }, [items, tab, expiringSkus]);

  return (
    <div>
      <PageHeader title="Inventory" sub="All tracked items and live stock levels." />

      <Card title="Tracked items">
        <div className="filter-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`filter-tab ${tab === t.id ? "filter-tab-active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="card-legend">
          <strong>A</strong>: high-value, monitored and counted often. <strong>B</strong>: standard review schedule.
          <strong>C</strong>: reviewed less frequently. <strong>FEFO-critical</strong>: has a batch nearing expiry
          that should be picked first.
        </div>

        <div className="table-scroll-wrap">
          <table className="data-table data-table-inventory">
          <colgroup>
            <col style={{ width: "9%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "9%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Item</th>
              <th className="center">Class</th>
              <th className="center">Season</th>
              <th className="center">Stock level</th>
              <th className="center">On hand</th>
              <th className="center">Available</th>
              <th className="center">Reorder pt.</th>
              <th className="center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ item, status, reorderPoint, inSeasonWindow, available }) => (
              <tr key={item.sku} onClick={() => navigate(`/items/${item.sku}`)}>
                <td data-label="SKU" className="cell-mono">{item.sku}</td>
                <td data-label="Item" className="cell-primary">{item.name}</td>
                <td data-label="Class" className="center"><CategoryPill category={item.category} /></td>
                <td data-label="Season" className="center">
                  {item.seasonal ? (
                    <span className={`pill ${inSeasonWindow ? "pill-watch" : "pill-category"}`}>
                      {seasonLabel(item)}{inSeasonWindow ? ", active" : ""}
                    </span>
                  ) : (
                    <span className="cell-dash">not seasonal</span>
                  )}
                </td>
                <td data-label="Stock level">
                  <StockBar item={item} status={status} />
                </td>
                <td data-label="On hand" className="center cell-mono">{item.onHand}</td>
                <td data-label="Available" className="center cell-mono">{available}</td>
                <td data-label="Reorder pt." className="center cell-mono">{reorderPoint}</td>
                <td data-label="Status" className="center"><Pill status={status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-state">No items match this filter.</td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}