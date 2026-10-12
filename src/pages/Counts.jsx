import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Async, Card, Field, Modal, PageHeader, Pill, PriorityPill, Table, Tabs } from '../components/UI';
import { fmtDateTime, signed } from '../lib/format';

const prio = (c) => (Math.abs(c.diff) >= 10 || Math.abs(c.diff) / Math.max(1, c.system_qty) >= 0.2 ? 'CRITICAL' : 'HIGH');
const statusLabel = (s) => ({ open: 'Open', investigating: 'Under investigation', resolved: 'Resolved' }[s] || s);

export function StockCountPage() {
  const { can } = useAuth();
  const toast = useToast();
  const counts = useApi('/counts');
  const sheet = useApi(can('count.perform') ? '/counts/worksheet' : null);
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(null);
  const submit = async (p) => {
    setBusy(p.id);
    try {
      const c = await api.post('/counts', { product_id: p.id, physical_qty: Number(vals[p.id]) });
      toast(c.diff === 0 ? `${p.sku}: count matches the system` : `${p.sku}: discrepancy of ${signed(c.diff)} reported to the Inventory Manager`, c.diff === 0 ? 'success' : 'error');
      setVals((v) => ({ ...v, [p.id]: '' })); counts.reload(); sheet.reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(null); }
  };
  const histCols = [
    { label: 'Count', render: (c) => <span className="mono">{c.code}</span> },
    { label: 'Product', render: (c) => <><div className="cell-primary">{c.product}</div><div className="cell-sub mono">{c.sku}</div></> },
    { label: 'System qty', num: true, render: (c) => c.system_qty }, { label: 'Physical qty', num: true, render: (c) => c.physical_qty },
    { label: 'Difference', num: true, render: (c) => <b className={c.diff < 0 ? 'neg' : c.diff > 0 ? 'pos' : ''}>{signed(c.diff)}</b> },
    { label: 'Counted by', render: (c) => <>{c.counted_by}<div className="cell-sub">{fmtDateTime(c.ts)}</div></> },
    { label: 'Status', render: (c) => (c.diff === 0 ? <Pill status="resolved" label="Matched" /> : <Pill status={c.status} label={statusLabel(c.status)} />) },
  ];
  return (
    <div>
      <PageHeader title="Stock Count" sub={can('count.perform') ? 'Count what is physically on the shelf and enter it next to the system quantity.' : 'Supervise physical counts. Mismatches become discrepancies for investigation.'}
        action={can('count.supervise') && <Link to="/discrepancies" className="btn btn-secondary">Open discrepancies</Link>} />
      {can('count.perform') && (
        <Card title="Count worksheet: system vs physical">
          <Async state={sheet}>{(rows) => <Table rows={rows} cols={[
            { label: 'Product', render: (p) => <><div className="cell-primary">{p.name}</div><div className="cell-sub mono">{p.sku}</div></> },
            { label: 'Bin', render: (p) => <span className="mono">{p.bin || '-'}</span> },
            { label: 'System qty', num: true, render: (p) => p.system_qty },
            { label: 'Physical qty', render: (p) => <input className="mini-input" type="number" min="0" step="1" value={vals[p.id] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [p.id]: e.target.value }))} aria-label={`Physical quantity for ${p.sku}`} /> },
            { label: '', render: (p) => <button className="mini-btn" disabled={busy === p.id || vals[p.id] === undefined || vals[p.id] === ''} onClick={() => submit(p)}>Submit count</button> },
          ]} /> }</Async>
        </Card>
      )}
      <Card title="Count history"><Async state={counts}>{(rows) => <Table cols={histCols} rows={rows} empty="No counts recorded yet." rowTone={(c) => (c.diff !== 0 && c.status === 'open' ? 'critical' : null)} />}</Async></Card>
    </div>
  );
}

