import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const webRoot = here
const honeRenderer = path.resolve(here, '../hone/src/renderer/src')
const shared = path.resolve(here, '../shared')

/** Vite resolve aliases to compile Hone renderer inside apps/web. */
export function honeViteAliases(): Record<string, string> {
  const nm = (pkg: string) => path.join(webRoot, 'node_modules', pkg)
  const stub = (name: string) => path.join(webRoot, 'src/hone-stubs', name)
  return {
    '@hone/demo': path.join(honeRenderer, 'demo'),
    '@app': path.join(honeRenderer, 'app'),
    '@pages': path.join(honeRenderer, 'pages'),
    '@widgets': path.join(honeRenderer, 'widgets'),
    '@features': path.join(honeRenderer, 'features'),
    '@shared': path.join(honeRenderer, 'shared'),
    '@platform': path.join(honeRenderer, 'platform'),
    '@d9-i18n': path.join(shared, 'i18n'),
    '@fontsource/inter': nm('@fontsource/inter'),
    '@fontsource/jetbrains-mono': nm('@fontsource/jetbrains-mono'),
    zustand: nm('zustand'),
    '@bufbuild/protobuf': nm('@bufbuild/protobuf'),
    '@connectrpc/connect': nm('@connectrpc/connect'),
    '@tauri-apps/api/app': stub('tauri-api-app.ts'),
    '@tauri-apps/api/core': stub('tauri-api-core.ts'),
    '@tauri-apps/api/event': stub('tauri-api-event.ts'),
    '@tauri-apps/plugin-process': stub('tauri-plugin-process.ts'),
    '@tauri-apps/plugin-updater': stub('tauri-plugin-updater.ts'),
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
