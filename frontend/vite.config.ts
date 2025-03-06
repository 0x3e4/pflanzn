import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
