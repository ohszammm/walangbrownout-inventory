import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Async, Card, Field, KpiGrid, KpiTile, Modal, PageHeader, Pill, SearchBox, Table, Tabs, Stamp } from '../components/UI';
import Icon from '../components/Icon';
import { fmtDate, signed, todayStr } from '../lib/format';

export function ShipmentsPage() {
  const { dir } = useParams();
  const { user } = useAuth();
  const tabs = [
    ...(user.role !== 'sales' ? [{ key: 'incoming', label: 'Incoming' }] : []),
    ...(user.role !== 'purchasing' ? [{ key: 'outgoing', label: user.role === 'sales' ? 'Outgoing status' : 'Outgoing' }] : []),
  ];
  const current = tabs.some((t) => t.key === dir) ? dir : tabs[0].key;
  const sub = {
    incoming: user.role === 'purchasing' ? 'Monitor only. Track status and expected dates. Receiving and quantity checks are done by the warehouse.' : user.role === 'warehouse' ? 'Receive shipments: enter what actually arrived. Differences are reported to the Inventory Manager.' : user.role === 'admin' ? 'View only.' : 'Monitor incoming shipments, quantities and variances.',
    outgoing: user.role === 'sales' ? 'Status only. Packing and shipping are handled by the warehouse.' : user.role === 'warehouse' ? 'Prepare packed orders for shipment and confirm when they leave.' : 'Monitor outgoing shipments and their status.',
  }[current];
  return (
    <div>
      <PageHeader title={current === 'incoming' ? 'Incoming Shipments' : user.role === 'sales' ? 'Outgoing Shipment Status' : 'Outgoing Shipments'} sub={sub} />
      {current === 'incoming' ? <Incoming /> : <Outgoing />}
    </div>
  );
}

function Incoming() {
  const { can, user } = useAuth();
  const state = useApi('/incoming', { refresh: 30000 });
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const isOpen = (s) => ['expected', 'delayed'].includes(s.status);
  return (
    <Async state={state}>{(rows) => {
      const open = rows.filter(isOpen);
      const done = rows.filter((s) => !isOpen(s));
      const late = open.filter((s) => s.status === 'delayed');
      const variance = done.filter((s) => s.status === 'variance');
      const needle = q.trim().toLowerCase();
      const shown = (tab === 'open' ? open : done).filter((s) => !needle || `${s.code} ${s.po_code} ${s.supplier}`.toLowerCase().includes(needle));
      const due = (s) => (s.days === 0 ? ['Due today', 'due-soon'] : s.days < 0 ? [`${-s.days} day${s.days === -1 ? '' : 's'} late`, 'due-late'] : [`In ${s.days} day${s.days === 1 ? '' : 's'}`, s.days <= 3 ? 'due-soon' : 'due-ok']);
      const cols = [
        { label: 'Shipment', render: (s) => <><span className="ship-code">{s.code}</span><span className="ship-po cell-sub">{can('po.view') ? <Link className="breadcrumb-link mono" to={`/purchase-orders/${s.po_id}`} onClick={(e) => e.stopPropagation()}>{s.po_code}</Link> : s.po_code}</span></> },
        { label: 'Supplier', render: (s) => s.supplier },
        tab === 'open'
          ? { label: 'Expected', date: true, render: (s) => { const [t, c] = due(s); return <><span className="stamp-date">{fmtDate(s.expected_date)}</span><span className={`due ${c}`}>{t}</span></>; } }
          : { label: 'Received', date: true, render: (s) => <><span className="stamp-date">{fmtDate(s.received_date)}</span>{s.received_by && <span className="due">{s.received_by}</span>}</> },
        { label: 'Expected qty', num: true, render: (s) => s.expected_units },
        { label: 'Received qty', num: true, render: (s) => (s.received_units ?? '-') },
        { label: 'Difference', num: true, render: (s) => (s.received_units === null ? '-' : <span className={`ship-diff ${s.received_units - s.expected_units ? 'neg' : ''}`}>{signed(s.received_units - s.expected_units)}</span>) },
        { label: 'Status', render: (s) => <Pill status={s.status} label={s.status === 'variance' ? 'Variance' : undefined} /> },
        { label: 'Action', render: (s) => (isOpen(s) && can('shipments.receive')
          ? <button className="mini-btn" onClick={(e) => { e.stopPropagation(); setSel({ ...s, _receive: true }); }}><Icon name="inbound" size={14} />Receive</button>
          : <button className="mini-btn-outline" onClick={(e) => { e.stopPropagation(); setSel(s); }}><Icon name="eye" size={14} />Details</button>) },
      ];
      return (<>
        <KpiGrid>
          <KpiTile icon="truck" label="On the way" value={open.length} tone="info" />
          <KpiTile icon="clock" label="Delayed" value={late.length} tone={late.length ? 'critical' : 'ok'} />
          <KpiTile icon="inbound" label="Received" value={done.length} tone="ok" />
          <KpiTile icon="alert" label="With variance" value={variance.length} tone={variance.length ? 'warning' : 'ok'} />
        </KpiGrid>
        {late.length > 0 && tab === 'open' && <div className="banner banner-warn banner-ico"><Icon name="alert" size={18} />{late.length} shipment{late.length === 1 ? ' is' : 's are'} past the expected date. Follow up with the supplier.</div>}
        <div className="toolbar">
          <SearchBox value={q} onChange={setQ} placeholder="Search shipment, PO or supplier…" />
          <Tabs value={tab} onChange={setTab} tabs={[{ key: 'open', label: 'On the way', count: open.length }, { key: 'done', label: 'Completed', count: done.length }]} />
        </div>
        <Card><Table rows={shown} empty={needle ? 'No shipments match your search.' : tab === 'open' ? 'No shipments on the way.' : 'No completed shipments.'} rowTone={(s) => (['delayed', 'variance'].includes(s.status) ? 'critical' : null)} onRow={setSel} cols={cols} /></Card>
        {sel && <ShipmentModal s={sel} receive={sel._receive || false} canReceive={can('shipments.receive')} role={user.role} onClose={() => setSel(null)} onDone={() => { setSel(null); state.reload(); }} />}
      </>);
    }}</Async>
  );
}

