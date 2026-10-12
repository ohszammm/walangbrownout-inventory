import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="boot">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  return children;
}
export function RequirePerm({ perm, children }) {
  const { can, canAny } = useAuth();
  const list = Array.isArray(perm) ? perm : [perm];
  if (!(list.length > 1 ? canAny(...list) : can(list[0]))) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center' }}>
        <h2 style={{ marginBottom: 8 }}>No access</h2>
        <p style={{ color: 'var(--ink-muted)', margin: 0 }}>Your role does not include permission to view this page. Contact your System Administrator if you need it.</p>
      </div>
    );
  }
  return children;
}
