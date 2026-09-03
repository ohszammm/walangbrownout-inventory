import { Link } from "react-router-dom";
import LiveClock from "./LiveClock";

export function Pill({ status }) {
  const map = {
    OK: { cls: "pill-ok", label: "OK" },
    WATCH: { cls: "pill-watch", label: "Watch" },
    REORDER: { cls: "pill-reorder", label: "Reorder" },
    OVERSTOCK: { cls: "pill-overstock", label: "Overstock" },
  };
  const s = map[status] || map.OK;
  return <span className={`pill ${s.cls}`}>{s.label}</span>;
}

export function CategoryPill({ category, full = false }) {
  return <span className="pill pill-category">{full ? `Class ${category}` : category}</span>;
}

export function KpiTile({ label, value, tone = "ok" }) {
  return (
    <div className={`kpi-tile kpi-tile-${tone}`}>
      <p className="kpi-label">{label}</p>
      <span className="kpi-value">{value}</span>
    </div>
  );
}

export function Card({ title, right, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="card-title">{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

export function PageHeader({ eyebrow, crumbs, title, sub, action }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {crumbs && (
          <p className="eyebrow" style={{ marginBottom: 4 }}>
            {crumbs.map((c, i) => (
              <span key={i}>
                {i > 0 && " / "}
                {c.href ? (
                  <Link to={c.href} className="breadcrumb-link">{c.label}</Link>
                ) : (
                  c.label
                )}
              </span>
            ))}
          </p>
        )}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      <div className="page-header-side">
        <LiveClock />
        {action}
      </div>
    </div>
  );
}

export function StockBar({ item, status }) {
  const pct = Math.min((item.onHand / item.maxStock) * 100, 100);
  const toneClass = {
    OK: "stock-bar-ok",
    WATCH: "stock-bar-watch",
    REORDER: "stock-bar-reorder",
    OVERSTOCK: "stock-bar-overstock",
  }[status] || "stock-bar-ok";

  return (
    <div className="stock-bar-track">
      <div className={`stock-bar-fill ${toneClass}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const severityStyle = {
  critical: { cls: "alert-item-critical", tagCls: "alert-severity-critical", label: "Critical" },
  warning: { cls: "alert-item-warning", tagCls: "alert-severity-warning", label: "Warning" },
  info: { cls: "alert-item-info", tagCls: "alert-severity-info", label: "Info" },
};