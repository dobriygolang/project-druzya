import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const GEN_ALIAS = {
  '@generated': resolve(__dirname, '../frontend/src/api/generated'),
};
const PEER_ALIASES = {
  '@bufbuild/protobuf': resolve(__dirname, 'node_modules/@bufbuild/protobuf'),
  '@connectrpc/connect': resolve(__dirname, 'node_modules/@connectrpc/connect'),
  '@connectrpc/connect-web': resolve(__dirname, 'node_modules/@connectrpc/connect-web'),
  zustand: resolve(__dirname, 'node_modules/zustand'),
};
const SHARED_ALIASES = {
  '@d9-i18n': resolve(__dirname, '../shared/i18n'),
};

// Vite config for Tauri (renderer only). Electron used electron-vite before.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  publicDir: resolve(__dirname, 'src/renderer/public'),
  envDir: resolve(__dirname),
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      ...GEN_ALIAS,
      ...SHARED_ALIASES,
      ...PEER_ALIASES,
    },
    dedupe: Object.keys(PEER_ALIASES),
  },
});
