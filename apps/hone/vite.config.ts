import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname), '');
  const useLocal = env.VITE_HONE_LOCAL_API === 'true' || env.VITE_HONE_LOCAL_API === '1';
  const prodApi = (env.VITE_DRUZ9_API_BASE || 'https://druz9.online').replace(/\/$/, '');

  const proxy = useLocal
    ? {
        '/v1/auth': { target: 'http://localhost:8080', changeOrigin: true },
        '/v1/me': { target: 'http://localhost:8080', changeOrigin: true },
        '/v1/jwt': { target: 'http://localhost:8080', changeOrigin: true },
        '/v1/tracker': { target: 'http://localhost:8089', changeOrigin: true },
        '/v1/notes': { target: 'http://localhost:8090', changeOrigin: true },
        '/v1/focus': { target: 'http://localhost:8091', changeOrigin: true },
        '/v1/billing': { target: 'http://localhost:8085', changeOrigin: true },
      }
    : {
        '/v1/auth': { target: prodApi, changeOrigin: true },
        '/v1/me': { target: prodApi, changeOrigin: true },
        '/v1/jwt': { target: prodApi, changeOrigin: true },
        '/v1/tracker': { target: prodApi, changeOrigin: true },
        '/v1/notes': { target: prodApi, changeOrigin: true },
        '/v1/focus': { target: prodApi, changeOrigin: true },
        '/v1/billing': { target: prodApi, changeOrigin: true },
      };

  return {
    clearScreen: false,
    envDir: resolve(__dirname),
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy,
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
  };
});
