import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../lib/hooks';
import { Async, Card, CardLink, Empty, KpiGrid, KpiTile, PageHeader, Pill, PriorityPill, AlertRow, ActivityList } from '../components/UI';
import { ROLE_LABEL, ROLE_MOTTO } from '../nav';
import { ChartCard, Columns, Donut, HBars } from '../components/Charts';
import Icon from '../components/Icon';
import { fmtDate, fmtMoney, signed } from '../lib/format';

const MOVE_SERIES = [{ key: 'in', label: 'Units received', color: 'var(--success)' }, { key: 'out', label: 'Units picked', color: 'var(--accent)' }];
const StockCharts = ({ c }) => (<>
  <div className="two-col">
    <ChartCard title="Stock health" sub="Products by stock status"><Donut data={c.stock_status} centerLabel="Products" /></ChartCard>
    {c.stock_by_category ? <ChartCard title="Stock by category" sub="Units on hand"><HBars data={c.stock_by_category} /></ChartCard> : null}
  </div>
  {c.movement_trend && <ChartCard title="Stock movement" sub="Units received vs. picked, last 8 weeks"><Columns data={c.movement_trend} series={MOVE_SERIES} /></ChartCard>}
</>);

const T = ({ to, n, label, icon, tone = 'info' }) => <Link to={to} className={`task-card task-${tone}`}><span className="task-icon"><Icon name={icon} size={20} /></span><span className="task-text"><strong>{n}</strong><span>{label}</span></span></Link>;
const Rows = ({ rows, render, empty }) => (rows?.length ? rows.map(render) : <Empty>{empty}</Empty>);

function Admin({ d }) {
  return (<>
    <KpiGrid>
      <KpiTile icon="users" label="Total users" value={d.kpis.total_users} tone="info" to="/users" />
      <KpiTile icon="active" label="Active users" value={d.kpis.active_users} tone="ok" to="/users" />
      <KpiTile icon="pending" label="Pending / inactive accounts" value={d.kpis.pending_inactive} tone="warning" to="/users" />
      <KpiTile icon="alert" label="System alerts" value={d.kpis.system_alerts} tone={d.kpis.system_alerts ? 'critical' : 'ok'} />
    </KpiGrid>
    <div className="two-col">
      <ChartCard title="Users by role" sub="Active accounts"><Donut data={d.charts.users_by_role} centerLabel="Active users" /></ChartCard>
      <ChartCard title="System activity" sub="Logged events, last 14 days"><Columns data={d.charts.activity.map((a) => ({ ...a, n: a.value }))} series={[{ key: 'n', label: 'Events', color: 'var(--accent)' }]} /></ChartCard>
    </div>
    <div className="two-col">
      <Card title="User activity">
        <div className="list-row"><span>New users (30 days)</span><b>{d.user_activity.new_users}</b></div>
        <div className="list-row"><span>Active users (signed in, 7 days)</span><b>{d.user_activity.active_recently}</b></div>
        <div className="list-row"><span>Disabled accounts</span><b>{d.user_activity.disabled}</b></div>
        <div className="list-row"><span>Awaiting approval</span><b>{d.user_activity.pending}</b></div>
      </Card>
      <Card title="System status">
        {[['System', d.system_status.system, 'Online'], ['Database', d.system_status.database, 'Connected'], ['Backend', d.system_status.backend, 'Connected']].map(([k, s, l]) => (
          <div className="list-row" key={k}><span className="row-icon"><Icon name={k === 'System' ? 'server' : k === 'Database' ? 'db' : 'ok'} size={17} />{k}</span><Pill status={s} label={l} /></div>
        ))}
      </Card>
    </div>
    <Card title="Recent system activity" right={<CardLink to="/logs" />}>
      <ActivityList rows={d.recent_activity} />
    </Card>
  </>);
}

function Inventory({ d }) {
  const nav = useNavigate();
  return (<>
    <KpiGrid>
      <KpiTile icon="boxes" label="Total products" value={d.kpis.total_products} tone="info" to="/inventory" />
      <KpiTile icon="lowstock" label="Low stock" value={d.kpis.low_stock} tone="warning" to="/alerts/low-stock" />
      <KpiTile icon="expiry" label="Expiring soon" value={d.kpis.expiring_soon} tone="warning" to="/alerts/expiry" />
      <KpiTile icon="alert" label="Discrepancies" value={d.kpis.discrepancies} tone={d.kpis.discrepancies ? 'critical' : 'ok'} to="/discrepancies" />
    </KpiGrid>
    {d.pending_adjustments > 0 && <div className="banner banner-warn">{d.pending_adjustments} stock adjustment request(s) waiting for your approval. <Link className="link-btn" to="/adjustments">Review</Link></div>}
    <StockCharts c={d.charts} />
    <div className="two-col">
      <Card title="Stock discrepancies" right={<CardLink to="/discrepancies" />}>
        <Rows rows={d.discrepancies} empty="No open discrepancies." render={(a) => (
          <div className="list-row" key={a.key}><span><b>{a.product}</b><small>System {a.system_qty} · Physical {a.physical_qty}</small></span><span><b className="neg">{signed(a.diff)}</b> <PriorityPill p={a.priority} /></span></div>
        )} />
      </Card>
      <Card title="Pending approvals">
        <div className="list-row"><span className="row-icon"><Icon name="sliders" size={17} />Stock adjustments</span><b>{d.pending_adjustments}</b></div>
        <div className="list-row"><span className="row-icon"><Icon name="alert" size={17} />Open discrepancies</span><b>{d.kpis.discrepancies}</b></div>
        <div className="list-row"><span className="row-icon"><Icon name="expiry" size={17} />Batches expiring soon</span><b>{d.kpis.expiring_soon}</b></div>
      </Card>
    </div>
    <Card title="Low stock alerts" right={<CardLink to="/alerts/low-stock" />}>
      <Rows rows={d.low_stock} empty="No low-stock items." render={(a) => <AlertRow key={a.key} a={a} onClick={() => nav(`/inventory/${a.sku}`)} />} />
    </Card>
    <Card title="Expiry alerts" right={<CardLink to="/alerts/expiry" />}>
      <Rows rows={d.expiry} empty="Nothing expiring soon." render={(a) => <AlertRow key={a.key} a={a} onClick={() => nav('/batches')} />} />
    </Card>
  </>);
}

