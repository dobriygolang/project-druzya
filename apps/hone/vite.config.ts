import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  envDir: resolve(__dirname),
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/v1/auth': { target: 'http://localhost:8080', changeOrigin: true },
      '/v1/me': { target: 'http://localhost:8080', changeOrigin: true },
      '/v1/jwt': { target: 'http://localhost:8080', changeOrigin: true },
      '/v1/tracker': { target: 'http://localhost:8089', changeOrigin: true },
      '/v1/notes': { target: 'http://localhost:8090', changeOrigin: true },
      '/v1/focus': { target: 'http://localhost:8091', changeOrigin: true },
      '/v1/billing': { target: 'http://localhost:8085', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
