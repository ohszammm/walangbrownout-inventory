import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export function useApi(path, { refresh = 0 } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  const load = useCallback(async (silent) => {
    if (!path) return;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try { const data = await api.get(path); if (alive.current) setState({ data, error: null, loading: false }); }
    catch (error) { if (alive.current) setState((s) => ({ data: silent ? s.data : null, error, loading: false })); }
  }, [path]);
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, [load]);
  useEffect(() => { if (!refresh) return undefined; const id = setInterval(() => load(true), refresh); return () => clearInterval(id); }, [refresh, load]);
  return { ...state, reload: () => load(true) };
}
export function useDebounced(value, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}
