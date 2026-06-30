import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const LAYERS = {
  '@app': resolve(__dirname, 'src/renderer/src/app'),
  '@pages': resolve(__dirname, 'src/renderer/src/pages'),
  '@widgets': resolve(__dirname, 'src/renderer/src/widgets'),
  '@features': resolve(__dirname, 'src/renderer/src/features'),
  '@shared': resolve(__dirname, 'src/renderer/src/shared'),
  '@platform': resolve(__dirname, 'src/renderer/src/platform'),
  '@d9-i18n': resolve(__dirname, '../shared/i18n'),
};

export default defineConfig({
  resolve: { alias: LAYERS },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    pool: 'threads',
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/renderer/src/shared/lib/**', 'src/renderer/src/shared/model/**'],
    },
  },
});
