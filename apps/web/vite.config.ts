import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const identity = process.env.VITE_IDENTITY_URL ?? 'http://localhost:8080'
const billing = process.env.VITE_BILLING_URL ?? 'http://localhost:8085'
const sandbox = process.env.VITE_SANDBOX_URL ?? 'http://localhost:8086'
const rooms = process.env.VITE_ROOMS_URL ?? 'http://localhost:8087'
const notes = process.env.VITE_NOTES_URL ?? 'http://localhost:8090'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/v1/auth': { target: identity, changeOrigin: true },
      '/v1/me': { target: identity, changeOrigin: true },
      '/v1/billing': { target: billing, changeOrigin: true },
      '/v1/sandbox': { target: sandbox, changeOrigin: true },
      '/v1/rooms': { target: rooms, changeOrigin: true },
      '/v1/notes': { target: notes, changeOrigin: true },
      '/ws/lsp': { target: sandbox, changeOrigin: true, ws: true },
      '/ws': { target: rooms, changeOrigin: true, ws: true },
    },
  },
})
