import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useApi, useDebounced } from '../lib/hooks';
import { useToast } from '../components/Toast';
import { Async, Card, CardLink, Field, Modal, PageHeader, Pill, SearchBox, Table, Tabs, Stamp, ActivityList, prettyAction as pretty } from '../components/UI';
import Icon from '../components/Icon';
import Avatar from '../components/Avatar';
import { ROLE_LABEL } from '../nav';

const SHORT = { admin: 'Admin', inventory: 'Inventory Mgr', purchasing: 'Purchasing', warehouse: 'Warehouse', sales: 'Sales' };
const ROLE_KEYS = Object.keys(ROLE_LABEL);
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export function UsersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const state = useApi('/admin/users');
  const [form, setForm] = useState(null);
  const [reset, setReset] = useState(null);
  const [tab, setTab] = useState('all');
  const patch = async (u, body, msg) => { try { await api.patch(`/admin/users/${u.id}`, body); toast(msg); state.reload(); } catch (e) { toast(e.message, 'error'); } };
  return (
    <div>
      <PageHeader title="Users" sub="Create accounts, assign roles, approve requests and disable access." action={<button className="btn btn-primary" onClick={() => setForm({})}><Icon name="adduser" size={17} />Add user</button>} />
      <Async state={state}>{(rows) => {
        const shown = rows.filter((u) => tab === 'all' || u.status === tab);
        return (<>
          <Tabs value={tab} onChange={setTab} tabs={[{ key: 'all', label: 'All', count: rows.length }, { key: 'active', label: 'Active' }, { key: 'pending', label: 'Pending', count: rows.filter((u) => u.status === 'pending').length }, { key: 'disabled', label: 'Disabled' }]} />
          <Card><Table rows={shown} empty="No users." cols={[
            { label: 'User', render: (u) => <span className="user-cell"><Avatar name={u.name} role={u.role} photo={u.photo} /><span><div className="cell-primary">{u.name}{u.id === user.id && ' (you)'}</div><div className="cell-sub">{u.email}</div></span></span> },
            { label: 'Role', render: (u) => <select className="field-select" style={{ minWidth: 170 }} value={u.role} disabled={u.id === user.id} onChange={(e) => patch(u, { role: e.target.value }, 'Role updated')} aria-label={`Role for ${u.name}`}>{ROLE_KEYS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select> },
            { label: 'Status', render: (u) => <Pill status={u.status} /> }, { label: 'Last sign-in', date: true, render: (u) => <Stamp v={u.last_login} /> },
            { label: '', render: (u) => (
              <div className="alert-actions">
                {u.status === 'pending' && <button className="mini-btn" onClick={() => patch(u, { status: 'active' }, 'Account approved')}><Icon name="check" size={14} />Approve</button>}
                {u.status === 'active' && u.id !== user.id && <button className="mini-btn-outline" onClick={() => patch(u, { status: 'disabled' }, 'Account disabled')}><Icon name="ban" size={14} />Disable</button>}
                {u.status === 'disabled' && <button className="mini-btn-outline" onClick={() => patch(u, { status: 'active' }, 'Account enabled')}><Icon name="check" size={14} />Enable</button>}
                <button className="mini-btn-outline" onClick={() => setReset(u)}><Icon name="key" size={14} />Reset password</button>
              </div>) },
          ]} /></Card></>);
      }}</Async>
      {form && <UserForm onClose={() => setForm(null)} onDone={() => { setForm(null); state.reload(); }} />}
      {reset && <ResetForm u={reset} onClose={() => setReset(null)} />}
    </div>
  );
}
function UserForm({ onClose, onDone }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', email: '', role: 'warehouse', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const go = async (e) => { e.preventDefault(); try { await api.post('/admin/users', f); toast('User created'); onDone(); } catch (x) { setErr(x.message); } };
  return (
    <Modal title="Add user" icon="adduser" onClose={onClose}><form onSubmit={go}><div className="form-grid">
      <Field label="Full name"><input className="field-input" value={f.name} onChange={set('name')} required /></Field><Field label="Email"><input className="field-input" type="email" value={f.email} onChange={set('email')} required /></Field>
      <Field label="Role"><select className="field-select" value={f.role} onChange={set('role')}>{ROLE_KEYS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
      <Field label="Temporary password" hint="At least 8 characters."><input className="field-input" type="text" value={f.password} onChange={set('password')} required minLength={8} /></Field></div>
      {err && <p className="field-error" role="alert">{err}</p>}<div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary"><Icon name="adduser" size={16} />Create user</button></div></form></Modal>
  );
}
function ResetForm({ u, onClose }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const go = async (e) => { e.preventDefault(); try { await api.post(`/admin/users/${u.id}/reset-password`, { password: pw }); toast('Password reset'); onClose(); } catch (x) { setErr(x.message); } };
  return (
    <Modal title={`Reset password: ${u.name}`} icon="key" onClose={onClose}><form onSubmit={go}><Field label="New password" hint="Signs the user out everywhere."><input className="field-input" type="text" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} /></Field>
      {err && <p className="field-error">{err}</p>}<div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary"><Icon name="key" size={16} />Reset password</button></div></form></Modal>
  );
}

