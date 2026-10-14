import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Async, Card, Detail, Field, KpiGrid, KpiTile, Modal, PageHeader, Pill, SearchBox, Table, Tabs, Stamp } from '../components/UI';
import { fmtDate, fmtDateTime, signed } from '../lib/format';

export function BatchesPage() {
  const { user, can } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [move, setMove] = useState(null);
  const state = useApi('/batches');
  const warehouse = user.role === 'warehouse';
  return (
    <div>
      <PageHeader title="Batches" sub={warehouse ? 'Pick batch #1 first: FEFO for expiring items, FIFO (oldest received) for everything else.' : 'Every received lot with its quantity, dates and status.'} />
      <Async state={state}>{(rows) => {
        const shown = rows.filter((b) => (tab === 'all' || b.status.toLowerCase() === tab) && (!q || `${b.code} ${b.product} ${b.sku}`.toLowerCase().includes(q.toLowerCase())));
        const cols = [
          ...(warehouse ? [{ label: 'Pick', center: true, render: (b) => <b>{b.pick_order === 1 && b.status !== 'Expired' ? '1st' : b.pick_order}</b> }] : []),
          { label: 'Batch ID', render: (b) => <span className="mono cell-primary">{b.code}</span> },
          { label: 'Product', render: (b) => <><div className="cell-primary">{b.product}</div><div className="cell-sub mono">{b.sku}</div></> },
          { label: 'Qty', num: true, render: (b) => b.qty },
          { label: 'Received', date: true, render: (b) => fmtDate(b.received) },
          { label: 'Expiry', date: true, render: (b) => fmtDate(b.expiry) },
          ...(warehouse ? [{ label: 'Bin', render: (b) => <span className="mono">{b.bin || '-'}</span> }, { label: 'Method', render: (b) => b.method }] : []),
          { label: 'Status', render: (b) => <Pill status={b.status} /> },
          ...(can('movements.record') ? [{ label: '', render: (b) => <button className="mini-btn-outline" onClick={(e) => { e.stopPropagation(); setMove(b); }}>Move bin</button> }] : []),
        ];
        const n = (s) => rows.filter((b) => b.status.toLowerCase() === s).length;
        return (<>
          <KpiGrid>
            <KpiTile icon="layers" label="Total batches" value={rows.length} tone="info" />
            <KpiTile icon="ok" label="Good" value={n('good')} tone="ok" />
            <KpiTile icon="expiry" label="Expiring soon" value={n('expiring')} tone="warning" />
            <KpiTile icon="critical" label="Expired" value={n('expired')} tone={n('expired') ? 'critical' : 'ok'} />
          </KpiGrid>
          <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search batch or product…" />
            <Tabs value={tab} onChange={setTab} tabs={[{ key: 'all', label: 'All', count: rows.length }, { key: 'good', label: 'Good' }, { key: 'expiring', label: 'Expiring' }, { key: 'expired', label: 'Expired' }]} /></div>
          <Card><Table cols={cols} rows={shown} empty="No batches match." rowTone={(b) => (b.status === 'Expired' ? 'critical' : null)} onRow={(b) => nav(`/batches/${b.id}`)} /></Card>
        </>);
      }}</Async>
      {move && <MoveForm batch={move} onClose={() => setMove(null)} onDone={() => { setMove(null); state.reload(); }} />}
    </div>
  );
}

function MoveForm({ batch, onClose, onDone }) {
  const toast = useToast();
  const [to, setTo] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.post('/movements/transfer', { batch_id: batch.id, to_bin: to }); toast('Transfer recorded'); onDone(); } catch (e2) { setErr(e2.message); }
  };
  return (
    <Modal title={`Transfer ${batch.code}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted" style={{ marginTop: 0 }}>{batch.product}, currently in bin <b>{batch.bin || '-'}</b>.</p>
        <Field label="Destination bin"><input className="field-input" value={to} onChange={(e) => setTo(e.target.value)} required maxLength={20} autoFocus /></Field>
        {err && <p className="field-error">{err}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary">Record transfer</button></div>
      </form>
    </Modal>
  );
}

export function BatchDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const state = useApi(`/batches/${id}`);
  return (
    <Async state={state}>{(b) => (
      <div>
        <PageHeader crumbs={[{ label: 'Batches', href: '/batches' }, { label: b.code }]} title={`Batch ${b.code}`} sub={b.product} />
        <Card title="Batch details"><Detail items={[
          ['Batch ID', b.code], ['Product', can('inventory.view') ? <Link key="p" className="breadcrumb-link" to={`/inventory/${b.sku}`}>{b.product}</Link> : b.product],
          ['Quantity', b.qty], ['Date received', fmtDate(b.received)], ['Expiration date', b.expiry ? `${fmtDate(b.expiry)} (${b.days_left} days)` : 'No expiry'],
          ['Bin', b.bin], ['Status', <Pill key="s" status={b.status} />]]} /></Card>
        {can('movements.view') && <Card title="Movements for this batch"><Table rows={b.movements} empty="No movements recorded." cols={[
          { label: 'Time', date: true, render: (m) => <Stamp v={m.ts} /> }, { label: 'Type', render: (m) => m.type }, { label: 'Qty', num: true, render: (m) => signed(m.qty) }, { label: 'Reference', render: (m) => m.ref || '-' }, { label: 'By', render: (m) => m.user_name }]} /></Card>}
      </div>
    )}</Async>
  );
}
