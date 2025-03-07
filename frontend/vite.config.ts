import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
              {
                  src: '/icons/icon-192x192.png',
                  sizes: '192x192',
                  type: 'image/png'
              },
              {
                  src: '/icons/icon-512x512.png',
                  sizes: '512x512',
                  type: 'image/png'
              }
          ]
      },
      workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,ico}']
      }
  })
  ],
  build: {
    rollupOptions: {
        output: {
            manualChunks(id) {
                if (id.includes('node_modules')) {
                    if (id.includes('react-calendar')) return 'react-calendar';
                    if (id.includes('react-toastify')) return 'react-toastify';
                    if (id.includes('luxon')) return 'luxon';
                    if (id.includes('react')) return 'react';
                    return 'vendor';
                }
            },
        },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://pflanzn-backend-1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    allowedHosts: ['localhost', 'pflanzn.nohub.lol'].filter(Boolean),
  },
})
