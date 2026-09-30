import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
// Schimbă REPO cu numele repository-ului GitHub (ex: "/plan/")
const REPO = process.env.VITE_BASE || '/plan/';
export default defineConfig({
  base: REPO,
  plugins: [react(), tailwind(), VitePWA({
    registerType: 'autoUpdate',
    workbox: { navigateFallback: REPO + 'index.html', globPatterns: ['**/*.{js,css,html,png,svg}'] },
    manifest: { name: 'Plan', short_name: 'Plan', start_url: REPO, scope: REPO, display: 'standalone',
      background_color: '#09090b', theme_color: '#09090b',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }, { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }] },
  })],
});
