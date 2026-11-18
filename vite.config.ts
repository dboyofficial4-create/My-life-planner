import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The public welcome page is a static page in public/start/. In development, serve its index for /start/
// (the production server does the same in server/index.ts).
const welcomePage: Plugin = {
  name: 'welcome-page',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url && /^\/start(\?.*)?$/.test(req.url)) {
        res.statusCode = 302;
        res.setHeader('Location', req.url.replace(/^\/start/, '/start/'));
        return res.end();
      }
      if (req.url && /^\/start\/(\?.*)?$/.test(req.url)) req.url = req.url.replace(/^\/start\//, '/start/index.html');
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), welcomePage],
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
