import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Async, Card, Field, IconInput, PageHeader, Pill, SearchBox, Table, Tabs, Stamp } from '../components/UI';
import Icon from '../components/Icon';
import { fmtDateTime, fmtMoney } from '../lib/format';

export function NewOrderPage() {
  const toast = useToast();
  const nav = useNavigate();
  const av = useApi('/availability');
  const [c, setC] = useState({ customer: '', phone: '', address: '' });
  const [lines, setLines] = useState([{ product_id: '', qty: 1 }]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const prods = av.data || [];
  const setLine = (i, k, v) => setLines((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const need = {};
  lines.forEach((l) => { if (l.product_id) need[l.product_id] = (need[l.product_id] || 0) + Number(l.qty || 0); });
  const problem = (l) => { const p = prods.find((x) => String(x.id) === String(l.product_id)); return p && need[l.product_id] > p.available ? p : null; };
  const blocked = lines.some(problem) || lines.every((l) => !l.product_id);
  const total = lines.reduce((s, l) => s + (prods.find((x) => String(x.id) === String(l.product_id))?.price || 0) * Number(l.qty || 0), 0);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const o = await api.post('/sales-orders', { ...c, items: lines.filter((l) => l.product_id).map((l) => ({ product_id: Number(l.product_id), qty: Number(l.qty) })) });
      toast(`${o.code} created`); nav(`/sales/orders/${o.id}`);
    } catch (e2) { setErr(e2.message); av.reload(); } finally { setBusy(false); }
  };
  const chosen = lines.filter((l) => l.product_id).map((l) => ({ p: prods.find((x) => String(x.id) === String(l.product_id)), qty: Number(l.qty || 0) })).filter((x) => x.p);
  const units = chosen.reduce((s, x) => s + x.qty, 0);
  return (
    <div>
      <PageHeader title="New Order" sub="Only stock that physically exists and is not already reserved can be sold." />
      <form onSubmit={submit} className="order-layout">
        <div className="order-main">
          <Card title="Customer details" icon="user" padded><div className="form-grid form-grid-2">
            <Field label="Customer name"><IconInput icon="user"><input className="field-input" placeholder="e.g. Juan Dela Cruz" value={c.customer} onChange={(e) => setC({ ...c, customer: e.target.value })} required maxLength={100} /></IconInput></Field>
            <Field label="Phone"><IconInput icon="phone"><input className="field-input" type="tel" placeholder="09XX XXX XXXX" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} maxLength={30} /></IconInput></Field>
            <div className="span-all"><Field label="Delivery address"><IconInput icon="pin"><input className="field-input" placeholder="House no., street, barangay, city" value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} maxLength={200} /></IconInput></Field></div></div></Card>
          <Card title="Order items" icon="product" padded><Async state={av}>{() => (
            <div className="line-items">
              <div className="line line-head"><span>Product</span><span>Qty</span><span className="r">Amount</span><span /></div>
              {lines.map((l, i) => {
                const p = prods.find((x) => String(x.id) === String(l.product_id));
                const bad = problem(l);
                return (
                  <div className="line" key={i}>
                    <Field>
                      <IconInput icon="product"><select className="field-select" value={l.product_id} onChange={(e) => setLine(i, 'product_id', e.target.value)} required>
                        <option value="">Select product…</option>{prods.map((x) => <option key={x.id} value={x.id} disabled={x.available <= 0}>{x.name} ({x.available > 0 ? `${x.available} available` : 'out of stock'})</option>)}</select></IconInput>
                      {p && !bad && <p className="avail-note muted">{p.available} available · {fmtMoney(p.price)} each</p>}
                      {bad && <p className="avail-note warn" role="alert">⚠ Insufficient stock: only {bad.available} unit{bad.available === 1 ? '' : 's'} {bad.available === 1 ? 'is' : 'are'} currently available.</p>}
                    </Field>
                    <div className="field qty"><IconInput icon="hash"><input className="field-input" type="number" min="1" step="1" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} required aria-label="Quantity" /></IconInput></div>
                    <div className="line-amount">{p ? fmtMoney(p.price * Number(l.qty || 0)) : '-'}</div>
                    {lines.length > 1 ? <button type="button" className="line-remove" aria-label="Remove item" title="Remove item" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button> : <span />}
                  </div>);
              })}
              <button type="button" className="add-line-btn" onClick={() => setLines((l) => [...l, { product_id: '', qty: 1 }])}><Icon name="plus" size={16} />Add another product</button>
            </div>)}</Async></Card>
        </div>
        <aside className="order-side">
          <Card title="Order summary" icon="orders" padded>
            {chosen.length === 0 ? <p className="muted summary-empty">No products added yet.</p> : <div className="summary-items">{chosen.map((x, i) => <div key={i} className="summary-item"><span>{x.p.name}</span><b>×{x.qty}</b></div>)}</div>}
            <div className="summary-row"><span>Products</span><b>{chosen.length}</b></div>
            <div className="summary-row"><span>Total units</span><b>{units}</b></div>
            <div className="summary-row summary-total"><span>Order total</span><b>{fmtMoney(total)}</b></div>
            {err && <div className="banner banner-error" role="alert" style={{ marginTop: 14 }}>{err}</div>}
            <button className="btn btn-primary btn-block" disabled={busy || blocked}><Icon name="cart" size={17} />{busy ? 'Creating…' : 'Create order'}</button>
            <p className="summary-note"><Icon name="info" size={15} />Availability is checked again when the order is created.</p>
          </Card>
        </aside>
      </form>
    </div>
  );
}

