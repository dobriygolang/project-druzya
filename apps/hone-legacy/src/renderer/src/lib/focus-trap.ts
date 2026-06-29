/**
 * Vanilla focus trap — no deps, ~80 LOC. Used by Modal primitives in all 3 apps.
 *
 * Canonical source: design/src/focus-trap.ts
 * Copied by emit.mjs into:
 *   frontend/src/lib/focus-trap.ts
 *   hone/src/renderer/src/lib/focus-trap.ts
 *   cue/src/renderer/lib/focus-trap.ts
 *
 * Edit the canonical file and run `make tokens` (emit.mjs covers both tokens and shared lib copies).
 *
 * Behavior:
 *  - On creation: focuses first focusable inside container, or container itself (with tabindex=-1).
 *  - Tab/Shift+Tab: wraps within container — focus never escapes.
 *  - release(): removes listener AND restores focus to previously-focused element (if still in DOM).
 */

export interface FocusTrap {
  release(): void;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"]):not([disabled])',
].join(',');

export function createFocusTrap(container: HTMLElement): FocusTrap {
  const previouslyFocused = (document.activeElement as HTMLElement | null) ?? null;

  const getFocusable = (): HTMLElement[] => {
    const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    return candidates.filter((el) => {
      if (el.hasAttribute('inert')) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      // offsetParent === null when display:none or detached; allow if container is the body though.
      return el.offsetParent !== null || el === document.activeElement;
    });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable();
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !container.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };

  const initial = getFocusable();
  if (initial.length > 0) {
    initial[0].focus();
  } else {
    if (!container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1');
    }
    container.focus();
  }

  document.addEventListener('keydown', onKeyDown, true);

  return {
    release() {
      document.removeEventListener('keydown', onKeyDown, true);
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === 'function' &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    },
  };
}
