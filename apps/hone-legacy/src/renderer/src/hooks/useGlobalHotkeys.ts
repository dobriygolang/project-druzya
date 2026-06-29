// useGlobalHotkeys — global keyboard listener для Hone hotkeys.
//
// ⌘K — toggle command palette.
// ⌘S (без shift) — broadcast `hone:toggle-sidebar` (Notes/Editor/Boards
//      слушают и сворачивают свою sidebar'у).
// Esc — закрывает первую открытую модалку или возвращает на home.
// Plain letters (T/N/L/S/Y/Comma) — page navigation toggle.
//
// e.code (физический keycode) используется вместо e.key — чтобы работать
// на русской и английской раскладках одинаково. Все Cmd/Ctrl/Alt комбинации
// (кроме ⌘K и ⌘S) пропускаются — browser default'ы (copy, paste и т.д.).
//
// Hotkeys disabled когда: фокус в input/textarea/contentEditable, palette
// открыта, или onboarding открыт.
import { useEffect, useRef } from 'react';

import type { PageId } from '../components/Palette';
import { openWebLiveRoom } from '../lib/cross-app-links';
import { HONE_EVENTS } from '../lib/custom-events';

interface GlobalHotkeysDeps {
  page: PageId;
  paletteOpen: boolean;
  onboardingOpen: boolean;
  statsOpen: boolean;

  setPaletteOpen: (next: (p: boolean) => boolean) => void;
  setStatsOpen: (open: boolean) => void;
  dismissOnboarding: () => void;
  goHome: () => void;
  open: (id: PageId) => void;
  openStats: () => void;
}

// ─── Hotkey table ────────────────────────────────────────────────────────

// Single-letter navigation map: KeyboardEvent.code → action. Используем `code`
// (физический keycode) а не `key` — shortcut срабатывает на ru/en layouts
// identically. `'stats'` — overlay (a not a page), special-cased в handler'е.
//
// Actions без toggle (просто запускают side-effect) тоже здесь — keeps
// table flat / scannable. Run-only действия возвращают `'run'` через тип-tag.
type LetterAction =
  | { kind: 'toggle'; id: PageId | 'stats' }
  | { kind: 'run'; run: () => void };

const LETTER_HOTKEYS: Record<string, LetterAction> = {
  KeyT: { kind: 'toggle', id: 'today' },
  KeyN: { kind: 'toggle', id: 'notes' },
  KeyL: { kind: 'run', run: openWebLiveRoom },
  KeyS: { kind: 'toggle', id: 'stats' },
  KeyY: { kind: 'toggle', id: 'schedule' },
  Comma: { kind: 'toggle', id: 'settings' },
};

export function useGlobalHotkeys(deps: GlobalHotkeysDeps): void {
  // Ref pattern: listener регистрируется один раз; latest deps читаются
  // через ref. Без этого closure захватывала бы stale callback identity
  // (open / goHome / etc), а eslint-disable react-hooks/exhaustive-deps
  // лишь маскировал баг.
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = depsRef.current;
      const isMod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isText =
        target !== null &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      // ── Cmd/Ctrl combos ────────────────────────────────────────────────
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        d.setPaletteOpen((p) => !p);
        return;
      }
      // ⌘S — global sidebar toggle. Каждая страница (Notes / Editor /
      // SharedBoards) слушает `hone:toggle-sidebar` и сворачивает свою
      // sidebar'у. В text input ⌘S reserved для browser save — пропускаем.
      if (isMod && e.key.toLowerCase() === 's' && !e.shiftKey && !isText) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(HONE_EVENTS.toggleSidebar));
        return;
      }
      // Copilot ⌘⇧Space hotkey удалён по просьбе юзера — UI не используется.

      // ── Escape ─────────────────────────────────────────────────────────
      if (e.key === 'Escape') {
        if (d.onboardingOpen) {
          d.dismissOnboarding();
          return;
        }
        if (d.paletteOpen) {
          d.setPaletteOpen(() => false);
          return;
        }
        if (d.statsOpen) {
          d.setStatsOpen(false);
          return;
        }
        if (d.page !== 'home') {
          d.goHome();
        }
        return;
      }

      // ── Letter navigation ──────────────────────────────────────────────
      // Hotkey-nav должна работать через overlays — open сам закроет
      // stats overlay при переключении.
      if (isText || d.paletteOpen || d.onboardingOpen) return;

      // КРИТИЧНО: skip ALL letter-navigation когда любой modifier нажат.
      // Letter-shortcuts ТОЛЬКО для plain-key presses (no Cmd/Ctrl/Alt).
      if (isMod || e.altKey) return;

      const action = LETTER_HOTKEYS[e.code];
      if (!action) return;
      if (action.kind === 'run') {
        action.run();
        return;
      }
      // Toggle semantics: pressing the same key while the target is open
      // returns to home — dismiss без ESC или мыши.
      const id = action.id;
      if (id === 'stats') {
        if (d.statsOpen) d.setStatsOpen(false);
        else d.openStats();
        return;
      }
      if (d.page === id) d.goHome();
      else d.open(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
