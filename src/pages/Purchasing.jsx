import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Async, Card, Detail, Field, Modal, PageHeader, Pill, PriorityPill, Table, Tabs } from '../components/UI';
import { fmtDate, fmtDateTime, fmtMoney, todayStr } from '../lib/format';

export function ReorderPage() {
  const { can } = useAuth();
  const nav = useNavigate();
  const state = useApi('/reorder', { refresh: 30000 });
  return (
    <div>
      <PageHeader title="Reorder Alerts" sub="Low and critical products with reorder points, suggested quantities and preferred suppliers. Suggestions already account for stock on order." />
      <Card><Async state={state}>{(rows) => <Table rows={rows} empty="Nothing needs reordering right now." rowTone={(r) => (['CRITICAL', 'HIGH'].includes(r.priority) ? 'critical' : null)} cols={[
        { label: 'Product', render: (r) => <><div className="cell-primary">{r.name}</div><div className="cell-sub mono">{r.sku}</div></> },
        { label: 'Current stock', num: true, render: (r) => r.current }, { label: 'On order', num: true, render: (r) => r.on_order },
        { label: 'Reorder point', num: true, render: (r) => <>{r.reorder_point}{r.in_season_window && <span title="Seasonal multiplier active"> ↑</span>}</> },
        { label: 'Suggested qty', num: true, render: (r) => <b>{r.suggested_qty}</b> },
        { label: 'Priority', render: (r) => <PriorityPill p={r.priority} /> }, { label: 'Preferred supplier', render: (r) => r.supplier || '-' },
        ...(can('po.create') ? [{ label: '', render: (r) => <button className="mini-btn" disabled={!r.suggested_qty} onClick={() => nav(`/purchase-orders?product=${r.id}&qty=${r.suggested_qty}&supplier=${r.supplier_id || ''}`)}>Create PO</button> }] : []),
      ]} />}</Async></Card>
    </div>
  );
}

const poCols = [
  { label: 'PO', render: (o) => <span className="mono cell-primary">{o.code}</span> }, { label: 'Supplier', render: (o) => o.supplier },
  { label: 'Items', render: (o) => o.items.map((i) => `${i.qty}× ${i.product}`).join(', ') },
  { label: 'Value', num: true, render: (o) => fmtMoney(o.total) }, { label: 'Created', date: true, render: (o) => <>{fmtDate(o.created)}<span className="stamp-time">{o.created_by}</span></> },
  { label: 'Expected', date: true, render: (o) => fmtDate(o.expected || o.shipment?.expected_date) }, { label: 'Status', render: (o) => <Pill status={o.status} /> },
];

export function PurchaseOrdersPage() {
  const { can, user } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const state = useApi('/purchase-orders');
  const [tab, setTab] = useState('open');
  const [creating, setCreating] = useState(sp.has('product'));
  useEffect(() => { if (sp.has('product')) setCreating(true); }, [sp]);
  return (
    <div>
      <PageHeader title="Purchase Orders" sub={can('po.create') ? 'Create, send and track purchase orders.' : 'View purchase orders and incoming purchases. Only the Purchasing Manager creates or changes them.'}
        action={can('po.create') && <button className="btn btn-primary" onClick={() => setCreating(true)}>New purchase order</button>} />
      <Async state={state}>{(rows) => {
        const shown = tab === 'open' ? rows.filter((o) => ['draft', 'sent', 'partial'].includes(o.status)) : rows.filter((o) => !['draft', 'sent', 'partial'].includes(o.status));
        return (<>
          <Tabs value={tab} onChange={setTab} tabs={[{ key: 'open', label: 'Pending', count: rows.filter((o) => ['draft', 'sent', 'partial'].includes(o.status)).length }, { key: 'closed', label: 'Completed / cancelled' }]} />
          <Card><Table rows={shown} cols={poCols} empty="No purchase orders here." onRow={(o) => nav(`/purchase-orders/${o.id}`)} /></Card>
        </>);
      }}</Async>
      {creating && user && <POForm initial={{ product: sp.get('product'), qty: sp.get('qty'), supplier: sp.get('supplier') }} onClose={() => { setCreating(false); setSp({}); }} onDone={(po) => { setCreating(false); setSp({}); nav(`/purchase-orders/${po.id}`); }} />}
    </div>
  );
}