export function RolesPage() {
  const toast = useToast();
  const state = useApi('/admin/roles');
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(null);
  const toggle = (role, perm, cur) => setDraft((d) => { const s = new Set(d[role] || cur); if (s.has(perm)) s.delete(perm); else s.add(perm); return { ...d, [role]: [...s] }; });
  const save = async (r) => { setBusy(r.key); try { await api.put(`/admin/roles/${r.key}/permissions`, { permissions: draft[r.key] }); toast(`${ROLE_LABEL[r.key]} permissions saved`); setDraft((d) => { const n = { ...d }; delete n[r.key]; return n; }); state.reload(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(null); } };
  return (
    <div>
      <PageHeader title="Roles & Permissions" sub="The access matrix. Changes apply to everyone in that role immediately. Core administrator permissions are locked." />
      <Async state={state}>{({ roles, permissions }) => {
        const groups = [...new Set(permissions.map((p) => p.group))];
        return (<>
          <div style={{ marginBottom: 20 }}><Card title="Roles"><div className="role-list">{roles.map((r) => (
            <div key={r.key} className="role-row">
              <span className={`avatar avatar-tone-${r.key}`}>{initials(r.label)}</span>
              <div className="role-row-text"><b>{r.label}</b><span>{r.motto}</span></div>
              <span className="role-count">{r.users} user{r.users === 1 ? '' : 's'}</span>
            </div>))}</div></Card></div>
          <Card><div className="table-scroll-wrap"><table className="perm-grid"><thead><tr><th>Permission</th>{roles.map((r) => <th key={r.key} title={r.label}>{SHORT[r.key]}</th>)}</tr></thead><tbody>
            {groups.map((g) => [<tr key={g} className="perm-group"><td colSpan={roles.length + 1}>{g}</td></tr>,
              ...permissions.filter((p) => p.group === g).map((p) => (
                <tr key={p.key}><td>{p.label}</td>{roles.map((r) => { const cur = draft[r.key] || r.permissions; const locked = r.locked.includes(p.key); return <td key={r.key}><input type="checkbox" checked={cur.includes(p.key)} disabled={locked} onChange={() => toggle(r.key, p.key, r.permissions)} aria-label={`${p.label} for ${r.label}`} /></td>; })}</tr>))])}
            <tr><td /> {roles.map((r) => <td key={r.key}>{draft[r.key] && <button className="mini-btn" disabled={busy === r.key} onClick={() => save(r)}>Save</button>}</td>)}</tr>
          </tbody></table></div></Card></>);
      }}</Async>
    </div>
  );
}

export function LogsPage() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const state = useApi(`/admin/logs?q=${encodeURIComponent(dq)}`, { refresh: 30000 });
  return (
    <div><PageHeader title="Activity Logs" sub="Sign-ins, user changes, stock and order actions." />
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search action, user or detail…" /></div>
      <Card><Async state={state}>{(rows) => <Table rows={rows} empty="No matching activity." cols={[{ label: 'Time', date: true, render: (l) => <Stamp v={l.ts} /> }, { label: 'User', render: (l) => <>{l.user_name}{l.role && <div className="cell-sub">{ROLE_LABEL[l.role]}</div>}</> }, { label: 'Action', center: false, render: (l) => <b>{pretty(l.action)}</b> }, { label: 'Detail', wrap: true, render: (l) => l.detail }]} />}</Async></Card></div>
  );
}

function Section({ icon, tone = '', title, sub, children }) {
  return (
    <div className="card settings-card">
      <div className="settings-head"><span className={`settings-ico ${tone}`}><Icon name={icon} size={20} /></span><div><h2 className="card-title">{title}</h2>{sub && <p className="card-sub">{sub}</p>}</div></div>
      <div className="settings-body">{children}</div>
    </div>
  );
}
function Row({ icon, label, hint, children }) {
  return (
    <div className="setting-row">
      <div className="setting-text"><div className="setting-label">{icon && <Icon name={icon} size={17} />}{label}</div>{hint && <p className="setting-hint">{hint}</p>}</div>
      <div className="setting-control">{children}</div>
    </div>
  );
}
const Unit = ({ unit, ...p }) => <label className="input-unit"><input type="number" {...p} /><span>{unit}</span></label>;
const Switch = ({ on, onChange, label }) => <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)} />;