export function DiscrepanciesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const state = useApi('/counts');
  const [tab, setTab] = useState('unresolved');
  const [res, setRes] = useState(null);
  const investigate = async (c) => { try { await api.post(`/counts/${c.id}/investigate`, {}); toast('Marked as under investigation'); state.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <div>
      <PageHeader title="Stock Discrepancies" sub="Differences between the system quantity and the physical count. Availability is capped at the physical count until resolved." />
      <Async state={state}>{(all) => {
        const rows = all.filter((c) => c.diff !== 0);
        const shown = rows.filter((c) => (tab === 'unresolved' ? c.status !== 'resolved' : c.status === 'resolved'));
        return (<>
          <Tabs value={tab} onChange={setTab} tabs={[{ key: 'unresolved', label: 'Unresolved', count: rows.filter((c) => c.status !== 'resolved').length }, { key: 'resolved', label: 'Resolved' }]} />
          <Card><Table rows={shown} empty="No discrepancies here." rowTone={(c) => (c.status === 'open' ? 'critical' : null)} cols={[
            { label: 'Product', render: (c) => <><div className="cell-primary">{c.product}</div><div className="cell-sub mono">{c.sku} · {c.code}</div></> },
            { label: 'System', num: true, render: (c) => c.system_qty }, { label: 'Physical', num: true, render: (c) => c.physical_qty },
            { label: 'Difference', num: true, render: (c) => <b className={c.diff < 0 ? 'neg' : 'pos'}>{signed(c.diff)}</b> },
            { label: 'Priority', render: (c) => <PriorityPill p={prio(c)} /> },
            { label: 'Status', render: (c) => <Pill status={c.status} label={statusLabel(c.status)} /> },
            { label: 'Details', render: (c) => <><div className="cell-sub">{c.assigned_to ? `Assigned: ${c.assigned_to}` : `Counted by ${c.counted_by}`}</div>{c.resolution && <div className="cell-sub">{c.resolution}</div>}</> },
            ...(can('count.supervise') ? [{ label: '', render: (c) => c.status === 'resolved' ? null : <div className="alert-actions">{c.status === 'open' && <button className="mini-btn-outline" onClick={() => investigate(c)}>Investigate</button>}<button className="mini-btn" onClick={() => setRes(c)}>Resolve</button></div> }] : []),
          ]} /></Card>
        </>);
      }}</Async>
      {res && <ResolveForm c={res} onClose={() => setRes(null)} onDone={() => { setRes(null); state.reload(); }} />}
    </div>
  );
}

function ResolveForm({ c, onClose, onDone }) {
  const toast = useToast();
  const [action, setAction] = useState('adjust');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e) => { e.preventDefault(); setErr(''); try { await api.post(`/counts/${c.id}/resolve`, { action, note }); toast('Discrepancy resolved'); onDone(); } catch (e2) { setErr(e2.message); } };
  return (
    <Modal title={`Resolve ${c.code} (${c.sku})`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted" style={{ marginTop: 0 }}>System {c.system_qty} vs physical {c.physical_qty} ({signed(c.diff)}).</p>
        <Field label="Resolution"><select className="field-select" value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="adjust">Correct system stock to the physical count</option><option value="dismiss">Dismiss: count was wrong, no stock change</option></select></Field>
        <Field label="Note (required)"><input className="field-input" value={note} onChange={(e) => setNote(e.target.value)} required maxLength={300} placeholder="e.g. Confirmed shrinkage, supplier short-shipped…" /></Field>
        {err && <p className="field-error">{err}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary">Resolve</button></div>
      </form>
    </Modal>
  );
}

export function AdjustmentsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const state = useApi('/adjustments');
  const decide = async (a, ok) => { try { await api.post(`/adjustments/${a.id}/${ok ? 'approve' : 'reject'}`, {}); toast(ok ? 'Adjustment approved and applied' : 'Adjustment rejected'); state.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <div>
      <PageHeader title="Stock Adjustments" sub={can('adjust.approve') ? 'Approve or reject adjustment requests. New adjustments are made from a product page.' : 'Your adjustment requests.'} />
      <Card><Async state={state}>{(rows) => <Table rows={rows} empty="No adjustments yet." cols={[
        { label: 'Ref', render: (a) => <span className="mono">{a.code}</span> },
        { label: 'Product', render: (a) => <><div className="cell-primary">{a.product}</div><div className="cell-sub mono">{a.sku}</div></> },
        { label: 'Change', num: true, render: (a) => <b className={a.delta < 0 ? 'neg' : 'pos'}>{signed(a.delta)}</b> },
        { label: 'Reason', render: (a) => a.reason }, { label: 'Requested by', render: (a) => <>{a.requested_by}<div className="cell-sub">{fmtDateTime(a.ts)}</div></> },
        { label: 'Status', render: (a) => <><Pill status={a.status} />{a.decided_by && <div className="cell-sub">by {a.decided_by}</div>}</> },
        ...(can('adjust.approve') ? [{ label: '', render: (a) => a.status === 'pending' && <div className="alert-actions"><button className="mini-btn" onClick={() => decide(a, true)}>Approve</button><button className="mini-btn-outline" onClick={() => decide(a, false)}>Reject</button></div> }] : []),
      ]} />}</Async></Card>
    </div>
  );
}
