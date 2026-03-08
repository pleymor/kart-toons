import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    glsl(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'KHAOS KART',
        short_name: 'KHAOS KART',
        description: 'Cell-shaded multiplayer kart racing',
        display: 'fullscreen',
        orientation: 'landscape',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html}'],
        runtimeCaching: [
          {
            urlPattern: /^.*\/assets\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['@dimforge/rapier3d-compat']
  },
  server: {
    port: 5173
  },
  build: {
    target: 'es2022'
  }
});
