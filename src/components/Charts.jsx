import { useId } from 'react';

const TONE = { ok: 'var(--success)', warning: 'var(--warning)', critical: 'var(--critical)', info: 'var(--info)', accent: 'var(--accent)', violet: '#7C3AED', slate: '#64748B' };
const SERIES = ['var(--accent)', 'var(--success)', 'var(--warning)', '#7C3AED', 'var(--info)', 'var(--critical)'];
const colorOf = (s, i) => TONE[s.tone] || s.color || SERIES[i % SERIES.length];
const nf = (n) => Number(n || 0).toLocaleString('en-US');

export function ChartCard({ title, sub, right, children }) {
  return (
    <div className="card chart-card">
      <div className="card-header"><div><h2 className="card-title">{title}</h2>{sub && <p className="card-sub">{sub}</p>}</div>{right}</div>
      <div className="chart-body">{children}</div>
    </div>
  );
}

/** Donut with a total in the middle and a legend (counts + percentages). */
export function Donut({ data, centerLabel = 'Total', size = 170 }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = 62, c = 2 * Math.PI * r;
  let off = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 160 160" width={size} height={size} role="img" aria-label={`${centerLabel}: ${total}`}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="var(--surface-alt)" strokeWidth="20" />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * c;
          const el = d.value > 0 && <circle key={i} className="donut-seg" cx="80" cy="80" r={r} fill="none" stroke={colorOf(d, i)} strokeWidth="20" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} transform="rotate(-90 80 80)" style={{ '--c': c, animationDelay: `${i * 140}ms` }}><title>{`${d.label}: ${d.value}`}</title></circle>;
          off += len;
          return el;
        })}
        <text x="80" y="78" textAnchor="middle" className="donut-total chart-fade">{nf(total)}</text>
        <text x="80" y="97" textAnchor="middle" className="donut-label chart-fade">{centerLabel}</text>
      </svg>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={d.label}><span className="legend-dot" style={{ background: colorOf(d, i) }} /><span className="legend-name">{d.label}</span><b>{nf(d.value)}</b><span className="legend-pct">{total ? Math.round((d.value / total) * 100) : 0}%</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal bars, sorted as given. */
export function HBars({ data, format = nf }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <div className="empty-state">No data yet.</div>;
  return (
    <ul className="hbars">
      {data.map((d, i) => (
        <li key={d.label}>
          <span className="hbar-label" title={d.label}>{d.label}</span>
          <span className="hbar-track"><span className="hbar-fill" style={{ width: `${(d.value / max) * 100}%`, background: TONE[d.tone] || d.color || 'var(--accent)', animationDelay: `${i * 70}ms` }} /></span>
          <b className="hbar-val">{format(d.value)}</b>
        </li>
      ))}
    </ul>
  );
}

// y-axis: 4 equal steps of 1/2/5 x 10^k so tick labels are whole numbers
const niceMax = (v) => { const raw = Math.max(1, v) / 4; const p = 10 ** Math.floor(Math.log10(raw)); const step = [1, 2, 5, 10].map((m) => m * p).find((x) => x >= raw); return Math.max(4, step * 4); };

/** Vertical columns. series = [{key,label,color}], data = [{label, [key]: n}] */
export function Columns({ data, series, height = 270 }) {
  const uid = useId();
  const W = 960, H = height, L = 38, B = 28, T = 10, R = 8;
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key] || 0))));
  const iw = W - L - R, ih = H - T - B, band = iw / Math.max(1, data.length);
  const bw = Math.min(30, (band - 10) / series.length);
  const y = (v) => T + ih - (v / max) * ih;
  const every = data.length > 10 ? 2 : 1;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="columns" role="img" aria-label="Column chart">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}><line x1={L} x2={W - R} y1={y(max * t)} y2={y(max * t)} className="grid-line" /><text x={L - 6} y={y(max * t) + 4} textAnchor="end" className="axis-text">{nf(Math.round(max * t))}</text></g>
        ))}
        {data.map((d, i) => {
          const cx = L + band * i + band / 2;
          return (
            <g key={uid + i}>
              {series.map((s, k) => {
                const v = d[s.key] || 0, x = cx - (bw * series.length) / 2 + k * bw;
                return <rect key={s.key} className="col-bar" x={x + 1} y={y(v)} width={bw - 2} height={Math.max(v ? 2 : 0, T + ih - y(v))} rx="3" fill={s.color} style={{ animationDelay: `${i * 45 + k * 25}ms` }}><title>{`${d.label} · ${s.label}: ${nf(v)}`}</title></rect>;
              })}
              {i % every === 0 && <text x={cx} y={H - 8} textAnchor="middle" className="axis-text">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && <ul className="legend legend-inline">{series.map((s) => <li key={s.key}><span className="legend-dot" style={{ background: s.color }} />{s.label}</li>)}</ul>}
    </div>
  );
}