function ShipmentModal({ s, receive, canReceive, onClose, onDone }) {
  const toast = useToast();
  const [mode, setMode] = useState(receive);
  const [lines, setLines] = useState(() => Object.fromEntries(s.items.map((i) => [i.product_id, { received_qty: i.expected, expiry: '', bin: i.bin || '' }])));
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (id, k, v) => setLines((l) => ({ ...l, [id]: { ...l[id], [k]: v } }));
  const open = ['expected', 'delayed'].includes(s.status);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const items = s.items.map((i) => ({ product_id: i.product_id, received_qty: Number(lines[i.product_id].received_qty), expiry: lines[i.product_id].expiry || undefined, bin: lines[i.product_id].bin || undefined }));
      const r = await api.post(`/incoming/${s.id}/receive`, { items, note: note || undefined });
      toast(r.status === 'variance' ? 'Received with a quantity difference. Reported to the Inventory Manager' : 'Shipment received', r.status === 'variance' ? 'error' : 'success'); onDone();
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={`${s.code} / ${s.po_code}`} icon="truck" onClose={onClose} wide>
      <form onSubmit={submit}>
        <p className="muted" style={{ marginTop: 0 }}>{s.supplier} · expected {fmtDate(s.expected_date)} · <Pill status={s.status} /></p>
        {s.received_date && <p className="muted">Received {fmtDate(s.received_date)} by {s.received_by}.{s.note ? ` Note: ${s.note}` : ''}</p>}
        <div className="table-scroll-wrap"><table className="data-table"><thead><tr><th>Product</th><th className="num">Expected</th>{mode ? <><th>Received</th><th>Expiry</th><th>Bin</th></> : <><th className="num">Received</th><th className="num">Diff</th></>}</tr></thead>
          <tbody>{s.items.map((i) => (
            <tr key={i.product_id}>
              <td data-label="Product"><div className="cell-primary">{i.product}</div><div className="cell-sub mono">{i.sku}</div></td>
              <td className="num" data-label="Expected">{i.expected}</td>
              {mode ? <>
                <td data-label="Received"><input className="mini-input" type="number" min="0" step="1" required value={lines[i.product_id].received_qty} onChange={(e) => set(i.product_id, 'received_qty', e.target.value)} />{Number(lines[i.product_id].received_qty) !== i.expected && <div className="cell-sub neg">{signed(Number(lines[i.product_id].received_qty) - i.expected)} vs expected</div>}</td>
                <td data-label="Expiry">{i.perishable ? <input className="field-input" type="date" min={todayStr()} value={lines[i.product_id].expiry} onChange={(e) => set(i.product_id, 'expiry', e.target.value)} /> : <span className="muted">n/a</span>}{i.perishable && !lines[i.product_id].expiry && <div className="cell-sub">Default: +{i.shelf_life_days} days</div>}</td>
                <td data-label="Bin"><input className="mini-input" value={lines[i.product_id].bin} onChange={(e) => set(i.product_id, 'bin', e.target.value)} maxLength={20} /></td>
              </> : <>
                <td className="num" data-label="Received">{s.received_date ? i.received : '-'}</td>
                <td className="num" data-label="Diff">{s.received_date ? <b className={i.received - i.expected ? 'neg' : ''}>{signed(i.received - i.expected)}</b> : '-'}</td>
              </>}
            </tr>))}</tbody></table></div>
        {mode && <div style={{ marginTop: 14 }}><Field label="Note (optional)"><input className="field-input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. 2 units arrived damaged" /></Field></div>}
        {err && <p className="field-error" role="alert">{err}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
          {open && canReceive && !mode && <button type="button" className="btn btn-primary" onClick={() => setMode(true)}><Icon name="inbound" size={16} />Receive shipment</button>}
          {mode && <button className="btn btn-primary" disabled={busy}><Icon name="check" size={16} />{busy ? 'Saving…' : 'Confirm receipt'}</button>}
        </div>
      </form>
    </Modal>
  );
}