export function SalesOrdersPage({ history }) {
  const { can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [tab, setTab] = useState('all');
  const state = useApi(`/sales-orders?scope=${history ? 'history' : 'active'}&q=${encodeURIComponent(dq)}`, { refresh: 30000 });
  const cancel = async (o) => { if (!window.confirm(`Cancel ${o.code}?`)) return; try { await api.post(`/sales-orders/${o.id}/cancel`, {}); toast(`${o.code} cancelled`); state.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <div>
      <PageHeader title={history ? 'Order History' : 'Sales Orders'} sub={history ? 'Completed and cancelled orders.' : 'Monitor progress of open orders. Picking and shipping are handled by the warehouse.'}
        action={can('sales.create') && !history && <Link to="/sales/new" className="btn btn-primary">New order</Link>} />
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search order no. or customer…" />
        {!history && <Tabs value={tab} onChange={setTab} tabs={[{ key: 'all', label: 'All' }, { key: 'pending', label: 'Pending' }, { key: 'picking', label: 'Picking' }, { key: 'ready', label: 'Ready' }]} />}</div>
      <Card><Async state={state}>{(rows) => <Table rows={rows.filter((o) => tab === 'all' || o.status === tab)} empty="No orders found." rowTone={(o) => (o.status === 'cancelled' ? 'critical' : null)} onRow={(o) => nav(`/sales/orders/${o.id}`)} cols={[
        { label: 'Order', render: (o) => <span className="mono cell-primary">{o.code}</span> },
        { label: 'Customer', render: (o) => <>{o.customer}<div className="cell-sub">{o.phone}</div></> },
        { label: 'Items', render: (o) => o.items.map((i) => `${i.qty}× ${i.product}`).join(', ') },
        { label: 'Total', num: true, render: (o) => fmtMoney(o.total) }, { label: 'Created', date: true, render: (o) => <Stamp v={o.created} /> }, { label: 'Status', render: (o) => <Pill status={o.status} /> },
        ...(can('sales.create') && !history ? [{ label: '', render: (o) => o.status === 'pending' && <button className="mini-btn-outline" onClick={(e) => { e.stopPropagation(); cancel(o); }}>Cancel</button> }] : []),
      ]} />}</Async></Card>
    </div>
  );
}

const STEPS = ['pending', 'picking', 'ready', 'shipped'];
const STEP_META = {
  pending: { icon: 'pending', label: 'Pending', hint: 'Order received' },
  picking: { icon: 'pick', label: 'Picking', hint: 'Items being picked' },
  ready: { icon: 'open', label: 'Ready', hint: 'Packed for shipping' },
  shipped: { icon: 'truck', label: 'Shipped', hint: 'Out for delivery' },
};

// Progress tracker: every step is marked done, in progress, or upcoming.
function OrderProgress({ order }) {
  const cur = STEPS.indexOf(order.status);
  const cancelled = order.status === 'cancelled';
  const stateOf = (i) => (cancelled || cur < 0 ? 'todo' : i < cur ? 'done' : i === cur ? (order.status === 'shipped' ? 'done' : 'current') : 'todo');
  const stateText = { done: 'Completed', current: 'In progress', todo: 'Waiting' };
  const stamp = (s) => (s === 'pending' ? fmtDateTime(order.created) : s === 'shipped' && order.shipped ? fmtDateTime(order.shipped) : null);
  const doneCount = STEPS.filter((_, i) => stateOf(i) === 'done').length;
  return (
    <>
      <ol className={`stepper${cancelled ? ' stepper-cancelled' : ''}`} aria-label="Order progress">
        {STEPS.map((s, i) => {
          const st = stateOf(i);
          const m = STEP_META[s];
          const when = st === 'done' ? stamp(s) : null;
          return (
            <li key={s} className={`step step-${st}${i > 0 && stateOf(i - 1) === 'done' ? ' step-linked' : ''}`} aria-current={st === 'current' ? 'step' : undefined}>
              <span className="step-dot"><Icon name={st === 'done' ? 'check' : m.icon} size={st === 'done' ? 22 : 20} /></span>
              <span className="step-label">{m.label}</span>
              <span className="step-state">{st === 'done' ? <Icon name="check" size={13} /> : st === 'current' ? <span className="step-pulse" /> : null}{stateText[st]}</span>
              <span className="step-hint">{when || m.hint}</span>
            </li>
          );
        })}
      </ol>
      {!cancelled && <div className="stepper-foot"><div className="stepper-bar"><span style={{ width: `${(doneCount / STEPS.length) * 100}%` }} /></div><span>{doneCount} of {STEPS.length} steps completed</span></div>}
      {cancelled && <div className="banner banner-error stepper-banner" role="alert"><Icon name="ban" size={17} />This order was cancelled.</div>}
    </>
  );
}

function InfoItem({ icon, label, children }) {
  return (
    <div className="info-item">
      <span className="info-ico"><Icon name={icon} size={18} /></span>
      <div className="info-text"><dt>{label}</dt><dd>{children ?? '-'}</dd></div>
    </div>
  );
}

export function SalesOrderDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const state = useApi(`/sales-orders/${id}`, { refresh: 20000 });
  const cancel = async () => { if (!window.confirm('Cancel this order?')) return; try { await api.post(`/sales-orders/${id}/cancel`, {}); toast('Order cancelled'); state.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <Async state={state}>{(o) => (
      <div>
        <PageHeader crumbs={[{ label: 'Sales Orders', href: '/sales/orders' }, { label: o.code }]} title={o.code} sub={o.customer} action={can('sales.create') && o.status === 'pending' && <button className="btn btn-danger-outline" onClick={cancel}><Icon name="ban" size={16} />Cancel order</button>} />
        <Card title="Progress" icon="levels" right={<Pill status={o.status} />}><OrderProgress order={o} /></Card>
        <Card title="Customer & order" icon="user">
          <dl className="info-grid">
            <InfoItem icon="user" label="Customer">{o.customer}</InfoItem>
            <InfoItem icon="phone" label="Phone">{o.phone}</InfoItem>
            <InfoItem icon="pin" label="Address">{o.address}</InfoItem>
            <InfoItem icon="calendar" label="Created">{fmtDateTime(o.created)}<span className="info-sub">by {o.created_by}</span></InfoItem>
            <InfoItem icon="truck" label="Shipped">{o.shipped ? fmtDateTime(o.shipped) : '-'}</InfoItem>
            <InfoItem icon="info" label="Status"><Pill status={o.status} /></InfoItem>
          </dl>
        </Card>
        <Card title="Items" icon="product" right={<span className="items-count">{o.items.length} item{o.items.length === 1 ? '' : 's'}</span>}>
          <Table rows={o.items} cols={[
            { label: 'Product', render: (i) => <><div className="cell-primary">{i.product}</div><div className="cell-sub mono">{i.sku}</div></> },
            { label: 'Qty', num: true, w: '12%', render: (i) => i.qty },
            { label: 'Price', num: true, w: '18%', render: (i) => fmtMoney(i.price) },
            { label: 'Line total', num: true, w: '18%', render: (i) => <b>{fmtMoney(i.qty * i.price)}</b> },
          ]} />
          <div className="order-total"><span>Order total</span><b>{fmtMoney(o.total)}</b></div>
        </Card>
      </div>
    )}</Async>
  );
}

const OUT = 'Out of Stock';
const AVAIL_TABS = [{ key: 'all', label: 'All' }, { key: 'Available', label: 'Available' }, { key: 'Low Stock', label: 'Low stock' }, { key: OUT, label: 'Out of stock' }];

// Stock overview: which products can be sold right now, filtered by availability status.
export function AvailabilityPage() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [tab, setTab] = useState('all');
  const state = useApi(`/availability?q=${encodeURIComponent(dq)}`, { refresh: 30000 });
  const all = state.data || [];
  const tabs = AVAIL_TABS.map((t) => ({ ...t, count: t.key === 'all' ? all.length : all.filter((p) => p.status === t.key).length }));
  return (
    <div>
      <PageHeader title="Product Availability" sub="Read-only: what can actually be sold right now (physical stock minus reservations)." />
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Filter by name, SKU or category…" /><Tabs value={tab} onChange={setTab} tabs={tabs} /></div>
      <Card><Async state={state}>{(rows) => <Table rows={rows.filter((p) => tab === 'all' || p.status === tab)} empty="No products match your filter." rowTone={(p) => (p.status === OUT ? 'critical' : null)} cols={[
        { label: 'Product', render: (p) => <span className="cell-primary">{p.name}</span> }, { label: 'SKU', render: (p) => <span className="mono">{p.sku}</span> }, { label: 'Category', render: (p) => p.category },
        { label: 'Selling price', num: true, render: (p) => fmtMoney(p.price) }, { label: 'Available qty', num: true, render: (p) => p.available }, { label: 'Status', render: (p) => <Pill status={p.status} /> }]} />}</Async></Card>
    </div>
  );
}

// Product lookup: search first, browse results as cards, narrow by category.
export function SearchProductsPage() {
  const { can } = useAuth();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [cat, setCat] = useState('all');
  const state = useApi(`/availability?q=${encodeURIComponent(dq)}`, { refresh: 30000 });
  const all = state.data || [];
  const cats = [...new Set(all.map((p) => p.category))].sort();
  const shown = all.filter((p) => cat === 'all' || p.category === cat);
  return (
    <div>
      <PageHeader title="Search Products" sub="Look up a product to check its price and how many units can be sold." action={can('sales.create') && <Link to="/sales/new" className="btn btn-primary">New order</Link>} />
      <div className="search-hero"><SearchBox value={q} onChange={(v) => { setQ(v); setCat('all'); }} placeholder="Search by product name, SKU or category…" autoFocus /></div>
      <Tabs value={cat} onChange={setCat} tabs={[{ key: 'all', label: 'All categories' }, ...cats.map((c) => ({ key: c, label: c }))]} />
      <Async state={state}>{() => shown.length === 0 ? <Card><div className="empty-state">No products match your search.</div></Card> : (<>
        <p className="muted result-count">{shown.length} product{shown.length === 1 ? '' : 's'}</p>
        <div className="product-grid">{shown.map((p) => (
          <div key={p.id} className={`product-card${p.status === OUT ? ' product-card-out' : ''}`}>
            <div className="product-card-top"><span className="product-ico"><Icon name="product" size={20} /></span><Pill status={p.status} /></div>
            <div><div className="product-name">{p.name}</div><div className="product-meta"><span className="mono">{p.sku}</span> · {p.category}</div></div>
            <div className="product-card-foot"><b>{fmtMoney(p.price)}</b><span>{p.available} available</span></div>
          </div>))}</div></>)}</Async>
    </div>
  );
}
