import { Link, useNavigate } from "react-router-dom";
import { PageHeader, KpiTile, Card, severityStyle } from "../components/UI";
import { useItems } from "../state/ItemsContext";
import { deriveAlerts } from "../utils/deriveAlerts";
import { calculateReorderPoint, seasonLabel } from "../utils/reorder";

export default function Overview() {
  const navigate = useNavigate();
  const { items } = useItems();
  const alerts = deriveAlerts(items);

  const counts = {
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    tracked: items.length,
  };

  const recentActivity = items
    .flatMap((item) => item.transactions.map((t) => ({ ...t, item })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const seasonalItems = items
    .filter((item) => item.seasonal)
    .map((item) => ({ item, ...calculateReorderPoint(item) }));

  return (
    <div>
      <PageHeader
        title="Overview"
        sub="Summary of stock health across all tracked items."
        action={<Link to="/receive" className="btn btn-primary">Receive shipment</Link>}
      />

      <div className="kpi-grid">
        <KpiTile label="Items tracked" value={counts.tracked} tone="ok" />
        <KpiTile label="Critical alerts" value={counts.critical} tone="critical" />
        <KpiTile label="Warning alerts" value={counts.warning} tone="warning" />
        <KpiTile label="Open alerts" value={alerts.length} tone="info" />
      </div>

      <Card
        title="Alerts requiring attention"
        right={
          <Link to="/alerts" className="breadcrumb-link" style={{ fontSize: 13 }}>
            View all
          </Link>
        }
      >
        {alerts.length === 0 ? (
          <div className="empty-state">No open alerts. Stock is within policy across all tracked items.</div>
        ) : (
          <div>
            {alerts.slice(0, 4).map((a) => {
              const s = severityStyle[a.severity];
              return (
                <div
                  key={a.id}
                  className={`alert-item ${s.cls}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/items/${a.sku}`)}
                >
                  <span className={`alert-severity-tag ${s.tagCls}`}>{s.label}</span>
                  <div className="alert-body">
                    <p className="alert-title">{a.title}</p>
                    <p className="alert-message">{a.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title="Seasonal items"
        right={
          <Link to="/inventory" className="breadcrumb-link" style={{ fontSize: 13 }}>
            View inventory
          </Link>
        }
      >
        {seasonalItems.length === 0 ? (
          <div className="empty-state">No items are currently classified as seasonal.</div>
        ) : (
          <div>
            {seasonalItems.map(({ item, inSeasonWindow, effectiveDailyUsage }) => (
              <div
                key={item.sku}
                className="tx-row"
                style={{ cursor: "pointer" }}
                onClick={() => navigate(`/items/${item.sku}`)}
              >
                <span className="tx-ref" style={{ flex: "1 1 220px" }}>
                  <strong>{item.name}</strong>
                  <span className="cell-sub" style={{ display: "block" }}>{item.sku}</span>
                </span>
                <span className="cell-mono" style={{ minWidth: 90 }}>{seasonLabel(item)}</span>
                <span className={`pill ${inSeasonWindow ? "pill-watch" : "pill-category"}`}>
                  {inSeasonWindow ? `Active, ${effectiveDailyUsage}/day` : "Off-season"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Recent stock activity">
        {recentActivity.length === 0 ? (
          <div className="empty-state">No transactions recorded yet.</div>
        ) : (
          <div>
            {recentActivity.map((t, i) => (
              <div key={i} className="tx-row">
                <span className="tx-date">{t.date}</span>
                <span className="tx-type">{t.type}</span>
                <span className="tx-ref">
                  {t.item.name} &middot; {t.batch}
                </span>
                <span
                  className="tx-delta"
                  style={{ color: t.delta > 0 ? "var(--success)" : t.delta < 0 ? "var(--critical)" : "var(--ink-faint)" }}
                >
                  {t.delta > 0 ? `+${t.delta}` : t.delta}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}