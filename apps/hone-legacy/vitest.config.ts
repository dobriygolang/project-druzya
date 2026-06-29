// vitest.config.ts — test runner config для Hone.
//
// Standalone from electron.vite.config.ts. We do NOT pull in the React
// plugin here: testing offline/* logic does not parse JSX, and React-plugin
// activates a heavy esbuild + babel pass which slows cold-start to 30+s.
// If/when component tests are added, switch to a separate `vitest.dom.config.ts`.
//
// Path aliases mirror electron.vite.config.ts чтобы code-under-test резолвил
// импорты идентично production-сборке.
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@generated': resolve(__dirname, '../frontend/src/api/generated'),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Threads pool — быстрее чем forks для тестов без heavy child processes.
    // IDB tests safe в threads потому что fake-indexeddb scope'ed per-worker.
    pool: 'threads',
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/renderer/src/offline/**', 'src/renderer/src/lib/**'],
    },
  },
});
