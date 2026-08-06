import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: true },
  server: {
    port: 5173,
    // Local only. In production the Worker serves /api on the app hostname, so
    // the SPA's requests are same-origin and carry the Access cookie.
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
});