function Purchasing({ d }) {
  return (<>
    <KpiGrid>
      <KpiTile icon="reorder" label="Items to reorder" value={d.kpis.to_reorder} tone={d.kpis.to_reorder ? 'critical' : 'ok'} to="/reorder" />
      <KpiTile icon="po" label="Pending POs" value={d.kpis.pending_pos} tone="warning" to="/purchase-orders" />
      <KpiTile icon="truck" label="Incoming shipments" value={d.kpis.incoming} tone="info" to="/shipments/incoming" />
      <KpiTile icon="supplier" label="Active suppliers" value={d.kpis.suppliers} tone="ok" to="/suppliers" />
    </KpiGrid>
    <div className="two-col">
      <ChartCard title="Stock health" sub="Products by stock status"><Donut data={d.charts.stock_status} centerLabel="Products" /></ChartCard>
      <ChartCard title="Purchase orders" sub="By status"><Donut data={d.charts.po_by_status} centerLabel="Orders" /></ChartCard>
    </div>
    <ChartCard title="Purchase value by supplier" sub="Total of non-cancelled purchase orders"><HBars data={d.charts.spend_by_supplier} format={fmtMoney} /></ChartCard>
    <Card title="Reorder alerts" right={<CardLink to="/reorder" />}>
      <Rows rows={d.reorder} empty="Nothing needs reordering." render={(r) => (
        <div className="list-row" key={r.sku}><span><b>{r.name}</b><small>Stock {r.current} · Reorder point {r.reorder_point} · Suggested {r.suggested_qty}</small></span><PriorityPill p={r.priority} /></div>
      )} />
    </Card>
    <div className="two-col">
      <Card title="Pending purchase orders" right={<CardLink to="/purchase-orders" />}>
        <Rows rows={d.pending_pos} empty="No pending purchase orders." render={(o) => <div className="list-row" key={o.id}><Link to={`/purchase-orders/${o.id}`}><b>{o.code}</b><small>{o.supplier}</small></Link><Pill status={o.status} /></div>} />
      </Card>
      <Card title="Incoming shipments" right={<CardLink to="/shipments/incoming" />}>
        <Rows rows={d.incoming} empty="No shipments on the way." render={(s) => <div className="list-row" key={s.id}><span><b>{s.code}</b><small>{s.po_code} · expected {fmtDate(s.expected_date)}</small></span><Pill status={s.status} /></div>} />
      </Card>
    </div>
    <Card title="Recent purchase history" right={<CardLink to="/purchase-history" />}>
      <Rows rows={d.history} empty="No completed purchases yet." render={(o) => <div className="list-row" key={o.id}><span><b>{o.code}</b><small>{o.supplier} · {fmtDate(o.created)}</small></span><Pill status={o.status} /></div>} />
    </Card>
  </>);
}