function POForm({ initial, onClose, onDone }) {
  const toast = useToast();
  const sup = useApi('/suppliers');
  const prods = useApi('/products');
  const [supplier, setSupplier] = useState(initial.supplier || '');
  const [lines, setLines] = useState([{ product_id: initial.product || '', qty: initial.qty || '' }]);
  const [expected, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const setLine = (i, k, v) => setLines((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const submit = async (send) => {
    setErr(''); setBusy(true);
    try {
      const po = await api.post('/purchase-orders', { supplier_id: Number(supplier), expected: expected || undefined, notes: notes || undefined, send, items: lines.filter((l) => l.product_id).map((l) => ({ product_id: Number(l.product_id), qty: Number(l.qty) })) });
      toast(send ? `${po.code} sent to supplier` : `${po.code} saved as draft`);
      po.warnings?.forEach((w) => toast(`Check: ${w}`, 'error'));
      onDone(po);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const products = prods.data || [];
  return (
    <Modal title="New purchase order" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); submit(true); }}>
        <div className="form-grid">
          <Field label="Supplier"><select className="field-select" value={supplier} onChange={(e) => setSupplier(e.target.value)} required><option value="">Select supplier…</option>{(sup.data || []).filter((s) => s.status === 'active').map((s) => <option key={s.id} value={s.id}>{s.name} ({s.lead_time_days}d)</option>)}</select></Field>
          <Field label="Expected delivery" hint="Leave empty to use the supplier lead time."><input className="field-input" type="date" min={todayStr()} value={expected} onChange={(e) => setExpected(e.target.value)} /></Field>
        </div>
        <div className="line-items" style={{ marginTop: 18 }}>
          {lines.map((l, i) => {
            const p = products.find((x) => String(x.id) === String(l.product_id));
            const projected = p ? p.on_hand + p.on_order + Number(l.qty || 0) : 0;
            return (
              <div className="line" key={i}>
                <Field label={i === 0 ? 'Product' : ''}><select className="field-select" value={l.product_id} onChange={(e) => setLine(i, 'product_id', e.target.value)} required><option value="">Select product…</option>{products.map((x) => <option key={x.id} value={x.id}>{x.name} (stock {x.on_hand})</option>)}</select>
                  {p && <p className={`avail-note ${projected > p.max_stock ? 'warn' : 'muted'}`}>On hand {p.on_hand} · on order {p.on_order} · suggested {p.suggested_qty} · max {p.max_stock}{projected > p.max_stock ? ' (would exceed maximum)' : ''}</p>}</Field>
                <div className="field qty"><label className="field-label">{i === 0 ? 'Quantity' : ''}</label><input className="field-input" type="number" min="1" step="1" value={l.qty} onChange={(e) => setLine(i, 'qty', e.target.value)} required /></div>
                {lines.length > 1 && <button type="button" className="mini-btn-outline" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>Remove</button>}
              </div>);
          })}
          <button type="button" className="link-btn" onClick={() => setLines((l) => [...l, { product_id: '', qty: '' }])}>+ Add another product</button>
        </div>
        <div style={{ marginTop: 14 }}><Field label="Notes (optional)"><input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></Field></div>
        {err && <p className="field-error" role="alert">{err}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={() => submit(false)}>Save draft</button><button className="btn btn-primary" disabled={busy}>Send to supplier</button></div>
      </form>
    </Modal>
  );
}

export function PODetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const state = useApi(`/purchase-orders/${id}`);
  const act = async (a) => { if (a === 'cancel' && !window.confirm('Cancel this purchase order?')) return; try { await api.post(`/purchase-orders/${id}/${a}`, {}); toast(a === 'send' ? 'Sent to supplier' : 'Purchase order cancelled'); state.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <Async state={state}>{(o) => (
      <div>
        <PageHeader crumbs={[{ label: 'Purchase Orders', href: '/purchase-orders' }, { label: o.code }]} title={o.code} sub={o.supplier}
          action={can('po.create') && <>{o.status === 'draft' && <button className="btn btn-primary" onClick={() => act('send')}>Send to supplier</button>}{['draft', 'sent'].includes(o.status) && <button className="btn btn-danger-outline" onClick={() => act('cancel')}>Cancel PO</button>}</>} />
        <Card title="Summary"><Detail items={[['Status', <Pill key="s" status={o.status} />], ['Created', `${fmtDateTime(o.created)} by ${o.created_by}`], ['Expected', fmtDate(o.expected || o.shipment?.expected_date)], ['Total value', fmtMoney(o.total)],
          ['Shipment', o.shipment ? <Link key="sh" className="breadcrumb-link" to="/shipments/incoming">{o.shipment.code} ({o.shipment.status})</Link> : 'Not sent yet'], ['Notes', o.notes]]} /></Card>
        <Card title="Items"><Table rows={o.items} cols={[
          { label: 'Product', render: (i) => <><div className="cell-primary">{i.product}</div><div className="cell-sub mono">{i.sku}</div></> }, { label: 'Ordered', num: true, render: (i) => i.qty },
          { label: 'Received', num: true, render: (i) => (o.status === 'received' ? i.received_qty : '-') }, { label: 'Unit cost', num: true, render: (i) => fmtMoney(i.unit_cost) }, { label: 'Line total', num: true, render: (i) => fmtMoney(i.qty * i.unit_cost) }]} /></Card>
      </div>
    )}</Async>
  );
}

export function PurchaseHistoryPage() {
  const nav = useNavigate();
  const state = useApi('/purchase-history');
  return (
    <div><PageHeader title="Purchase History" sub="Completed and cancelled purchase orders." />
      <Card><Async state={state}>{(rows) => <Table rows={rows} cols={poCols} empty="No purchase history yet." onRow={(o) => nav(`/purchase-orders/${o.id}`)} />}</Async></Card></div>
  );
}

export function SuppliersPage() {
  const { can } = useAuth();
  const state = useApi('/suppliers');
  const [form, setForm] = useState(null);
  const [view, setView] = useState(null);
  return (
    <div>
      <PageHeader title="Suppliers" sub={can('suppliers.manage') ? 'Add, edit and review suppliers and their purchase history.' : 'View suppliers. Only the Purchasing Manager can add or change supplier details.'}
        action={can('suppliers.manage') && <button className="btn btn-primary" onClick={() => setForm({})}>Add supplier</button>} />
      <Card><Async state={state}>{(rows) => <Table rows={rows} empty="No suppliers yet." onRow={(s) => setView(s.id)} cols={[
        { label: 'Supplier', render: (s) => <><div className="cell-primary">{s.name}</div><div className="cell-sub mono">{s.code}</div></> },
        { label: 'Contact', render: (s) => <>{s.contact || '-'}<div className="cell-sub">{s.email}</div></> }, { label: 'Phone', render: (s) => s.phone || '-' },
        { label: 'Lead time', num: true, render: (s) => `${s.lead_time_days} days` }, { label: 'Open POs', num: true, render: (s) => s.open_pos }, { label: 'Status', render: (s) => <Pill status={s.status} /> },
        ...(can('suppliers.manage') ? [{ label: '', render: (s) => <button className="mini-btn-outline" onClick={(e) => { e.stopPropagation(); setForm(s); }}>Edit</button> }] : []),
      ]} />}</Async></Card>
      {form && <SupplierForm s={form} onClose={() => setForm(null)} onDone={() => { setForm(null); state.reload(); }} />}
      {view && <SupplierView id={view} onClose={() => setView(null)} />}
    </div>
  );
}
function SupplierView({ id, onClose }) {
  const s = useApi(`/suppliers/${id}`);
  return (
    <Modal title={s.data?.name || 'Supplier'} onClose={onClose} wide>
      <Async state={s}>{(d) => (<>
        <Detail items={[['Code', d.code], ['Contact', d.contact], ['Email', d.email], ['Phone', d.phone], ['Lead time', `${d.lead_time_days} days`], ['Status', <Pill key="s" status={d.status} />], ['Notes', d.notes]]} />
        <h3 style={{ margin: '8px 24px 0' }}>Purchase history</h3>
        <Table rows={d.history} empty="No purchase orders with this supplier." cols={[{ label: 'PO', render: (o) => <Link className="breadcrumb-link mono" to={`/purchase-orders/${o.id}`}>{o.code}</Link> }, { label: 'Created', date: true, render: (o) => fmtDate(o.created) }, { label: 'Value', num: true, render: (o) => fmtMoney(o.total) }, { label: 'Status', render: (o) => <Pill status={o.status} /> }]} />
      </>)}</Async>
    </Modal>
  );
}
function SupplierForm({ s, onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', contact: '', email: '', phone: '', lead_time_days: 14, status: 'active', notes: '', ...s });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => { e.preventDefault(); setErr(''); try { if (s.id) await api.put(`/suppliers/${s.id}`, f); else await api.post('/suppliers', f); toast('Supplier saved'); onDone(); } catch (e2) { setErr(e2.message); } };
  return (
    <Modal title={s.id ? `Edit ${s.name}` : 'Add supplier'} onClose={onClose}>
      <form onSubmit={submit}><div className="form-grid">
        <Field label="Name"><input className="field-input" value={f.name} onChange={set('name')} required /></Field><Field label="Contact person"><input className="field-input" value={f.contact || ''} onChange={set('contact')} /></Field>
        <Field label="Email"><input className="field-input" type="email" value={f.email || ''} onChange={set('email')} /></Field><Field label="Phone"><input className="field-input" value={f.phone || ''} onChange={set('phone')} /></Field>
        <Field label="Lead time (days)"><input className="field-input" type="number" min="0" value={f.lead_time_days} onChange={set('lead_time_days')} required /></Field>
        <Field label="Status"><select className="field-select" value={f.status} onChange={set('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
        <div className="span-all"><Field label="Notes"><input className="field-input" value={f.notes || ''} onChange={set('notes')} /></Field></div></div>
        {err && <p className="field-error" role="alert">{err}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary">Save supplier</button></div></form>
    </Modal>
  );
}
