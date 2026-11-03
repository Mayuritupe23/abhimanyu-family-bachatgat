import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../nova_core/public/frontend');

// Built files go to the app's public folder (/assets/nova_core/frontend/); index.html is
// copied to www/afbg.html so Frappe serves the app at /afbg, with the CSRF token filled in.
function copyIndexToWww() {
  return {
    name: 'copy-index-to-www',
    writeBundle() {
      const src = path.join(OUT, 'index.html');
      if (!fs.existsSync(src)) return;
      const html = fs.readFileSync(src, 'utf-8')
        .replace('<head>', '<head>\n    <script>window.csrf_token = "{{ csrf_token }}";</script>');
      fs.writeFileSync(path.resolve(__dirname, '../nova_core/www/afbg.html'), html);
    },
  };
}

export default defineConfig({
  base: '/assets/nova_core/frontend/',
  plugins: [
    // /assets/... images are Frappe's, not part of this bundle
    vue({ template: { transformAssetUrls: { includeAbsolute: false } } }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: '/afbg',
        name: 'Abhimanyu Family Bachat Gat',
        short_name: 'AFBG',
        description: 'Monthly hapta, loans, votes and passbook for the family savings group',
        start_url: '/afbg',
        scope: '/afbg',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5faf6',
        theme_color: '#15803d',
        icons: [
          { src: '/assets/nova_core/images/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/assets/nova_core/images/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/assets/nova_core/images/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Pay hapta', short_name: 'Pay', url: '/afbg/pay' },
          { name: 'My Khata', short_name: 'Khata', url: '/afbg/khata' },
          { name: 'Loans', short_name: 'Loans', url: '/afbg/loans' },
        ],
      },
      // money data is never served from cache; only the app's own files are
      workbox: { navigateFallback: null, runtimeCaching: [] },
    }),
    copyIndexToWww(),
  ],
  build: { outDir: OUT, emptyOutDir: true, target: 'es2018', sourcemap: false },
  server: {
    port: 8086,
    proxy: Object.fromEntries(['/api', '/assets', '/private', '/files'].map((p) => [p, { target: 'http://nova.localhost:8006', changeOrigin: true }])),
  },
});
