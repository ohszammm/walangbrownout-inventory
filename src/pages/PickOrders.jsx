import { Fragment } from 'react';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Async, Card, Empty, PageHeader, Pill } from '../components/UI';
import { fmtDateTime, fmtDate } from '../lib/format';

export default function PickOrdersPage() {
  const toast = useToast();
  const state = useApi('/pick-orders', { refresh: 20000 });
  const act = async (o, a) => { try { await api.post(`/pick-orders/${o.id}/${a}`, {}); toast(a === 'start' ? `Picking ${o.code}` : `${o.code} picked and packed, ready to ship`); state.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <div>
      <PageHeader title="Pick Orders" sub="Each line shows which batch to take from. Expiring stock goes first (FEFO); non-expiring stock goes oldest first (FIFO). Expired stock is never offered." />
      <Async state={state}>{(rows) => rows.length === 0 ? <Card><Empty>No orders waiting to be picked.</Empty></Card> : rows.map((o) => (
        <Card key={o.id} icon="pick" title={<span className="pick-title"><span>{o.code} · {o.customer}</span><small>Ordered {fmtDateTime(o.created)}</small></span>} right={<span className="alert-actions"><Pill status={o.status} />{o.status === 'pending' && <button className="btn btn-primary btn-sm" onClick={() => act(o, 'start')}>Start picking</button>}{o.status === 'picking' && <button className="btn btn-primary btn-sm" disabled={o.items.some((i) => i.short > 0)} onClick={() => act(o, 'complete')}>Confirm picked &amp; packed</button>}</span>}>
          <div className="table-scroll-wrap"><table className="data-table pick-table"><colgroup><col style={{ width: '28%' }} /><col style={{ width: '10%' }} /><col style={{ width: '16%' }} /><col style={{ width: '12%' }} /><col style={{ width: '13%' }} /><col /></colgroup>
            <thead><tr><th>Product</th><th className="center">Pick qty</th><th className="center">Batch</th><th className="center">Bin</th><th className="center">Method</th><th className="center">Expiry date</th></tr></thead>
            <tbody>
              {o.items.map((i) => (
                <Fragment key={i.id}>
                  <tr>
                    <td data-label="Product"><div className="cell-primary">{i.product}</div><div className="cell-sub mono">{i.sku} · ordered {i.qty}</div></td>
                    <td className="center" data-label="Pick qty">{i.plan.map((p) => <div key={p.batch_id} className="pick-line">{p.qty}</div>)}</td>
                    <td className="center" data-label="Batch">{i.plan.map((p) => <div key={p.batch_id} className="pick-line pick-batch">{p.batch}</div>)}</td>
                    <td className="center" data-label="Bin">{i.plan.map((p) => <div key={p.batch_id} className="pick-line pick-batch">{p.bin || '-'}</div>)}</td>
                    <td className="center" data-label="Method">{i.plan.map((p) => <div key={p.batch_id} className="pick-line"><span className="type-tag">{p.method}</span></div>)}</td>
                    <td className="center" data-label="Expiry date">{i.plan.map((p) => <div key={p.batch_id} className="pick-line">{p.expiry ? fmtDate(p.expiry) : '-'}</div>)}</td>
                  </tr>
                  {i.short > 0 && <tr><td colSpan={6}><div className="field-error">Short by {i.short}: not enough in-date stock. Tell the Inventory Manager.</div></td></tr>}
                </Fragment>))}
            </tbody></table></div>
        </Card>
      ))}</Async>
    </div>
  );
}
