import { useState } from 'react';
import { useApi } from '../lib/hooks';
import { Async, Card, PageHeader, Table, Tabs, Stamp } from '../components/UI';
import { fmtDateTime, signed } from '../lib/format';

const TYPES = ['Received', 'Picked', 'Shipped', 'Counted', 'Transferred', 'Adjusted'];
export default function MovementsPage() {
  const [type, setType] = useState('');
  const state = useApi(`/movements${type ? `?type=${type}` : ''}`);
  return (
    <div>
      <PageHeader title="Stock Movements" sub="Every stock event: received, picked, shipped, counted, transferred and adjusted. Adjustments are only made by the Inventory Manager (or approved by them)." />
      <Tabs value={type} onChange={setType} tabs={[{ key: '', label: 'All' }, ...TYPES.map((t) => ({ key: t, label: t }))]} />
      <Card><Async state={state}>{(rows) => <Table rows={rows} empty="No movements of this type." cols={[
        { label: 'Time', date: true, render: (m) => <Stamp v={m.ts} /> }, { label: 'Type', render: (m) => <span className="type-tag">{m.type}</span> },
        { label: 'Product', render: (m) => <><div className="cell-primary">{m.product}</div><div className="cell-sub mono">{m.sku}</div></> },
        { label: 'Qty', num: true, render: (m) => (m.type === 'Counted' ? m.qty : <span className={m.qty < 0 ? 'neg' : m.qty > 0 ? 'pos' : ''}>{signed(m.qty)}</span>) },
        { label: 'Batch', center: true, render: (m) => m.batch_code || '-' }, { label: 'Reference', center: true, render: (m) => <>{m.ref || '-'}{m.note && <div className="cell-sub">{m.note}</div>}</> }, { label: 'By', center: true, render: (m) => m.user_name }]} />}</Async></Card>
    </div>
  );
}
