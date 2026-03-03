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
            { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,png,svg,ico}'],
          navigateFallbackDenylist: [
            /^\/$/
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
