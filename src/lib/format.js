export const fmtMoney = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');

// Dates arrive as 'YYYY-MM-DD' (calendar dates), 'YYYY-MM-DD HH:MM:SS' (server local time, Asia/Manila)
// or ISO strings ending in Z (UTC). All are shown in Manila time with one consistent format: "Oct 10, 2026" / "6:47 PM".
const TZ = 'Asia/Manila';
function parse(s) {
  if (!s) return null;
  const str = String(s);
  const d = new Date(str.length <= 10 ? `${str}T12:00:00` : str.includes('T') ? str : str.replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? null : { d, utc: /Z$|[+-]\d\d:?\d\d$/.test(str), dateOnly: str.length <= 10 };
}
export function fmtDate(s) {
  const p = parse(s); if (!p) return s || '-';
  return p.d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', ...(p.utc ? { timeZone: TZ } : {}) });
}
export function fmtTime(s) {
  const p = parse(s); if (!p || p.dateOnly) return '';
  return p.d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...(p.utc ? { timeZone: TZ } : {}) });
}
export function fmtDateTime(s) {
  const p = parse(s); if (!p) return s || '-';
  return `${fmtDate(s)}, ${fmtTime(s)}`.replace(/, $/, '');
}
export const signed = (n) => (n > 0 ? `+${n}` : String(n));
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
