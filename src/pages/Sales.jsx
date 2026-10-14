import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Async, Card, Detail, Field, IconInput, PageHeader, Pill, SearchBox, Table, Tabs, Stamp } from '../components/UI';
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
export function SalesOrderDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const state = useApi(`/sales-orders/${id}`, { refresh: 20000 });
  const cancel = async () => { if (!window.confirm('Cancel this order?')) return; try { await api.post(`/sales-orders/${id}/cancel`, {}); toast('Order cancelled'); state.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <Async state={state}>{(o) => (
      <div>
        <PageHeader crumbs={[{ label: 'Sales Orders', href: '/sales/orders' }, { label: o.code }]} title={o.code} sub={o.customer} action={can('sales.create') && o.status === 'pending' && <button className="btn btn-danger-outline" onClick={cancel}>Cancel order</button>} />
        <Card title="Progress"><div className="status-strip">{STEPS.map((s) => <div key={s} style={o.status === s ? { outline: '2px solid var(--accent)' } : STEPS.indexOf(s) < STEPS.indexOf(o.status) ? { opacity: .55 } : undefined}><b>{STEPS.indexOf(s) <= STEPS.indexOf(o.status) ? '✓' : '·'}</b><span style={{ textTransform: 'capitalize' }}>{s}</span></div>)}</div>
          {o.status === 'cancelled' && <div className="banner banner-error" style={{ margin: '0 24px 18px' }}>This order was cancelled.</div>}</Card>
        <Card title="Customer & order"><Detail items={[['Customer', o.customer], ['Phone', o.phone], ['Address', o.address], ['Created', `${fmtDateTime(o.created)} by ${o.created_by}`], ['Shipped', o.shipped ? fmtDateTime(o.shipped) : '-'], ['Status', <Pill key="s" status={o.status} />]]} /></Card>
        <Card title="Items"><Table rows={o.items} cols={[{ label: 'Product', render: (i) => <><div className="cell-primary">{i.product}</div><div className="cell-sub mono">{i.sku}</div></> }, { label: 'Qty', num: true, render: (i) => i.qty }, { label: 'Price', num: true, render: (i) => fmtMoney(i.price) }, { label: 'Line total', num: true, render: (i) => fmtMoney(i.qty * i.price) }]} />
          <div className="list-row"><span /><b>Total {fmtMoney(o.total)}</b></div></Card>
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
