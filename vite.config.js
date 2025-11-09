import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'

// Check if HTTPS certificates exist
const httpsConfig = (() => {
  const keyPath = './certs/key.pem'
  const certPath = './certs/cert.pem'

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    }
  }
  return false
})()

export default defineConfig({
  plugins: [
    react(),
    // Disable PWA in development to prevent reload issues
    ...(process.env.NODE_ENV === 'production' ? [
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']
        },
        manifest: {
          name: 'Audio Task Manager',
          short_name: 'AudioTasks',
          description: 'Transcribe audio and organize tasks on a mobile-friendly kanban board',
          theme_color: '#4285f4',
          background_color: '#fafafa',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ] : [])
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 8064,
    https: httpsConfig,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'notes.rodeomasjid.org',
      '.rodeomasjid.org'
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    },
    hmr: {
      host: 'localhost',
      port: 8065,
      protocol: httpsConfig ? 'wss' : 'ws'
    },
    watch: {
      usePolling: false,
      interval: 1000
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 8064,
    https: httpsConfig
  }
})