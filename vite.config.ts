import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

// Versión visible en la App (commit): en Vercel viene en VERCEL_GIT_COMMIT_SHA; en local, de git.
const build = (process.env.VERCEL_GIT_COMMIT_SHA ?? (() => { try { return execSync('git rev-parse HEAD').toString(); } catch { return 'dev'; } })()).trim().slice(0, 7);

export default defineConfig({
  define: { __BUILD__: JSON.stringify(build) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'GMM · Glasstech Maintenance Manager',
        short_name: 'GMM',
        description: 'Gestión de mantenimiento de activos Glasstech',
        lang: 'es-CL',
        theme_color: '#00324b',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'], importScripts: ['push-sw.js'] },
    }),
  ],
  test: { environment: 'node' },
});
