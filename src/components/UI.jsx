import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { fmtDate, fmtDateTime, fmtTime } from '../lib/format';

const TONES = {
  ok: 'pill-ok', good: 'pill-ok', available: 'pill-ok', received: 'pill-ok', shipped: 'pill-ok', resolved: 'pill-ok', approved: 'pill-ok', active: 'pill-ok', connected: 'pill-ok', online: 'pill-ok',
  watch: 'pill-watch', medium: 'pill-watch', low: 'pill-watch', 'low stock': 'pill-watch', expiring: 'pill-watch', pending: 'pill-watch', draft: 'pill-watch', picking: 'pill-watch', investigating: 'pill-watch', expected: 'pill-watch', acknowledged: 'pill-watch',
  critical: 'pill-reorder', high: 'pill-reorder', out: 'pill-reorder', 'out of stock': 'pill-reorder', expired: 'pill-reorder', delayed: 'pill-reorder', variance: 'pill-reorder', rejected: 'pill-reorder', disabled: 'pill-reorder', cancelled: 'pill-reorder', open: 'pill-reorder',
  overstock: 'pill-overstock', ready: 'pill-overstock', sent: 'pill-overstock', info: 'pill-overstock',
};
const PILL_ICON = { 'pill-ok': 'check', 'pill-watch': 'clock', 'pill-reorder': 'critical', 'pill-overstock': 'info' };
export function Pill({ status, label, icon = true }) {
  const k = String(status || '').toLowerCase();
  const tone = TONES[k] || 'pill-category';
  const ic = icon && PILL_ICON[tone];
  return <span className={`pill ${tone}`}>{ic && <Icon name={ic} size={13} />}{label ?? String(status).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}</span>;
}
export const PriorityPill = ({ p }) => <Pill status={p} label={p} />;

export function KpiTile({ label, value, tone = 'ok', to, sub, icon }) {
  const inner = (<>
    <div className="kpi-text"><p className="kpi-label">{label}</p><span className="kpi-value">{value}</span>{sub && <p className="kpi-sub">{sub}</p>}</div>
    {icon && <span className="kpi-icon"><Icon name={icon} size={22} /></span>}
  </>);
  return to ? <Link to={to} className={`kpi-tile kpi-tile-${tone} kpi-link`}>{inner}</Link> : <div className={`kpi-tile kpi-tile-${tone}`}>{inner}</div>;
}
export const KpiGrid = ({ children }) => <div className="kpi-grid">{children}</div>;

export function Card({ title, right, children, padded, icon }) {
  return (
    <div className="card">
      {(title || right) && <div className="card-header"><h2 className="card-title">{icon && <span className="card-title-icon"><Icon name={icon} size={17} /></span>}{title}</h2>{right}</div>}
      {padded ? <div className="card-body-padded">{children}</div> : children}
    </div>
  );
}
// Wraps an input/select with a leading icon.
export const IconInput = ({ icon, children }) => <div className="input-icon-wrap"><Icon name={icon} size={17} />{children}</div>;
export const CardLink = ({ to, children = 'View all' }) => <Link to={to} className="breadcrumb-link card-link">{children}<Icon name="right" size={15} /></Link>;

