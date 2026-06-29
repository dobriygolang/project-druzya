import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// electron-vite scaffolding mirrors cue/ (the stealth copilot) so the
// two apps can share a codegen root (frontend/src/api/generated) and a
// future shared/electron-core package. Any divergence here should have a
// reason documented in the README.
//
// Two cross-cutting concerns repeat across main / preload / renderer:
//
//   @generated/*        — proto-generated TS stubs live in the frontend
//                          tree; both cue/ and hone/ alias the same
//                          directory so one `make gen-proto` updates both.
//
//   @bufbuild/protobuf, — peer packages of the generated code. When a
//   @connectrpc/connect   renderer/main file imports via @generated, Rollup
//                          resolves from the frontend tree and (on CI,
//                          where only hone/node_modules is installed)
//                          can't find these. Force the resolver to point
//                          at hone/node_modules regardless of importer,
//                          and dedupe so Vite's module graph treats the
//                          package as a single instance (guards against
//                          the same nominal-type drift TypeScript sees).
const GEN_ALIAS = {
  '@generated': resolve(__dirname, '../frontend/src/api/generated'),
};
const PEER_ALIASES = {
  '@bufbuild/protobuf': resolve(__dirname, 'node_modules/@bufbuild/protobuf'),
  '@connectrpc/connect': resolve(__dirname, 'node_modules/@connectrpc/connect'),
  '@connectrpc/connect-web': resolve(__dirname, 'node_modules/@connectrpc/connect-web'),
  zustand: resolve(__dirname, 'node_modules/zustand'),
};
const PEER_DEDUPE = Object.keys(PEER_ALIASES);

// Shared i18n dictionary used by both Hone and Cue. Same alias pattern as
// @generated — a sibling source directory, not an npm package.
const SHARED_ALIASES = {
  '@d9-i18n': resolve(__dirname, '../shared/i18n'),
};

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts'),
      },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@main': resolve(__dirname, 'src/main'),
        ...GEN_ALIAS,
        ...SHARED_ALIASES,
        ...PEER_ALIASES,
      },
      dedupe: PEER_DEDUPE,
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts'),
      },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        ...GEN_ALIAS,
        ...SHARED_ALIASES,
        ...PEER_ALIASES,
      },
      dedupe: PEER_DEDUPE,
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      // Electron 41 ships Chromium ≥130, so we don't need to down-level
      // syntax for legacy browsers. esnext keeps optional chaining /
      // nullish-coalescing / class fields untranspiled, which both
      // speeds up Vite's transform pass and shrinks the renderer bundle.
      target: 'esnext',
      // Lazy-page splitting (App.tsx) gives us per-page chunks; manual
      // chunks below carve the heaviest *vendor* groups out so they
      // ship in stable, cacheable files instead of being inlined into
      // whichever page first imports them. Order matters — Excalidraw
      // and CodeMirror own most of the renderer payload.
      rollupOptions: {
        // Multi-entry renderer:
        //   main             — full app (App.tsx, all pages).
        //   quick-capture    — Phase K Wave 15 standalone overlay window
        //                      (~480×80, spotlight-style). Lives in its own
        //                      HTML so the global-shortcut window doesn't
        //                      pay the cost of loading the heavy main bundle.
        input: {
          main: resolve(__dirname, 'src/renderer/index.html'),
          'quick-capture': resolve(__dirname, 'src/renderer/quick-capture.html'),
        },
        output: {
          manualChunks: (id) => {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('@excalidraw')) return 'vendor-excalidraw';
            if (id.includes('@codemirror') || id.includes('codemirror')) return 'vendor-codemirror';
            if (id.includes('yjs') || id.includes('y-indexeddb') || id.includes('y-codemirror') || id.includes('y-protocols')) {
              return 'vendor-yjs';
            }
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('@bufbuild') || id.includes('@connectrpc')) return 'vendor-connect';
            if (id.includes('@sentry')) return 'vendor-sentry';
            if (id.includes('marked')) return 'vendor-marked';
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared'),
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        // The renderer is where api/hone.ts lives — without @generated
        // aliased here, Vite's dev server can't resolve the proto stubs
        // and every `⌘K → Stats` path dies on page load.
        ...GEN_ALIAS,
        ...SHARED_ALIASES,
        ...PEER_ALIASES,
      },
      dedupe: PEER_DEDUPE,
    },
    plugins: [react()],
  },
});
