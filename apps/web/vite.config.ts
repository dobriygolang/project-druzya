import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const identity = process.env.VITE_IDENTITY_URL ?? 'http://localhost:8080'
const content = process.env.VITE_CONTENT_URL ?? 'http://localhost:8081'
const interview = process.env.VITE_INTERVIEW_URL ?? 'http://localhost:8082'
const recommendation = process.env.VITE_RECOMMENDATION_URL ?? 'http://localhost:8084'
const billing = process.env.VITE_BILLING_URL ?? 'http://localhost:8085'
const sandbox = process.env.VITE_SANDBOX_URL ?? 'http://localhost:8086'
const rooms = process.env.VITE_ROOMS_URL ?? 'http://localhost:8087'

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
      '/v1/companies': { target: content, changeOrigin: true },
      '/v1/interview-templates': { target: content, changeOrigin: true },
      '/v1/tasks': { target: content, changeOrigin: true },
      '/v1/rubrics': { target: content, changeOrigin: true },
      '/v1/interview': { target: interview, changeOrigin: true },
      '/v1/recommendations': { target: recommendation, changeOrigin: true },
      '/v1/billing': { target: billing, changeOrigin: true },
      '/v1/sandbox': { target: sandbox, changeOrigin: true },
      '/v1/rooms': { target: rooms, changeOrigin: true },
      '/ws/lsp': { target: sandbox, changeOrigin: true, ws: true },
      '/ws': { target: rooms, changeOrigin: true, ws: true },
    },
  },
})
