import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Keep the browser's Host header so the API's same-origin check sees the page's real address.
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false } },
  },
  build: { outDir: 'dist/client', sourcemap: true },
});
