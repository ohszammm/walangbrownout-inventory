import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Async, Card, Empty, Field, Modal, PageHeader, Pill, AlertRow, Tabs } from '../components/UI';

const GROUPS = { 'low-stock': ['low_stock', 'Low Stock Alerts', 'Products at or below their calculated reorder point.'], expiry: ['expiry', 'Expiry Alerts', 'Batches close to expiry or already expired. Follow FEFO: pick the earliest expiry first.'] };
const TYPE_LABEL = { low_stock: 'Low stock', overstock: 'Overstock', expiry: 'Expiring', expired: 'Expired', discrepancy: 'Discrepancy', variance: 'Receiving variance', delayed: 'Delayed shipment' };

export default function AlertsPage() {
  const { group } = useParams();
  const { can, user } = useAuth();
  const toast = useToast();
  const meta = GROUPS[group];
  const state = useApi(`/alerts${meta ? `?group=${meta[0]}` : ''}`, { refresh: 30000 });
  const [type, setType] = useState('all');
  const [res, setRes] = useState(null);
  const setState = async (a, s) => { try { await api.post('/alerts/state', { key: a.key, state: s }); toast(s === 'investigating' ? 'Marked under investigation' : s === 'acknowledged' ? 'Acknowledged' : 'Updated'); state.reload(); } catch (e) { toast(e.message, 'error'); } };
  const manage = can('alerts.manage');
  const link = (a) => (a.type === 'expiry' || a.type === 'expired' ? '/batches' : a.sku && user.role !== 'sales' ? `/inventory/${a.sku}` : null);
  return (
    <div>
      <PageHeader title={meta ? meta[1] : 'Alerts'} sub={meta ? meta[2] : 'Low stock, expiry, discrepancy and receiving alerts across the warehouse.'} />
      <Async state={state}>{(list) => {
        const types = [...new Set(list.map((a) => a.type))];
        const shown = type === 'all' ? list : list.filter((a) => a.type === type);
        return (<>
          {!meta && types.length > 1 && <Tabs value={type} onChange={setType} tabs={[{ key: 'all', label: 'All', count: list.length }, ...types.map((t) => ({ key: t, label: TYPE_LABEL[t] || t, count: list.filter((a) => a.type === t).length }))]} />}
          <Card>{shown.length === 0 ? <Empty>No open alerts. Stock is within policy.</Empty> : shown.map((a) => (
            <AlertRow key={a.key} a={a}>
              {a.state !== 'open' && <Pill status={a.state} label={a.state === 'investigating' ? 'Under investigation' : a.state} />}
              {link(a) && <Link to={link(a)} className="mini-btn-outline">View</Link>}
              {a.type === 'discrepancy' && can('count.view') && <Link to="/discrepancies" className="mini-btn-outline">Discrepancy</Link>}
              {a.type === 'low_stock' && can('po.create') && <Link to="/reorder" className="mini-btn">Reorder</Link>}
              {manage && a.state === 'open' && ['discrepancy', 'variance', 'expired', 'expiry'].includes(a.type) && <button className="mini-btn-outline" onClick={() => setState(a, 'investigating')}>Investigate</button>}
              {manage && a.state === 'open' && <button className="mini-btn-outline" onClick={() => setState(a, 'acknowledged')}>Acknowledge</button>}
              {manage && ['variance', 'expired', 'expiry', 'overstock'].includes(a.type) && <button className="mini-btn" onClick={() => setRes(a)}>Mark resolved</button>}
            </AlertRow>))}</Card>
        </>);
      }}</Async>
      {res && <ResolveAlert a={res} onClose={() => setRes(null)} onDone={() => { setRes(null); state.reload(); }} />}
    </div>
  );
}
function ResolveAlert({ a, onClose, onDone }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const go = async (e) => { e.preventDefault(); try { await api.post('/alerts/state', { key: a.key, state: 'resolved', note }); toast('Alert resolved'); onDone(); } catch (e2) { setErr(e2.message); } };
  return (
    <Modal title="Mark alert resolved" onClose={onClose}>
      <form onSubmit={go}><p style={{ marginTop: 0 }}>{a.title}</p><Field label="Resolution note"><input className="field-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What was done?" maxLength={300} required /></Field>
        {err && <p className="field-error">{err}</p>}<div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary">Resolve</button></div></form>
    </Modal>
  );
}
