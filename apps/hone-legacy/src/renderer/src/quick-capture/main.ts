// quick-capture/main.ts — entry for the global ⌘⇧Space overlay.
//
// Single responsibility: read user input, dispatch save/dismiss intents
// to the Electron main process via window.honeQuickCapture (preload).
// All heavy lifting (fetch into backend with auth token) happens in main
// process — this script stays tiny so the window opens instantly even
// from a cold launch where the main bundle hasn't been parsed yet.

export {}; // ensure this file is treated as a module

declare global {
  interface Window {
    honeQuickCapture?: {
      save: (text: string) => Promise<{ ok: boolean; error?: string }>;
      dismiss: () => Promise<void>;
      getEnabled: () => Promise<boolean>;
      setEnabled: (enabled: boolean) => Promise<void>;
    };
  }
}

const input = document.getElementById('qc-input') as HTMLInputElement | null;
const statusEl = document.getElementById('qc-status') as HTMLElement | null;

if (!input || !statusEl) {
  // Bail loudly — DOM error means the bundle/html got out of sync.
  console.error('[quick-capture] missing DOM nodes');
} else {
  input.focus();
  // Re-focus on blur — without this, the empty-string capture race
  // (window lost focus during typing) silently drops keystrokes.
  input.addEventListener('blur', () => {
    setTimeout(() => input.focus(), 0);
  });

  let submitting = false;

  input.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      void window.honeQuickCapture?.dismiss();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (submitting) return;
      const value = input.value.trim();
      if (!value) {
        // Empty — just dismiss. No need to roundtrip backend.
        void window.honeQuickCapture?.dismiss();
        return;
      }
      submitting = true;
      statusEl.textContent = 'Сохраняю…';
      statusEl.classList.remove('err');
      void window
        .honeQuickCapture!.save(value)
        .then((res) => {
          if (res.ok) {
            // Main hides the window itself on ok; we just wait.
            return;
          }
          submitting = false;
          statusEl.classList.add('err');
          statusEl.textContent = res.error ? `Ошибка: ${res.error}` : 'Не удалось сохранить';
        })
        .catch((err: unknown) => {
          submitting = false;
          statusEl.classList.add('err');
          statusEl.textContent = err instanceof Error ? err.message : 'Не удалось сохранить';
        });
    }
  });
}
