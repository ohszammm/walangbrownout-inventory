import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { logoFor, useTheme } from '../theme';
import Icon from '../components/Icon';

export default function Login() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, toggleTheme] = useTheme();
  const [f, setF] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);
  const [busy, setBusy] = useState(false);
  if (ready && user) return <Navigate to="/" replace />;
  const from = location.state?.from?.pathname || '/';
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setForgot(false);
    try { await login(f.email, f.password); navigate(from, { replace: true }); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="login-shell">
      <video className="login-video" autoPlay muted loop playsInline preload="auto" poster="/media/login-bg.jpg" aria-hidden="true"><source src="/media/login-bg.mp4" type="video/mp4" /></video>
      <div className="login-scrim" />
      <div className="login-grid">
        <section className="login-hero">
          <h1>WalangBrownout<br />Appliances</h1>
          <p>Manage appliances, monitor stock, and keep inventory organized.</p>
        </section>
        <section className="login-panel">
          <div className="login-card">
            <div className="login-stars" aria-hidden="true"><span className="stars-a" /><span className="stars-b" /><span className="stars-c" /><i className="shoot shoot-1" /><i className="shoot shoot-2" /></div>
            <img src={logoFor(theme)} alt="WalangBrownout Appliances" className="login-logo" />
            <p className="login-brand-sub">Inventory Management System</p>
            <form onSubmit={submit} className="login-form" noValidate={false}>
              <div className="field">
                <label className="field-label" htmlFor="email">Email</label>
                <input id="email" type="email" className="field-input login-input" value={f.email} onChange={set('email')} placeholder="you@walangbrownout.test" autoFocus required autoComplete="username" />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="password">Password</label>
                <div className="password-wrap">
                  <input id="password" type={show ? 'text' : 'password'} className="field-input login-input" value={f.password} onChange={set('password')} placeholder="Enter your password" required autoComplete="current-password" />
                  <button type="button" className="eye-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}><Icon name={show ? 'eyeoff' : 'eye'} size={19} /></button>
                </div>
              </div>
              <div className="login-forgot"><button type="button" className="link-btn" onClick={() => setForgot((v) => !v)}>Forgot password?</button></div>
              {forgot && <p className="login-note" role="status">Password resets are handled by your System Administrator. Please contact them to receive a new temporary password.</p>}
              {error && <p className="field-error login-error" role="alert">{error}</p>}
              <div className="login-actions">
                <button type="submit" disabled={busy} className="login-btn">{busy ? 'Please wait…' : 'LOGIN'}</button>
                <button type="button" className="theme-round" onClick={toggleTheme} aria-label="Toggle light or dark mode" title={theme === 'dark' ? 'Light mode' : 'Dark mode'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={22} /></button>
              </div>
            </form>
            <p className="login-foot">Account access is managed<br />by your organization.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
