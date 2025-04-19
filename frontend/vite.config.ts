import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { manualChunks } from './vite/chunk-split'

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
        allowedHosts: ['localhost', 'pflanzn.nohub.lol'].filter(Boolean),
    },
})