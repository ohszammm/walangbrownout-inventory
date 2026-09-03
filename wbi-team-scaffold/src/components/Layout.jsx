import { useState } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useItems } from "../state/ItemsContext";
import { deriveAlerts } from "../utils/deriveAlerts";

const NAV_ITEMS = [
  { to: "/", label: "Overview", end: true },
  { to: "/inventory", label: "Inventory" },
  { to: "/batches", label: "Batches" },
  { to: "/alerts", label: "Alerts", badge: true },
  { to: "/receive", label: "Receive shipment" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { items } = useItems();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const alertCount = deriveAlerts(items).length;

  const signOut = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const close = () => setOpen(false);

  const currentTitle = NAV_ITEMS.find((n) =>
    n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)
  )?.label || "WalangBrownout";

  return (
    <div className={open ? "sidebar-open" : ""}>
      <div className="mobile-topbar">
        <span className="mobile-topbar-brand">{currentTitle}</span>
        <button className="menu-toggle" onClick={() => setOpen(true)} aria-label="Open menu">
          &#9776;
        </button>
      </div>

      <div className="sidebar-backdrop" onClick={close} />

      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-name">WalangBrownout</div>
            <div className="sidebar-brand-sub">Inventory System</div>
          </div>

          <nav className="sidebar-nav">
            <div className="sidebar-section-label">Main navigation</div>
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={close}
                className={({ isActive }) => `sidebar-link ${isActive ? "sidebar-link-active" : ""}`}
              >
                <span>{item.label}</span>
                {item.badge && alertCount > 0 && <span className="sidebar-count">{alertCount}</span>}
              </NavLink>
            ))}
          </nav>

          <div className="sidebar-footer">
            {user && (
              <div className="sidebar-user">
                <span className="sidebar-user-name">{user.name}</span>
                <span className="sidebar-user-role">Administrator / Manager</span>
              </div>
            )}
            <button className="sidebar-signout" onClick={signOut}>Sign out</button>
          </div>
        </aside>

        <div className="main-content">
          <div className="content-inner">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}