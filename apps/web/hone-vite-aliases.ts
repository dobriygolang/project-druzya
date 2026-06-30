import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const honeRenderer = path.resolve(here, '../hone/src/renderer/src')
const honeRoot = path.resolve(here, '../hone')
const shared = path.resolve(here, '../shared')

/** Vite resolve aliases to compile Hone renderer inside apps/web. */
export function honeViteAliases(): Record<string, string> {
  return {
    '@hone/demo': path.join(honeRenderer, 'demo'),
    '@app': path.join(honeRenderer, 'app'),
    '@pages': path.join(honeRenderer, 'pages'),
    '@widgets': path.join(honeRenderer, 'widgets'),
    '@features': path.join(honeRenderer, 'features'),
    '@shared': path.join(honeRenderer, 'shared'),
    '@platform': path.join(honeRenderer, 'platform'),
    '@d9-i18n': path.join(shared, 'i18n'),
    '@fontsource/inter': path.join(honeRoot, 'node_modules/@fontsource/inter'),
    '@fontsource/jetbrains-mono': path.join(honeRoot, 'node_modules/@fontsource/jetbrains-mono'),
    zustand: path.join(honeRoot, 'node_modules/zustand'),
    '@bufbuild/protobuf': path.join(honeRoot, 'node_modules/@bufbuild/protobuf'),
    '@connectrpc/connect': path.join(honeRoot, 'node_modules/@connectrpc/connect'),
  }
}

export const honeTsconfigPaths: Record<string, string[]> = {
  '@hone/demo': ['../hone/src/renderer/src/demo/index.ts'],
  '@hone/demo/*': ['../hone/src/renderer/src/demo/*'],
  '@app/*': ['../hone/src/renderer/src/app/*'],
  '@pages/*': ['../hone/src/renderer/src/pages/*'],
  '@widgets/*': ['../hone/src/renderer/src/widgets/*'],
  '@features/*': ['../hone/src/renderer/src/features/*'],
  '@shared/*': ['../hone/src/renderer/src/shared/*'],
  '@platform/*': ['../hone/src/renderer/src/platform/*'],
  '@d9-i18n': ['../shared/i18n/index.ts'],
  '@d9-i18n/*': ['../shared/i18n/*'],
}
