// TODO (Jan Cedric): Build the real shared UI kit here - Pill, CategoryPill,
// KpiTile, Card, PageHeader (including the LiveClock badge placement),
// StockBar, severityStyle. Every other page imports from this file, so try
// to get this PR merged first - everyone else needs it to build their real
// pages against. See handoff notes for exact class names/props expected.
export function Pill() {
  return <span>TODO</span>;
}

export function CategoryPill() {
  return <span>TODO</span>;
}

export function KpiTile({ label, value }) {
  return (
    <div>
      <p>{label}</p>
      <span>{value}</span>
    </div>
  );
}

export function Card({ title, children }) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function PageHeader({ title, sub }) {
  return (
    <div>
      <h1>{title}</h1>
      {sub && <p>{sub}</p>}
    </div>
  );
}

export function StockBar() {
  return <div>TODO</div>;
}

export const severityStyle = {
  critical: { cls: "", tagCls: "", label: "Critical" },
  warning: { cls: "", tagCls: "", label: "Warning" },
  info: { cls: "", tagCls: "", label: "Info" },
};
