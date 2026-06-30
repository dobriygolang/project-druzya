#!/usr/bin/env bash
# One-time FSD reorg for apps/hone frontend. Safe to re-run only on clean tree.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/src/renderer/src"
cd "$ROOT"

mkdir -p "$SRC/app/config" "$SRC/app/styles"
mkdir -p "$SRC/platform"
mkdir -p "$SRC/widgets"
mkdir -p "$SRC/features/auth/api"
mkdir -p "$SRC/features/focus/api" "$SRC/features/focus/audio"
mkdir -p "$SRC/features/notes/api"
mkdir -p "$SRC/features/tasks/api"
mkdir -p "$SRC/shared/api" "$SRC/shared/model" "$SRC/shared/hooks" "$SRC/shared/lib" "$SRC/shared/ui" "$SRC/shared/assets" "$SRC/shared/generated/pb/druz9/v1"
mkdir -p "$SRC/pages/TaskBoard/ui"

# ── app layer ──
mv "$SRC/main.tsx" "$SRC/app/"
mv "$SRC/App.tsx" "$SRC/app/"
mv "$SRC/features.ts" "$SRC/app/config/"
mv "$SRC/vite-env.d.ts" "$SRC/app/"
mv "$SRC/styles/"* "$SRC/app/styles/"
rmdir "$SRC/styles"

# ── platform (Tauri boundary) ──
mv "$ROOT/src/shared/ipc.ts" "$SRC/platform/"
mv "$SRC/lib/native-bridge.ts" "$SRC/platform/"
rmdir "$ROOT/src/shared" 2>/dev/null || true

# ── shared ──
mv "$SRC/stores/"* "$SRC/shared/model/"
rmdir "$SRC/stores"
mv "$SRC/hooks/"* "$SRC/shared/hooks/"
rmdir "$SRC/hooks"
for f in design-tokens.ts theme.ts z-index.ts storage-keys.ts custom-events.ts time.ts focus-trap.ts; do
  mv "$SRC/lib/$f" "$SRC/shared/lib/"
done
mv "$SRC/lib/__tests__" "$SRC/shared/lib/__tests__" 2>/dev/null || true
rmdir "$SRC/lib" 2>/dev/null || true

mv "$SRC/components/primitives" "$SRC/shared/ui/"
mv "$SRC/components/a11y" "$SRC/shared/ui/"
for f in ErrorBoundary.tsx RichMarkdownEditor.tsx SlashMenu.tsx FloatingToolbar.tsx Skeleton.tsx; do
  mv "$SRC/components/$f" "$SRC/shared/ui/"
done

mv "$SRC/assets/"* "$SRC/shared/assets/"
rmdir "$SRC/assets"

mv "$SRC/stubs/generated/connect-service.ts" "$SRC/shared/generated/"
mv "$SRC/stubs/generated/pb/druz9/v1/profile_connect.ts" "$SRC/shared/generated/pb/druz9/v1/"
rmdir -p "$SRC/stubs/generated/pb/druz9/v1" 2>/dev/null || true
rmdir -p "$SRC/stubs/generated/pb/druz9" 2>/dev/null || true
rmdir -p "$SRC/stubs/generated/pb" 2>/dev/null || true
rmdir -p "$SRC/stubs/generated" 2>/dev/null || true
rmdir -p "$SRC/stubs" 2>/dev/null || true

# ── shared api (transport layer) ──
for f in transport.ts config.ts device.ts notifications.ts sync.ts; do
  mv "$SRC/api/$f" "$SRC/shared/api/"
done

# ── features (domain api) ──
mv "$SRC/api/auth.ts" "$SRC/features/auth/api/"
mv "$SRC/api/focusClient.ts" "$SRC/features/focus/api/"
mv "$SRC/audio/ambient-music.ts" "$SRC/features/focus/audio/"
for f in notesClient.ts localNotes.ts localCache.ts storage.ts vault.ts; do
  mv "$SRC/api/$f" "$SRC/features/notes/api/"
done
mv "$SRC/api/tasks.ts" "$SRC/features/tasks/api/"
rmdir "$SRC/api" 2>/dev/null || true
rmdir "$SRC/audio" 2>/dev/null || true

# ── widgets ──
for f in Dock Palette Chrome TrafficLightsHover CanvasBg LoginScreen OfflineBanner VaultUnlockGate AnimatedStatsOverlay StatsOverlay InfoToast; do
  mv "$SRC/components/$f.tsx" "$SRC/widgets/"
done

# ── taskboard ui → page-local ──
mv "$SRC/components/taskboard/KindPicker.tsx" "$SRC/pages/TaskBoard/ui/"
rm -f "$SRC/components/taskboard/kinds.tsx"
rmdir "$SRC/components/taskboard" 2>/dev/null || true
rmdir "$SRC/components" 2>/dev/null || true

# ── delete non-MVP ──
rm -rf "$SRC/offline"
rm -rf "$SRC/quick-capture"
rm -f "$ROOT/src/renderer/quick-capture.html"

echo "Reorganize moves done."
