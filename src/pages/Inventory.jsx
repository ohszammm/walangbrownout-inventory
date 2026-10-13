import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Async, Bar, Card, Detail, Field, Modal, PageHeader, Pill, SearchBox, Table, KpiGrid, KpiTile, Stamp } from '../components/UI';
import { fmtDate, fmtMoney, signed } from '../lib/format';

const barTone = (s) => ({ OK: 'ok', WATCH: 'watch', LOW: 'low', CRITICAL: 'critical', OUT: 'critical', OVERSTOCK: 'overstock' }[s] || 'ok');
const stockTone = (p) => (['CRITICAL', 'OUT'].includes(p.status) || p.discrepancy ? 'critical' : null);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function InventoryPage() {
  const { user, can } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [adding, setAdding] = useState(false);
  const state = useApi(`/products?q=${encodeURIComponent(dq)}`);
  const all = useApi('/products').data || [];
  const kpi = { total: all.length, units: all.reduce((a, p) => a + p.on_hand, 0), low: all.filter((p) => p.status === 'LOW').length, crit: all.filter((p) => ['CRITICAL', 'OUT'].includes(p.status)).length };
  const showPlanning = user.role !== 'warehouse';
  const cols = [
    { label: 'Product', render: (p) => <><div className="cell-primary">{p.name}</div><div className="cell-sub mono">{p.sku} · {p.category}</div></> },
    { label: 'On hand', num: true, render: (p) => p.on_hand },
    { label: 'Available', num: true, render: (p) => p.available },
    ...(showPlanning ? [{ label: 'Reorder pt', num: true, render: (p) => p.reorder_point }] : []),
    ...(user.role === 'purchasing' ? [{ label: 'Suggested qty', num: true, render: (p) => p.suggested_qty || '-' }] : []),
    { label: 'Location', render: (p) => <span className="mono">{p.bin || '-'}</span> },
    { label: 'Next expiry', date: true, render: (p) => (p.perishable ? fmtDate(p.nearest_expiry) : '-') },
    { label: 'Status', render: (p) => <><Pill status={p.status} />{p.discrepancy && <> <Pill status="critical" label="Count mismatch" /></>}</> },
  ];
  return (
    <div>
      <PageHeader title="Inventory" sub={user.role === 'purchasing' ? 'Read-only view of stock, reorder points and suggested quantities.' : user.role === 'warehouse' ? 'Search products and see stock, bin location and batch information.' : 'All products, stock levels and their health.'}
        action={can('products.write') && <button className="btn btn-primary" onClick={() => setAdding(true)}>Add product</button>} />
      <KpiGrid>
        <KpiTile icon="boxes" label="Total products" value={kpi.total} tone="info" />
        <KpiTile icon="product" label="Total stock (units)" value={kpi.units.toLocaleString()} tone="ok" />
        <KpiTile icon="lowstock" label="Low stock" value={kpi.low} tone="warning" to="/alerts/low-stock" />
        <KpiTile icon="alert" label="Critical stock" value={kpi.crit} tone={kpi.crit ? 'critical' : 'ok'} to="/alerts/low-stock" />
      </KpiGrid>
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search by name, SKU or category…" /></div>
      <Card><Async state={state}>{(rows) => <Table cols={cols} rows={rows} empty="No products match your search." rowTone={stockTone} onRow={(p) => nav(`/inventory/${p.sku}`)} />}</Async></Card>
      {adding && <ProductForm onClose={() => setAdding(false)} onSaved={(p) => { setAdding(false); nav(`/inventory/${p.sku}`); }} />}
    </div>
  );
}

export function StockLevelsPage() {
  const nav = useNavigate();
  const state = useApi('/products');
  const cols = [
    { label: 'Product', render: (p) => <><div className="cell-primary">{p.name}</div><div className="cell-sub mono">{p.sku}</div></> },
    { label: 'Level', w: 170, render: (p) => <Bar value={p.on_hand} max={p.max_stock} tone={barTone(p.status)} /> },
    { label: 'On hand', num: true, render: (p) => p.on_hand },
    { label: 'Reserved', num: true, render: (p) => p.reserved },
    { label: 'On order', num: true, render: (p) => p.on_order },
    { label: 'Reorder pt', num: true, render: (p) => <>{p.reorder_point}{p.in_season_window && <span title="Seasonal demand multiplier applied"> ↑</span>}</> },
    { label: 'Max', num: true, render: (p) => p.max_stock },
    { label: 'Suggested', num: true, render: (p) => p.suggested_qty || '-' },
    { label: 'Status', render: (p) => <Pill status={p.status} /> },
  ];
  return (
    <div>
      <PageHeader title="Stock Levels" sub="Reorder point = average daily usage × lead time + safety stock (raised ahead of the seasonal window)." />
      <Card><Async state={state}>{(rows) => <Table cols={cols} rows={rows} rowTone={stockTone} onRow={(p) => nav(`/inventory/${p.sku}`)} />}</Async></Card>
    </div>
  );
}