export function PageHeader({ eyebrow, crumbs, title, sub, action }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {crumbs && <p className="eyebrow" style={{ marginBottom: 4 }}>{crumbs.map((c, i) => <span key={i}>{i > 0 && ' / '}{c.href ? <Link to={c.href} className="breadcrumb-link">{c.label}</Link> : c.label}</span>)}</p>}
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {action && <div className="page-header-side"><div className="page-actions">{action}</div></div>}
    </div>
  );
}
export function Tabs({ tabs, value, onChange }) {
  return <div className="filter-tabs">{tabs.map((t) => <button key={t.key} type="button" className={`filter-tab ${value === t.key ? 'filter-tab-active' : ''}`} onClick={() => onChange(t.key)}>{t.label}{t.count !== undefined && <span className="tab-count">{t.count}</span>}</button>)}</div>;
}
export const Loading = ({ text = 'Loading…' }) => <div className="empty-state">{text}</div>;
export const Empty = ({ children }) => <div className="empty-state">{children}</div>;
export function ErrorBox({ error, retry }) {
  return <div className="banner banner-error">{error?.message || 'Something went wrong.'} {retry && <button className="link-btn" onClick={retry}>Retry</button>}</div>;
}
export function Async({ state, children }) {
  if (state.loading && !state.data) return <Loading />;
  if (state.error && !state.data) return <ErrorBox error={state.error} retry={state.reload} />;
  return children(state.data);
}
export function SearchBox({ value, onChange, placeholder = 'Search…', autoFocus }) {
  return (
    <div className="search-wrap">
      <Icon name="search" size={17} className="search-icon" />
      <input className="field-input search-box" type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label="Search" />
    </div>
  );
}
// Only columns that read better centered are centered: status, action, type and similar short tags.
// Text stays left aligned and numbers right aligned. Set `center`, `num`, `date` or `wrap` on a column to override.
const AUTO_CENTER = /^(status|action|actions|priority|type|role|class|rank|severity|check|location|bin|sku|batch|category)$/i;
const colClass = (c) => `${c.num ? 'num' : c.date ? 'date' : (c.center === undefined ? AUTO_CENTER.test(c.label) : c.center) ? 'center' : ''}${c.wrap ? ' wrap' : ''}`.trim();
/** Date + time stacked, for table cells. */
export function Stamp({ v }) {
  if (!v) return <span className="cell-dash">-</span>;
  const t = fmtTime(v);
  return <><span className="stamp-date">{fmtDate(v)}</span>{t && <span className="stamp-time">{t}</span>}</>;
}
// `rowTone(row)` may return 'critical' or 'warning' to highlight the whole row (tinted background + coloured left edge).
export function Table({ cols, rows, empty = 'Nothing to show.', onRow, rowKey = (r) => r.id, rowTone }) {
  if (!rows?.length) return <Empty>{empty}</Empty>;
  return (
    <div className="table-scroll-wrap">
      <table className="data-table">
        <thead><tr>{cols.map((c) => <th key={c.label} className={colClass(c)} style={c.w ? { width: c.w } : undefined}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={rowKey(r)} className={rowTone && rowTone(r) ? `row-${rowTone(r)}` : undefined} onClick={onRow ? () => onRow(r) : undefined} style={onRow ? { cursor: 'pointer' } : undefined}>
            {cols.map((c) => <td key={c.label} data-label={c.label} className={colClass(c)}>{c.render ? c.render(r) : r[c.key]}</td>)}
          </tr>))}
        </tbody>
      </table>
    </div>
  );
}
export function Modal({ title, onClose, children, wide, icon }) {
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h2>{icon && <span className="modal-head-ico"><Icon name={icon} size={18} /></span>}{title}</h2><button className="modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={20} /></button></div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
export function Field({ label, hint, error, children, grow }) {
  return <div className="field" style={grow ? { flex: grow } : undefined}>{label && <label className="field-label">{label}</label>}{children}{hint && <p className="field-hint-left">{hint}</p>}{error && <p className="field-error">{error}</p>}</div>;
}
export function Detail({ items }) {
  return <dl className="detail-grid">{items.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ?? '-'}</dd></div>)}</dl>;
}
export function Bar({ value, max, tone = 'ok' }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return <div className="stock-bar-track"><div className={`stock-bar-fill stock-bar-${tone}`} style={{ width: `${pct}%` }} /></div>;
}
export const severityStyle = { CRITICAL: 'alert-item-critical', HIGH: 'alert-item-critical', MEDIUM: 'alert-item-warning', LOW: 'alert-item-info' };
export function AlertRow({ a, children, onClick }) {
  return (
    <div className={`alert-item ${severityStyle[a.priority] || ''}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      <PriorityPill p={a.priority} />
      <div className="alert-body"><p className="alert-title">{a.title}</p><p className="alert-message">{a.message}</p>{a.sku && <p className="alert-sku">{a.sku}{a.batch ? ` · ${a.batch}` : ''}</p>}</div>
      {children && <div className="alert-actions">{children}</div>}
    </div>
  );
}

// Activity log helpers shared by the dashboard and the settings page, so both lists look the same.
const LOG_ICON = [[/LOGIN|LOGOUT|LOCK|PASSWORD/, 'lock'], [/USER|ROLE|REGISTER|ACCOUNT/, 'users'], [/PERM/, 'shield'], [/SETTING/, 'settings'], [/PURCHASE|PO_|SUPPLIER/, 'po'], [/INCOMING|RECEIVE|SHIPMENT/, 'truck'], [/SHIP|PICK|SALES|ORDER/, 'orders'], [/COUNT|ADJUST|DISCREP/, 'count'], [/STOCK|PRODUCT|BATCH|MOVE|TRANSFER/, 'boxes'], [/ALERT|EXPIR/, 'alert']];
export const logIcon = (a = '') => (LOG_ICON.find(([re]) => re.test(a.toUpperCase())) || [null, 'scroll'])[1];
export const prettyAction = (a = '') => a.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
export function ActivityList({ rows, empty = 'No activity yet.' }) {
  if (!rows?.length) return <Empty>{empty}</Empty>;
  return (
    <ul className="recent-list">{rows.map((l, i) => (
      <li key={l.id ?? i} className="recent-item">
        <span className="log-ico"><Icon name={logIcon(l.action)} size={16} /></span>
        <div className="recent-main"><b>{prettyAction(l.action)}</b><span>{l.user_name}{l.detail ? ` · ${l.detail}` : ''}</span></div>
        <span className="recent-time">{fmtDateTime(l.ts)}</span>
      </li>))}
    </ul>
  );
}
