// useGlobalHotkeys — global keyboard listener for Hone hotkeys.
import { useEffect, useRef } from 'react';

import type { PageId } from '@widgets/Palette';
import { HONE_EVENTS } from '@shared/lib/custom-events';

interface GlobalHotkeysDeps {
  page: PageId;
  paletteOpen: boolean;
  statsOpen: boolean;
  setPaletteOpen: (next: (p: boolean) => boolean) => void;
  goHome: () => void;
  openStats: () => void;
  open: (id: PageId) => void;
}

const LETTER_HOTKEYS: Record<string, PageId> = {
  KeyT: 'today',
  KeyN: 'notes',
  Comma: 'settings',
};

export function useGlobalHotkeys(deps: GlobalHotkeysDeps): void {
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

      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        d.setPaletteOpen((p) => !p);
        return;
      }
      if (isMod && e.key.toLowerCase() === 's' && !e.shiftKey && !isText) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(HONE_EVENTS.toggleSidebar));
        return;
      }

      if (e.key === 'Escape') {
        if (d.paletteOpen) {
          d.setPaletteOpen(() => false);
          return;
        }
        if (d.statsOpen) {
          return;
        }
        if (d.page !== 'home') {
          d.goHome();
        }
        return;
      }

      if (isText || d.paletteOpen) return;
      if (isMod || e.altKey) return;

      if (e.code === 'KeyS') {
        if (d.statsOpen) d.goHome();
        else d.openStats();
        return;
      }

      const id = LETTER_HOTKEYS[e.code];
      if (!id) return;
      if (d.page === id) d.goHome();
      else d.open(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
