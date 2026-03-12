import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { manualChunks } from './vite/chunk-split'
import packageJson from './package.json'

export default defineConfig(() => {
  const raw = process.env.VITE_DOMAIN ?? ''
  const domain = raw.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Pflanzn',
          short_name: 'Pflanzn',
          description: 'Plant Management',
          theme_color: '#4caf50',
          background_color: '#2c2c2c',
          display: 'standalone',
          icons: [
            { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: '/icons/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,png,svg,ico}'],
          navigateFallbackDenylist: [
            /^\/$/
          ],
          runtimeCaching: [
            {
              urlPattern: /\/api\/plants(\/\d+)?(\?.*)?$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-plants',
                expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
                networkTimeoutSeconds: 3,
              },
            },
            {
              urlPattern: /\/api\/locations(\/\d+)?(\?.*)?$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-locations',
                expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
                networkTimeoutSeconds: 3,
              },
            },
            {
              urlPattern: /\/api\/uploads\/.+\.(webp|jpg|jpeg|png)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'plant-images',
                expiration: { maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 },
              },
            },
            {
              urlPattern: /\/api\/users\/profile$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-user',
                expiration: { maxEntries: 1, maxAgeSeconds: 24 * 60 * 60 },
                networkTimeoutSeconds: 2,
              },
            },
            {
              urlPattern: /\/api\/statistics(\/.*)?$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-statistics',
                expiration: { maxEntries: 10, maxAgeSeconds: 24 * 60 * 60 },
                networkTimeoutSeconds: 3,
              },
            },
          ],
        }
      })
    ],
    build: {
      rollupOptions: {
        output: { manualChunks },
      },
    },
    preview: {
      allowedHosts: ['localhost', domain].filter(Boolean),
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
  }
})
