import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const backendUrl = (process.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')
const websocketUrl = (process.env.VITE_WS_URL || backendUrl).replace(/\/+$/, '').replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/ws': {
        target: websocketUrl,
        ws: true,
      },
    },
  },
})