export function ProductDetail() {
  const { sku } = useParams();
  const { user, can } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const state = useApi(`/products/${encodeURIComponent(sku)}`);
  const [edit, setEdit] = useState(false);
  const [adj, setAdj] = useState(false);
  const planning = user.role !== 'warehouse';
  const del = async (p) => {
    if (!window.confirm(`Delete ${p.name}? It will be hidden from inventory.`)) return;
    try { await api.del(`/products/${p.id}`); toast('Product deleted'); nav('/inventory'); } catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Async state={state}>{(p) => (
      <div>
        <PageHeader crumbs={[{ label: 'Inventory', href: '/inventory' }, { label: p.sku }]} title={p.name} sub={`${p.category} · Class ${p.class}${p.perishable ? ` · perishable (${p.shelf_life_days} days)` : ''}`}
          action={<>
            {can('adjust.approve') || can('adjust.request') ? <button className="btn btn-secondary" onClick={() => setAdj(true)}>{can('adjust.approve') ? 'Adjust stock' : 'Request adjustment'}</button> : null}
            {can('products.write') && <button className="btn btn-secondary" onClick={() => setEdit(true)}>Edit</button>}
            {can('products.delete') && <button className="btn btn-danger-outline" onClick={() => del(p)}>Delete</button>}
          </>} />
        {p.discrepancy && <div className="banner banner-error">Stock count mismatch: system shows {p.discrepancy.system_qty}, physical count found {p.discrepancy.physical_qty}. Availability is limited to the physical count until this is resolved.</div>}
        <KpiGrid>
          <KpiTile label="On hand" value={p.on_hand} tone="info" />
          <KpiTile label="Available to sell" value={p.available} tone="ok" />
          <KpiTile label="Reserved" value={p.reserved} tone="warning" />
          {planning && <KpiTile label="Reorder point" value={p.reorder_point} tone={p.status === 'OK' ? 'ok' : 'critical'} sub={p.in_season_window ? 'Seasonal multiplier active' : undefined} />}
        </KpiGrid>
        <Card title="Details"><Detail items={[
          ['Status', <Pill key="s" status={p.status} />], ['Bin location', p.bin], ['Selling price', fmtMoney(p.price)],
          ...(can('products.write') ? [['Unit cost', fmtMoney(p.unit_cost)], ['Supplier', p.supplier_name]] : []),
          ...(planning ? [['Avg daily usage', p.avg_daily_usage], ['Lead time', `${p.lead_time} days`], ['Safety stock', `${p.safety_stock_effective ?? p.safety_stock} (${p.safety_stock_source === 'calculated' ? 'calculated from demand history' : 'set manually'})`], ['Maximum stock', p.max_stock], ['On order', p.on_order], ['Seasonal', p.seasonal ? `${MONTHS[p.season_start - 1]}–${MONTHS[p.season_end - 1]} × ${p.season_mult}` : 'No']] : []),
        ]} /></Card>
        <Card title="Batches (pick order)" right={can('batches.view') && <Link to="/batches" className="breadcrumb-link" style={{ fontSize: 13 }}>All batches</Link>}>
          <Table rows={p.batches} empty="No stock on hand." cols={[
            { label: '#', render: (b) => b.pick_order, center: true },
            { label: 'Batch', render: (b) => <Link className="breadcrumb-link mono" to={can('batches.view') ? `/batches/${b.id}` : '#'}>{b.code}</Link> },
            { label: 'Qty', num: true, render: (b) => b.qty }, { label: 'Received', date: true, render: (b) => fmtDate(b.received) },
            { label: 'Expiry', date: true, render: (b) => (b.expiry ? <>{fmtDate(b.expiry)}<span className="stamp-time">{b.days_left} days left</span></> : 'No expiry') }, { label: 'Bin', render: (b) => b.bin || '-' },
            { label: 'Status', render: (b) => (b.expired ? <Pill status="expired" label="Expired: do not pick" /> : <Pill status={b.expiry && b.days_left <= 30 ? 'expiring' : 'good'} label={b.expiry && b.days_left <= 30 ? 'Expiring' : 'Good'} />) },
          ]} />
        </Card>
        {can('movements.view') && <Card title="Recent movements"><Table rows={p.movements} empty="No movements." cols={[
          { label: 'Time', date: true, render: (m) => <Stamp v={m.ts} /> }, { label: 'Type', render: (m) => m.type }, { label: 'Qty', num: true, render: (m) => <span className={m.qty < 0 ? 'neg' : ''}>{signed(m.qty)}</span> },
          { label: 'Batch', render: (m) => m.batch_code || '-' }, { label: 'Reference', render: (m) => m.ref || '-' }, { label: 'By', render: (m) => m.user_name }]} /></Card>}
        {edit && <ProductForm product={p} onClose={() => setEdit(false)} onSaved={(np) => { setEdit(false); if (np.sku !== p.sku) nav(`/inventory/${np.sku}`, { replace: true }); else state.reload(); }} />}
        {adj && <AdjustForm product={p} direct={can('adjust.approve')} onClose={() => setAdj(false)} onDone={() => { setAdj(false); state.reload(); }} />}
      </div>
    )}</Async>
  );
}

