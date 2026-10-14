import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../lib/hooks';
import { NAV, ROLE_LABEL } from '../nav';
import { useTheme } from '../theme';
import Icon from './Icon';
import Avatar from './Avatar';

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  return [open, setOpen, ref];
}

const readCollapsed = () => { try { return localStorage.getItem('wbi_sidebar') === '1'; } catch { return false; } };
const initials = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [theme, toggleTheme] = useTheme();
  const [bellOpen, setBellOpen, bellRef] = usePopover();
  const [userOpen, setUserOpen, userRef] = usePopover();
  const badges = useApi('/badges', { refresh: 30000 }).data || {};
  const sections = NAV[user.role] || [];
  const flat = sections.flatMap((s) => s.items);
  const close = () => setOpen(false);
  // The page heading already names the page, so the top bar just shows the app name on every page.
  const current = 'WalangBrownout';
  const notices = flat.filter((i) => i.badge && badges[i.badge] > 0);
  const noticeTotal = notices.reduce((a, i) => a + badges[i.badge], 0);
  const signOut = async () => { await logout(); navigate('/login', { replace: true }); };
  const toggleSidebar = () => {
    if (window.matchMedia('(max-width: 900px)').matches) { setOpen((o) => !o); return; }
    setCollapsed((c) => { const n = !c; try { localStorage.setItem('wbi_sidebar', n ? '1' : '0'); } catch { /* ignore */ } return n; });
  };

  return (
    <div className={`${open ? 'sidebar-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <div className="sidebar-backdrop" onClick={close} />
      <div className="app-shell">
        <div className="app-stars" aria-hidden="true"><span className="stars-a" /><span className="stars-b" /><span className="stars-c" /></div>
        <aside className="sidebar">
          <div className="sidebar-brand">
            <img src="/brand/logo-dark.png" alt="WalangBrownout Appliances" className="sidebar-logo" />
            <div className="sidebar-brand-sub">Inventory Management System</div>
          </div>
          <nav className="sidebar-nav" aria-label="Main">
            {sections.map((s, i) => (
              <div key={i} className="sidebar-group">
                {s.title && <div className="sidebar-section-label">{s.title}</div>}
                {s.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} onClick={close} title={item.label} className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}>
                    <Icon name={item.icon} size={18} className="sidebar-icon" />
                    <span className="sidebar-label">{item.label}</span>
                    {item.badge && badges[item.badge] > 0 && <span className="sidebar-count">{badges[item.badge]}</span>}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </aside>

        <div className="main-content">
          <header className="topbar">
            <button className="icon-btn" onClick={toggleSidebar} aria-label="Toggle menu"><Icon name="menu" size={21} /></button>
            <h2 className="topbar-title">{current}</h2>
            <div className="topbar-right">
              <button className="icon-btn" onClick={toggleTheme} aria-label="Toggle light or dark mode" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={19} /></button>
              <div className="popover-host" ref={bellRef}>
                <button className="icon-btn" onClick={() => { setBellOpen((o) => !o); setUserOpen(false); }} aria-label={`Notifications (${noticeTotal})`} aria-expanded={bellOpen}>
                  <Icon name="bell" size={19} />{noticeTotal > 0 && <span className="bell-dot">{noticeTotal > 99 ? '99+' : noticeTotal}</span>}
                </button>
                {bellOpen && (
                  <div className="popover" role="menu">
                    <div className="popover-head">Notifications</div>
                    {notices.length === 0 && <div className="popover-empty">You're all caught up.</div>}
                    {notices.map((i) => (
                      <Link key={i.to} to={i.to} className="popover-item" onClick={() => setBellOpen(false)}>
                        <span className="popover-ico"><Icon name={i.icon} size={16} /></span><span className="popover-text">{i.label}</span><b className="popover-count">{badges[i.badge]}</b>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <span className="topbar-sep" />
              <div className="popover-host" ref={userRef}>
                <button className="user-chip" onClick={() => { setUserOpen((o) => !o); setBellOpen(false); }} aria-expanded={userOpen}>
                  <Avatar name={user.name} photo={user.photo} tone="avatar-blue" />
                  <span className="user-chip-text"><span className="user-chip-name">{user.name}</span><span className="user-chip-role">{ROLE_LABEL[user.role]}</span></span>
                  <Icon name="down" size={15} className="user-chip-caret" />
                </button>
                {userOpen && (
                  <div className="popover popover-right" role="menu">
                    <div className="popover-head"><b>{user.name}</b><span>{user.email}</span></div>
                    <Link to="/account" className="popover-item" onClick={() => setUserOpen(false)}><span className="popover-ico"><Icon name="account" size={16} /></span><span className="popover-text">My Account</span></Link>
                    <button className="popover-item" onClick={() => { setUserOpen(false); signOut(); }}><span className="popover-ico"><Icon name="logout" size={16} /></span><span className="popover-text">Log out</span></button>
                  </div>
                )}
              </div>
            </div>
          </header>
          <div className="content-inner"><Outlet /></div>
        </div>
      </div>
    </div>
  );
}
