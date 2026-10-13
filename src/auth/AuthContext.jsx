import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

const Ctx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    api.get('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)).finally(() => setReady(true));
    const off = () => setUser(null);
    window.addEventListener('wbi:unauth', off);
    return () => window.removeEventListener('wbi:unauth', off);
  }, []);
  const login = useCallback(async (email, password) => { const r = await api.post('/auth/login', { email, password }); setUser(r.user); return r.user; }, []);
  const logout = useCallback(async () => { try { await api.post('/auth/logout'); } finally { setUser(null); } }, []);
  const value = useMemo(() => {
    const set = new Set(user?.permissions || []);
    return { user, ready, login, logout, setUser, can: (p) => set.has(p), canAny: (...ps) => ps.some((p) => set.has(p)) };
  }, [user, ready, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
