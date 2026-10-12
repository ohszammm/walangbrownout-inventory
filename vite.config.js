import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Dev:   `npm run dev` serves the React app on :5173 and proxies /api to Laravel (php artisan serve, :8000).
// Build: `npm run build` writes the app to public/spa; Laravel then serves it at http://localhost:8000.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/spa/' : '/',
  publicDir: command === 'serve' ? 'public' : false,
  build: { outDir: 'public/spa', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:8000' } },
}));
