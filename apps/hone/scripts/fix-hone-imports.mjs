#!/usr/bin/env node
/**
 * Rewrites relative imports → @app/@pages/@widgets/@features/@shared/@platform aliases
 * after FSD folder reorg.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../src/renderer/src', import.meta.url).pathname;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

/** Order matters — longer / more specific patterns first. */
const RULES = [
  // platform
  [/from ['"]@shared\/ipc['"]/g, "from '@platform/ipc'"],
  [/from ['"](?:\.\.\/)+lib\/native-bridge['"]/g, "from '@platform/native-bridge'"],
  [/from ['"]\.\/lib\/native-bridge['"]/g, "from '@platform/native-bridge'"],

  // app
  [/from ['"]\.\/features['"]/g, "from '@app/config/features'"],
  [/from ['"]\.\.\/features['"]/g, "from '@app/config/features'"],
  [/from ['"]\.\.\/\.\.\/features['"]/g, "from '@app/config/features'"],
  [/from ['"]\.\/App['"]/g, "from '@app/App'"],
  [/from ['"]\.\.\/\.\.\/app\/styles\//g, "from '@app/styles/"],
  [/from ['"]\.\.\/\.\.\/\.\.\/app\/styles\//g, "from '@app/styles/"],
  [/from ['"]\.\/styles\//g, "from '@app/styles/"],

  // generated
  [/from ['"]@generated\//g, "from '@shared/generated/"],
  [/from ['"](?:\.\.\/)+stubs\/generated\//g, "from '@shared/generated/"],

  // features api
  [/from ['"](?:\.\.\/)+api\/auth['"]/g, "from '@features/auth/api/auth'"],
  [/from ['"](?:\.\.\/)+api\/focusClient['"]/g, "from '@features/focus/api/focusClient'"],
  [/from ['"](?:\.\.\/)+api\/tasks['"]/g, "from '@features/tasks/api/tasks'"],
  [/from ['"](?:\.\.\/)+api\/notesClient['"]/g, "from '@features/notes/api/notesClient'"],
  [/from ['"](?:\.\.\/)+api\/localNotes['"]/g, "from '@features/notes/api/localNotes'"],
  [/from ['"](?:\.\.\/)+api\/localCache['"]/g, "from '@features/notes/api/localCache'"],
  [/from ['"](?:\.\.\/)+api\/storage['"]/g, "from '@features/notes/api/storage'"],
  [/from ['"](?:\.\.\/)+api\/vault['"]/g, "from '@features/notes/api/vault'"],
  [/from ['"](?:\.\.\/)+audio\/ambient-music['"]/g, "from '@features/focus/audio/ambient-music'"],

  // shared api
  [/from ['"](?:\.\.\/)+api\/transport['"]/g, "from '@shared/api/transport'"],
  [/from ['"](?:\.\.\/)+api\/config['"]/g, "from '@shared/api/config'"],
  [/from ['"](?:\.\.\/)+api\/device['"]/g, "from '@shared/api/device'"],
  [/from ['"](?:\.\.\/)+api\/notifications['"]/g, "from '@shared/api/notifications'"],
  [/from ['"](?:\.\.\/)+api\/sync['"]/g, "from '@shared/api/sync'"],
  [/from ['"]\.\/sync['"]/g, "from '@shared/api/sync'"],
  [/from ['"]\.\/config['"]/g, "from '@shared/api/config'"],
  [/from ['"]\.\/notesClient['"]/g, "from '@features/notes/api/notesClient'"],
  [/from ['"]\.\/hone['"]/g, "from '@features/notes/api/notesClient'"],

  // model / hooks / lib
  [/from ['"](?:\.\.\/)+stores\//g, "from '@shared/model/"],
  [/from ['"](?:\.\.\/)+hooks\//g, "from '@shared/hooks/"],
  [/from ['"](?:\.\.\/)+lib\//g, "from '@shared/lib/"],

  // widgets
  [/from ['"](?:\.\.\/)+components\/Dock['"]/g, "from '@widgets/Dock'"],
  [/from ['"](?:\.\.\/)+components\/Palette['"]/g, "from '@widgets/Palette'"],
  [/from ['"](?:\.\.\/)+components\/Chrome['"]/g, "from '@widgets/Chrome'"],
  [/from ['"](?:\.\.\/)+components\/TrafficLightsHover['"]/g, "from '@widgets/TrafficLightsHover'"],
  [/from ['"](?:\.\.\/)+components\/CanvasBg['"]/g, "from '@widgets/CanvasBg'"],
  [/from ['"](?:\.\.\/)+components\/LoginScreen['"]/g, "from '@widgets/LoginScreen'"],
  [/from ['"](?:\.\.\/)+components\/OfflineBanner['"]/g, "from '@widgets/OfflineBanner'"],
  [/from ['"](?:\.\.\/)+components\/VaultUnlockGate['"]/g, "from '@widgets/VaultUnlockGate'"],
  [/from ['"](?:\.\.\/)+components\/AnimatedStatsOverlay['"]/g, "from '@widgets/AnimatedStatsOverlay'"],
  [/from ['"](?:\.\.\/)+components\/StatsOverlay['"]/g, "from '@widgets/StatsOverlay'"],
  [/from ['"](?:\.\.\/)+components\/InfoToast['"]/g, "from '@widgets/InfoToast'"],
  [/from ['"](?:\.\.\/)+components\/Skeleton['"]/g, "from '@shared/ui/Skeleton'"],

  // shared ui
  [/from ['"](?:\.\.\/)+components\/primitives\//g, "from '@shared/ui/primitives/"],
  [/from ['"](?:\.\.\/)+components\/a11y\//g, "from '@shared/ui/a11y/"],
  [/from ['"](?:\.\.\/)+components\/ErrorBoundary['"]/g, "from '@shared/ui/ErrorBoundary'"],
  [/from ['"](?:\.\.\/)+components\/RichMarkdownEditor['"]/g, "from '@shared/ui/RichMarkdownEditor'"],
  [/from ['"](?:\.\.\/)+components\/SlashMenu['"]/g, "from '@shared/ui/SlashMenu'"],
  [/from ['"](?:\.\.\/)+components\/FloatingToolbar['"]/g, "from '@shared/ui/FloatingToolbar'"],
  [/from ['"](?:\.\.\/)+components\/taskboard\/KindPicker['"]/g, "from '@pages/TaskBoard/ui/KindPicker'"],
  [/from ['"](?:\.\.\/)+components\/taskboard\/kinds['"]/g, "from '@pages/TaskBoard/lib/kinds'"],

  // pages shortcuts (App.tsx)
  [/from ['"]\.\/pages\//g, "from '@pages/"],
  [/from ['"]\.\/components\//g, "from '@widgets/"],
  [/from ['"]\.\/hooks\//g, "from '@shared/hooks/"],
  [/from ['"]\.\/stores\//g, "from '@shared/model/"],
  [/from ['"]\.\/api\//g, "from '@features/"],
  [/from ['"]\.\.\/api\//g, "from '@features/"],

  // dynamic imports in App
  [/import\(['"]\.\/pages\//g, "import('@pages/"],
  [/import\(['"]\.\/api\//g, "import('@features/"],
  [/import\(['"]\.\/features\/focus\/audio\//g, "import('@features/focus/audio/"],
  [/import\(['"]\.\/pages\/Settings\/sections\//g, "import('@pages/Settings/sections/"],

  // assets
  [/from ['"](?:\.\.\/)+assets\//g, "from '@shared/assets/"],

  // internal feature cross-imports (notes localCache → sync)
  [/from ['"]\.\/sync['"]/g, "from '@shared/api/sync'"],
];

const files = walk(ROOT);
let changed = 0;
for (const file of files) {
  let src = readFileSync(file, 'utf8');
  const before = src;
  for (const [re, rep] of RULES) src = src.replace(re, rep);
  if (src !== before) {
    writeFileSync(file, src);
    changed++;
  }
}
console.log(`Updated imports in ${changed} files.`);