export function SettingsPage() {
  const toast = useToast();
  const state = useApi('/admin/settings');
  const health = useApi('/auth/health', { refresh: 30000 });
  const recent = useApi('/admin/logs?limit=5', { refresh: 30000 });
  const [f, setF] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const data = f || state.data;
  const set = (k) => (e) => setF({ ...data, [k]: e.target.value });
  const save = async (e) => { e.preventDefault(); setErr(''); setBusy(true); try { await api.put('/admin/settings', f || data); setF(null); state.reload(); toast('Settings saved'); } catch (x) { setErr(x.message); } finally { setBusy(false); } };
  const up = (h) => h.data?.ok;
  return (
    <div><PageHeader title="System Settings" sub="Company details, inventory rules, security and system health." />
      <Async state={state}>{() => (
        <form onSubmit={save}>
          <Card title="Recent activity" right={<CardLink to="/logs">View all logs</CardLink>}>
            <Async state={recent}>{(rows) => <ActivityList rows={rows.slice(0, 5)} />}</Async>
          </Card>

          <div className="settings-grid">
            <Section icon="globe" title="General" sub="How the company appears in the system.">
              <Row icon="warehouse" label="Company name" hint="Shown on reports and the sign-in page."><input className="field-input input-text" value={data.company_name} onChange={set('company_name')} required maxLength={80} /></Row>
            </Section>

            <Section icon="boxes" tone="settings-ico-warn" title="Inventory" sub="When stock is flagged for attention.">
              <Row icon="expiry" label="Expiry warning window" hint="Batches expiring inside this window raise an alert."><Unit unit="days" min="1" value={data.expiry_warning_days} onChange={set('expiry_warning_days')} /></Row>
              <Row icon="layers" label="Filter shelf life" hint="Default shelf life for new filter batches."><Unit unit="months" min="1" value={data.filter_shelf_life_months} onChange={set('filter_shelf_life_months')} /></Row>
            </Section>

            <Section icon="lock" tone="settings-ico-ok" title="Security" sub="Sign-in rules and session control.">
              <Row icon="clock" label="Session length" hint="Users are signed out after this long."><Unit unit="hours" min="1" value={data.session_hours} onChange={set('session_hours')} /></Row>
              <Row icon="alert" label="Max failed sign-ins" hint="Account locks after this many wrong passwords."><Unit unit="attempts" min="3" value={data.max_login_attempts} onChange={set('max_login_attempts')} /></Row>
              <Row icon="ban" label="Lockout time" hint="How long a locked account must wait."><Unit unit="minutes" min="1" value={data.lockout_minutes} onChange={set('lockout_minutes')} /></Row>
              <Row icon="adduser" label="Self-registration" hint="People can request an account; an admin must approve it."><Switch label="Allow self-registration" on={data.allow_self_registration === 'true'} onChange={(v) => setF({ ...data, allow_self_registration: v ? 'true' : 'false' })} /></Row>
            </Section>

            <Section icon="server" tone="settings-ico-info" title="System information" sub="Live status of the app.">
              <div className="info-row"><span className="info-key"><Icon name="info" size={17} />Version</span><span className="info-val">1.0.0</span></div>
              <div className="info-row"><span className="info-key"><Icon name="db" size={17} />Database</span>{health.data ? <Pill status={up(health) ? 'connected' : 'critical'} label={up(health) ? 'Connected' : 'Offline'} /> : <span className="muted">Checking…</span>}</div>
              <div className="info-row"><span className="info-key"><Icon name="server" size={17} />Server</span>{health.data ? <Pill status={up(health) ? 'online' : 'critical'} label={up(health) ? 'Online' : 'Offline'} /> : <span className="muted">Checking…</span>}</div>
              <div className="info-row"><span className="info-key"><Icon name="globe" size={17} />Time zone</span><span className="info-val">Asia/Manila (PHT)</span></div>
              <div className="info-row"><span className="info-key"><Icon name="calendar" size={17} />Date format</span><span className="info-val">Oct 10, 2026</span></div>
            </Section>
          </div>

          {err && <p className="field-error" role="alert">{err}</p>}
          <div className="settings-actions">
            {f && <span className="dirty"><Icon name="alert" size={16} />You have unsaved changes</span>}
            <button type="button" className="btn btn-secondary" disabled={!f} onClick={() => { setF(null); setErr(''); }}><Icon name="undo" size={16} />Cancel</button>
            <button className="btn btn-primary" disabled={!f || busy}><Icon name="save" size={16} />{busy ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>)}</Async></div>
  );
}