function Warehouse({ d }) {
  return (<>
    <KpiGrid>
      <KpiTile icon="truck" label="To receive" value={d.kpis.to_receive} tone="info" to="/shipments/incoming" />
      <KpiTile icon="pick" label="To pick" value={d.kpis.to_pick} tone="warning" to="/pick-orders" />
      <KpiTile icon="send" label="To ship" value={d.kpis.to_ship} tone="ok" to="/shipments/outgoing" />
      <KpiTile icon="count" label="Stock tasks" value={d.kpis.stock_tasks} tone={d.kpis.stock_tasks ? 'critical' : 'ok'} to="/stock-count" />
    </KpiGrid>
    <StockCharts c={d.charts} />
    <Card title="Today's tasks">
      <div className="task-cards">
        <T to="/shipments/incoming" icon="inbound" tone="info" n={d.kpis.to_receive} label="Shipments waiting to be received" />
        <T to="/pick-orders" icon="pick" tone="warning" n={d.kpis.to_pick} label="Orders to pick" />
        <T to="/shipments/outgoing" icon="send" tone="ok" n={d.kpis.to_ship} label="Packed orders ready to ship" />
        <T to="/stock-count" icon="count" tone="accent" n={d.kpis.stock_tasks} label="Recounts / inventory tasks" />
      </div>
    </Card>
    <div className="two-col">
      <Card title="Incoming shipments" right={<CardLink to="/shipments/incoming" />}>
        <Rows rows={d.to_receive} empty="Nothing to receive." render={(s) => <div className="list-row" key={s.id}><span><b>{s.code}</b><small>{s.po_code} · expected {fmtDate(s.expected_date)}</small></span><Pill status={s.status} /></div>} />
      </Card>
      <Card title="Outgoing shipments" right={<CardLink to="/shipments/outgoing" />}>
        <Rows rows={d.to_ship} empty="No packed orders waiting." render={(o) => <div className="list-row" key={o.id}><span><b>{o.code}</b><small>{o.customer} · {o.units} units</small></span><Pill status={o.status} /></div>} />
      </Card>
    </div>
    <div className="two-col">
      <Card title="Orders to pick" right={<CardLink to="/pick-orders" />}>
        <Rows rows={d.to_pick} empty="No orders to pick." render={(o) => <div className="list-row" key={o.id}><span><b>{o.code}</b><small>{o.customer} · {o.units} units</small></span><Pill status={o.status} /></div>} />
      </Card>
      <Card title="Inventory tasks" right={<CardLink to="/stock-count" />}>
        <Rows rows={d.inventory_tasks} empty="No count tasks." render={(c) => <div className="list-row" key={c.id}><span><b>{c.product}</b><small>{c.code} · system {c.system_qty} vs physical {c.physical_qty}</small></span><Pill status={c.status === 'investigating' ? 'investigating' : 'open'} label={c.status === 'investigating' ? 'Under investigation' : 'Recount'} /></div>} />
      </Card>
    </div>
    <Card title="Expiry & stock alerts" right={<CardLink to="/alerts/expiry" />}>
      <Rows rows={d.alerts} empty="No alerts." render={(a) => <AlertRow key={a.key} a={a} />} />
    </Card>
  </>);
}

function Sales({ d }) {
  return (<>
    <KpiGrid>
      <KpiTile icon="orders" label="Today's orders" value={d.kpis.today_orders} tone="info" to="/sales/orders" />
      <KpiTile icon="pending" label="Pending orders" value={d.kpis.pending_orders} tone="warning" to="/sales/orders" />
      <KpiTile icon="send" label="Ready to ship" value={d.kpis.ready_to_ship} tone="ok" to="/shipments/outgoing" />
      <KpiTile icon="availability" label="Available units" value={d.kpis.available_units} tone="ok" sub={`${d.kpis.products} products`} to="/availability" />
    </KpiGrid>
    <div className="two-col">
      <ChartCard title="Product availability" sub="What we can sell right now" right={<CardLink to="/availability">Open</CardLink>}>
        <Donut centerLabel="Products" data={[{ label: 'Available', value: d.availability.available, tone: 'ok' }, { label: 'Low stock', value: d.availability.low, tone: 'warning' }, { label: 'Out of stock', value: d.availability.out, tone: 'critical' }]} />
      </ChartCard>
      <ChartCard title="Order status" sub="All sales orders in progress">
        <Donut centerLabel="Orders" data={[{ label: 'Pending', value: d.status.pending, tone: 'warning' }, { label: 'Picking', value: d.status.picking, tone: 'info' }, { label: 'Ready', value: d.status.ready, tone: 'accent' }, { label: 'Shipped', value: d.status.shipped, tone: 'ok' }]} />
      </ChartCard>
    </div>
    <Card title="Recent sales orders" right={<CardLink to="/sales/orders" />}>
      <Rows rows={d.recent_orders} empty="No orders yet." render={(o) => <div className={`list-row${o.status === 'cancelled' ? ' row-critical' : ''}`} key={o.id}><Link to={`/sales/orders/${o.id}`}><b>{o.code}</b><small>{o.customer} · {o.units} unit{o.units === 1 ? '' : 's'}</small></Link><Pill status={o.status} /></div>} />
    </Card>
    <Card title="Low stock products" right={<CardLink to="/availability" />}>
      <Rows rows={d.low_stock} empty="All products are well stocked." render={(p) => <div className={`list-row${p.status === 'Out of Stock' ? ' row-critical' : ''}`} key={p.sku}><span><b>{p.name}</b><small>{p.sku} · {p.available} available</small></span><Pill status={p.status} /></div>} />
    </Card>
  </>);
}

const VIEWS = { admin: Admin, inventory: Inventory, purchasing: Purchasing, warehouse: Warehouse, sales: Sales };
export default function Dashboard() {
  const { user } = useAuth();
  const state = useApi('/dashboard', { refresh: 30000 });
  const View = VIEWS[user.role];
  return (
    <div>
      <PageHeader title="Dashboard" sub={`${ROLE_LABEL[user.role]} · ${ROLE_MOTTO[user.role]}`} />
      <Async state={state}>{(d) => <View d={d} />}</Async>
    </div>
  );
}
