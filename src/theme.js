import { useEffect, useState } from 'react';
const KEY = 'wbi_theme';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
export function initialTheme() { return read() || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'); }
export function useTheme() {
  const [theme, setTheme] = useState(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}
export const logoFor = (theme) => (theme === 'dark' ? '/brand/logo-dark.png' : '/brand/logo-light.png');