function Outgoing() {
  const { can, user } = useAuth();
  const toast = useToast();
  const state = useApi('/outgoing', { refresh: 30000 });
  const [tab, setTab] = useState('active');
  const ship = async (o) => { try { await api.post(`/outgoing/${o.id}/ship`, {}); toast(`${o.code} shipped`); state.reload(); } catch (e) { toast(e.message, 'error'); } };
  const sales = user.role === 'sales';
  return (
    <Async state={state}>{(rows) => {
      const shown = rows.filter((o) => (tab === 'active' ? o.status !== 'shipped' : o.status === 'shipped'));
      return (<>
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'active', label: 'In progress', count: rows.filter((o) => o.status !== 'shipped').length }, { key: 'done', label: 'Shipped' }]} />
        <Card><Table rows={shown} empty="No shipments here." cols={[
          { label: 'Order', render: (o) => (can('sales.view') ? <Link className="breadcrumb-link mono cell-primary" to={`/sales/orders/${o.id}`}>{o.code}</Link> : <span className="mono cell-primary">{o.code}</span>) },
          { label: 'Customer', render: (o) => o.customer },
          ...(!sales ? [{ label: 'Items', render: (o) => o.items.map((i) => `${i.qty}× ${i.product}`).join(', ') }] : [{ label: 'Units', num: true, render: (o) => o.units }]),
          { label: 'Created', date: true, render: (o) => <Stamp v={o.created} /> },
          { label: 'Shipped', date: true, render: (o) => <Stamp v={o.shipped} /> },
          { label: 'Status', render: (o) => <Pill status={o.status} /> },
          ...(can('shipments.process') ? [{ label: '', render: (o) => (o.status === 'ready' ? <button className="mini-btn" onClick={() => ship(o)}><Icon name="send" size={14} />Confirm shipment</button> : o.status === 'pending' || o.status === 'picking' ? <Link to="/pick-orders" className="mini-btn-outline"><Icon name="pick" size={14} />Go pick</Link> : null) }] : []),
        ]} /></Card>
      </>);
    }}</Async>
  );
}
