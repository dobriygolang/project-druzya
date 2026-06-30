// ESLint flat config (v9). Phase K Wave 16 introduced `d9-i18n/no-cyrillic-literals`
// as the runtime gate against hardcoded Cyrillic in user-facing strings —
// the TypeScript Dict in shared/i18n already catches typos in keys, but
// only ESLint catches the original sin of `<button>Привет</button>` that
// was never wrapped in `t()` at all. Rule is `'error'` post-sweep, so any
// new hardcoded literal in JSX / string / template literal fails CI.
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const noCyrillicLiterals = require('../tools/eslint-no-cyrillic-literals.cjs');

export default [
  {
    ignores: [
      'dist/**',
      'out/**',
      'node_modules/**',
      '../frontend/src/api/generated/**',
      '**/*.test.{ts,tsx}',
      'src/test/**',
      'src/renderer/src/quick-capture/**',
      // Main-process Electron strings (system notifications) need their own
      // i18n strategy via app.getLocale() + duplicated bilingual constants;
      // tracked separately from the renderer Dict.
      'src/main/**',
    ],
  },
  js.configs.recommended,
  // Inline `// eslint-disable-next-line react-hooks/exhaustive-deps`
  // comments litter the renderer; react-hooks plugin isn't wired here,
  // so don't error on unknown disable directives.
  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
      'd9-i18n': {
        rules: {
          'no-cyrillic-literals': noCyrillicLiterals,
        },
      },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'd9-i18n/no-cyrillic-literals': 'error',
      // react-hooks правила: rules-of-hooks — error (нарушения = bug),
      // exhaustive-deps — warn (legacy renderer много inline-зависимостей,
      // массовый rewrite вне scope этой чистки; пусть линтер шумит, но
      // не блокирует CI).
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Settings page declares Russian search aliases inside `keywords: 'ru en'`
  // strings deliberately, so non-EN-readers can find sections by Russian
  // synonyms. Per Hone agent #1's notes — these are data, not user-facing
  // copy, and the d9-i18n rule should ignore this single file.
  {
    files: ['src/renderer/src/pages/Settings/index.tsx'],
    rules: {
      'd9-i18n/no-cyrillic-literals': 'off',
    },
  },
];