function AdjustForm({ product, direct, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ delta: '', reason: '' });
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.post('/adjustments', { product_id: product.id, delta: Number(f.delta), reason: f.reason }); toast(direct ? 'Stock adjusted' : 'Adjustment requested, awaiting Inventory Manager approval'); onDone(); }
    catch (e2) { setErr(e2.message); }
  };
  return (
    <Modal title={direct ? `Adjust stock: ${product.sku}` : `Request adjustment: ${product.sku}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted" style={{ marginTop: 0 }}>Currently {product.on_hand} on hand. Use a negative number to remove stock.</p>
        <div className="form-grid">
          <Field label="Change (units)"><input className="field-input" type="number" step="1" value={f.delta} onChange={(e) => setF({ ...f, delta: e.target.value })} required /></Field>
          <Field label="Reason" grow={2}><input className="field-input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required maxLength={300} /></Field>
        </div>
        {err && <p className="field-error">{err}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary">{direct ? 'Apply adjustment' : 'Send request'}</button></div>
      </form>
    </Modal>
  );
}

function ProductForm({ product, onClose, onSaved }) {
  const toast = useToast();
  const sup = useApi('/suppliers');
  const [f, setF] = useState(() => product ? { ...product, supplier_id: product.supplier_id || '', bin: product.bin || '' } : { sku: '', name: '', category: '', class: 'B', perishable: false, shelf_life_days: 270, seasonal: false, season_start: 4, season_end: 7, season_mult: 3, avg_daily_usage: 1, lead_time: 7, safety_stock: 0, max_stock: 100, unit_cost: 0, price: 0, supplier_id: '', bin: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const body = { ...f, supplier_id: f.supplier_id || null };
      const saved = product ? await api.put(`/products/${product.id}`, body) : await api.post('/products', body);
      toast(product ? 'Product updated' : 'Product added'); onSaved(saved);
    } catch (e2) { setErr(e2.message); }
  };
  const N = (k, label, extra = {}) => <Field label={label}><input className="field-input" type="number" step={extra.step || 1} min="0" value={f[k] ?? ''} onChange={set(k)} required /></Field>;
  return (
    <Modal title={product ? `Edit ${product.sku}` : 'Add product'} onClose={onClose} wide>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="SKU"><input className="field-input" value={f.sku} onChange={set('sku')} required maxLength={30} /></Field>
          <Field label="Name"><input className="field-input" value={f.name} onChange={set('name')} required /></Field>
          <Field label="Category"><input className="field-input" value={f.category} onChange={set('category')} required /></Field>
          <Field label="Class"><select className="field-select" value={f.class} onChange={set('class')}><option>A</option><option>B</option><option>C</option></select></Field>
          <Field label="Bin location"><input className="field-input" value={f.bin} onChange={set('bin')} maxLength={20} /></Field>
          <Field label="Preferred supplier"><select className="field-select" value={f.supplier_id} onChange={set('supplier_id')}><option value="">None</option>{(sup.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          {N('avg_daily_usage', 'Avg daily usage', { step: 'any' })}{N('lead_time', 'Lead time (days)')}{N('safety_stock', 'Safety stock')}{N('max_stock', 'Maximum stock')}
          {N('unit_cost', 'Unit cost (₱)', { step: 'any' })}{N('price', 'Selling price (₱)', { step: 'any' })}
          <div className="span-all check-row"><input id="pr" type="checkbox" checked={!!f.perishable} onChange={set('perishable')} /><label htmlFor="pr">Perishable (tracked by expiry, FEFO)</label></div>
          {f.perishable && N('shelf_life_days', 'Shelf life (days)')}
          <div className="span-all check-row"><input id="sn" type="checkbox" checked={!!f.seasonal} onChange={set('seasonal')} /><label htmlFor="sn">Seasonal demand</label></div>
          {f.seasonal && <>
            <Field label="Season start"><select className="field-select" value={f.season_start} onChange={set('season_start')}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
            <Field label="Season end"><select className="field-select" value={f.season_end} onChange={set('season_end')}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
            {N('season_mult', 'Demand multiplier', { step: 'any' })}
          </>}
        </div>
        {err && <p className="field-error" role="alert">{err}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary">Save product</button></div>
      </form>
    </Modal>
  );
}
