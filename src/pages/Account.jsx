import { useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { Card, Field, PageHeader } from '../components/UI';
import { ROLE_LABEL, ROLE_MOTTO } from '../nav';
import Avatar from '../components/Avatar';

/** Centre-crops an image file to a square and returns it as a small JPEG data URL (so uploads stay tiny). */
function toSquareJpeg(file, size = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
    img.src = url;
  });
}

export default function AccountPage() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState({});
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr({ photo: 'Choose an image file (JPG or PNG).' });
    setBusy(true);
    try { const image = await toSquareJpeg(file); const r = await api.post('/auth/account/photo', { image }); setUser({ ...user, ...r.user }); toast('Profile photo updated'); setErr({}); }
    catch (x) { setErr({ photo: x.message }); } finally { setBusy(false); }
  };
  const removePhoto = async () => {
    try { const r = await api.del('/auth/account/photo'); setUser({ ...user, ...r.user }); toast('Profile photo removed'); setErr({}); }
    catch (x) { setErr({ photo: x.message }); }
  };
  const saveName = async (e) => { e.preventDefault(); try { const r = await api.patch('/auth/account', { name }); setUser({ ...user, ...r.user }); toast('Profile updated'); setErr({}); } catch (x) { setErr({ name: x.message }); } };
  const savePw = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) return setErr({ pw: 'New passwords do not match.' });
    try { await api.post('/auth/account/password', { current: pw.current, next: pw.next }); toast('Password changed'); setPw({ current: '', next: '', confirm: '' }); setErr({}); } catch (x) { setErr({ pw: x.message }); }
  };
  return (
    <div>
      <PageHeader title="My Account" sub={`${ROLE_LABEL[user.role]} · ${ROLE_MOTTO[user.role]}`} />

      <div className="card account-hero">
        <div className="account-avatar"><Avatar name={user.name} role={user.role} photo={user.photo} size={112} /></div>
        <div className="account-hero-text">
          <h2 className="account-name">{user.name}</h2>
          <div className="account-meta"><span className="account-role">{ROLE_LABEL[user.role]}</span><span className="muted">{user.email}</span></div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} hidden />
          <div className="account-actions">
            <button type="button" className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? 'Uploading…' : user.photo ? 'Change photo' : 'Upload photo'}</button>
            {user.photo && <button type="button" className="btn btn-secondary" onClick={removePhoto} disabled={busy}>Remove</button>}
          </div>
          <p className="account-hint">JPG or PNG. It is cropped to a square automatically.</p>
          {err.photo && <p className="field-error" role="alert">{err.photo}</p>}
        </div>
        <div className="account-stat"><span>{user.permissions.length}</span><small>permissions granted</small></div>
      </div>

      <div className="account-grid">
        <Card title="Display name">
          <form onSubmit={saveName} className="account-form">
            <Field label="Name" hint="Shown across the system and in the activity log." error={err.name}>
              <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
            </Field>
            <div><button className="btn btn-primary">Save name</button></div>
          </form>
        </Card>
        <Card title="Change password">
          <form onSubmit={savePw} className="account-form">
            <Field label="Current password"><input className="field-input" type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" /></Field>
            <Field label="New password" hint="At least 8 characters."><input className="field-input" type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} autoComplete="new-password" /></Field>
            <Field label="Confirm new password"><input className="field-input" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required autoComplete="new-password" /></Field>
            {err.pw && <p className="field-error" role="alert">{err.pw}</p>}
            <div><button className="btn btn-primary">Change password</button></div>
          </form>
        </Card>
      </div>
    </div>
  );
}
