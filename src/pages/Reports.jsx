import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../lib/hooks';
import { Async, Card, KpiGrid, KpiTile, PageHeader, Pill, Table, Tabs } from '../components/UI';
import Icon from '../components/Icon';
import { fmtDate, fmtDateTime, fmtMoney } from '../lib/format';

// Columns that read best centered. Everything else is left aligned (text) or right aligned (numbers).
const CENTER = /^(rank|abc class|stored class|review cycle|last counted|check|status|type|expiry|expected|received on|created|time|days left)$/i;
const isNumeric = (v) => typeof v === 'number' || (typeof v === 'string' && /^-?[\d.,]+%$/.test(v));

export default function ReportsPage({ abc = false }) {
  const params = useParams();
  const group = abc ? 'inventory' : params.group;
  const { can } = useAuth();
  const list = useApi('/reports');
  const allowed = (list.data || []).filter((r) => r.group === group && can(r.perm));
  const [key, setKey] = useState(abc ? 'abc' : null);
  const active = allowed.find((r) => r.key === key) || allowed[0];
  const rep = useApi(active ? `/reports/${group}/${active.key}` : null);
  const title = abc && active ? active.title : group === 'inventory' ? 'Inventory Reports' : 'Purchasing Reports';
  const isAbc = active?.key === 'abc';
  return (
    <div>
      <PageHeader title={title} sub={isAbc ? 'Products ranked by yearly usage value, which combines unit cost with how fast each item moves.' : 'Generated live from current data.'} action={active && <a className="btn btn-secondary" href={`/api/reports/${group}/${active.key}?format=csv`}><Icon name="inbound" size={16} />Export CSV</a>} />
      <Async state={list}>{() => allowed.length === 0 ? <Card><div className="empty-state">You do not have access to these reports.</div></Card> : (<>
        <Tabs value={active.key} onChange={setKey} tabs={allowed.map((r) => ({ key: r.key, label: r.title }))} />
        {rep.loading && !rep.data ? <div className="empty-state">Generating…</div> : rep.data && rep.data.title === active.title ? (<>
          {isAbc ? <AbcOverview rep={rep.data} /> : (
            <KpiGrid>{Object.entries(rep.data.totals || {}).map(([k, v]) => <KpiTile key={k} label={k} value={typeof v === 'number' ? (/value/i.test(k) ? fmtMoney(v) : v.toLocaleString()) : v} tone="info" />)}</KpiGrid>
          )}
          <Card title={rep.data.title} right={<span className="muted" style={{ fontSize: 12 }}>Generated {fmtDateTime(rep.data.generated)}</span>}>
            <ReportTable rep={rep.data} />
          </Card></>) : null}
      </>)}</Async>
    </div>
  );
}

function ReportTable({ rep }) {
  const cols = rep.columns.map((c, ci) => {
    const sample = rep.rows.map((r) => r[ci]).find((v) => v !== null && v !== undefined && v !== '' && v !== '-');
    const center = CENTER.test(c);
    return {
      label: c,
      center,
      num: !center && isNumeric(sample),
      render: (x) => {
        const v = x.r[ci];
        if (v === null || v === undefined || v === '') return '-';
        if (/class$/i.test(c) && ['A', 'B', 'C'].includes(v)) return <span className={`abc-chip abc-${v}`}>{v}</span>;
        if (c === 'Status') return <Pill status={v} />;
        if (c === 'SKU') return <span className="cell-sku">{v}</span>;
        if (c === 'Product') return <span className="cell-primary">{v}</span>;
        if (c === 'Check') return <Pill status={v === 'OK' ? 'ok' : 'watch'} label={v === 'OK' ? 'Matches' : 'Review class'} />;
        if (c === 'Turns per year') return `${v}x`;
        if (c === 'Last counted') return /^\d{4}-\d{2}-\d{2}/.test(v) ? fmtDate(v) : v;
        if (typeof v === 'number' && /value|cost/i.test(c)) return fmtMoney(v);
        return v;
      },
    };
  });
  // Only rows with a red status (out, critical, expired...) are highlighted. Yellow ones like Low are not.
  const si = rep.columns.indexOf('Status');
  const WARN = ['out', 'critical', 'expired', 'open', 'variance', 'delayed'];
  const rowTone = (x) => (si >= 0 && WARN.includes(String(x.r[si]).toLowerCase()) ? 'critical' : null);
  return <Table rowKey={(r) => r.__i} rows={rep.rows.map((r, i) => ({ __i: i, r }))} empty="No data for this report." cols={cols} rowTone={rowTone} />;
}

const CLASS_INFO = {
  A: { name: 'Class A', rule: 'High value, fast moving. Monitored closely and counted often.' },
  B: { name: 'Class B', rule: 'Moderate value and movement. Follows the standard review schedule.' },
  C: { name: 'Class C', rule: 'Low value, slow moving. Reviewed less frequently.' },
};

function AbcOverview({ rep }) {
  const col = (n) => rep.columns.indexOf(n);
  const ci = col('ABC class'), vi = col('Yearly usage value'), cati = col('Category'), cyc = col('Review cycle');
  const by = { A: { value: 0, items: 0, cats: new Set(), cycle: '' }, B: { value: 0, items: 0, cats: new Set(), cycle: '' }, C: { value: 0, items: 0, cats: new Set(), cycle: '' } };
  rep.rows.forEach((r) => { const g = by[r[ci]]; g.value += Number(r[vi]) || 0; g.items += 1; g.cats.add(r[cati]); g.cycle = r[cyc]; });
  const total = by.A.value + by.B.value + by.C.value || 1;
  const pct = (k) => ((by[k].value / total) * 100).toFixed(1);
  return (
    <Card title="Share of yearly usage value" right={<span className="muted" style={{ fontSize: 12 }}>Total {fmtMoney(total)}</span>}>
      <div className="abc-note">
        <div className="abc-bar" role="img" aria-label={`Class A ${pct('A')}%, class B ${pct('B')}%, class C ${pct('C')}%`}>
          {['A', 'B', 'C'].map((k, i) => <span key={k} className={`abc-${k}`} style={{ width: `${pct(k)}%`, animationDelay: `${i * 160}ms` }} />)}
        </div>
        <div className="abc-classes">
          {['A', 'B', 'C'].map((k) => (
            <div key={k} className="abc-class">
              <div className="abc-class-head"><span className={`abc-chip abc-${k}`}>{k}</span><div><b>{CLASS_INFO[k].name}</b><span>{by[k].items} {by[k].items === 1 ? 'item' : 'items'} · {pct(k)}% of value</span></div></div>
              <p className="abc-class-rule">{CLASS_INFO[k].rule}</p>
              <dl className="abc-class-meta">
                <div><dt>Review cycle</dt><dd>{by[k].cycle || '-'}</dd></div>
                <div><dt>Categories</dt><dd>{[...by[k].cats].join(', ') || '-'}</dd></div>
              </dl>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
