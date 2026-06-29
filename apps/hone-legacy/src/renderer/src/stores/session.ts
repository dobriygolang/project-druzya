// session.ts — auth store с keychain-bootstrap'ом.
//
// Поведение на mount: hydrate() читает session из main-process через
// IPC bridge (window.hone.auth.session), main-process в свою очередь
// расшифровывает файл safeStorage'ом. На login deep-link — main-process
// шлёт authChanged event, мы persist'им в keychain и ставим в store.
//
// Pre-mount → state = { status: 'unknown' } чтобы UI не флипал между
// «not signed in» и «signed in» во время restore.
import { create } from 'zustand';

type AuthStatus = 'unknown' | 'guest' | 'signed_in';

// Browser-mode dev fallback persistence. В Electron production session
// идёт через safeStorage keychain (main-process IPC). В Vite browser-mode
// IPC bridge nil → reload terять токен. Persist в localStorage чтобы
// dev-flow (LoginScreen DEV LOGIN button) survived page reload.
//
// Production safe: ключи под BROWSER_PERSIST_KEY namespace; Electron
// instance bridge'ом приходит сильнее (main-keychain) и localStorage
// шумом не используется.
const BROWSER_PERSIST_KEY = 'hone:dev-session:v1';

interface PersistedSession {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

function readBrowserPersist(): PersistedSession | null {
  try {
    const raw = window.localStorage.getItem(BROWSER_PERSIST_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<PersistedSession>;
    if (!s.userId || !s.accessToken) return null;
    if (s.expiresAt && s.expiresAt > 0 && Date.now() > s.expiresAt) return null;
    return {
      userId: s.userId,
      accessToken: s.accessToken,
      refreshToken: s.refreshToken ?? null,
      expiresAt: s.expiresAt ?? 0,
    };
  } catch {
    return null;
  }
}

function writeBrowserPersist(s: PersistedSession): void {
  try {
    window.localStorage.setItem(BROWSER_PERSIST_KEY, JSON.stringify(s));
  } catch {
    /* quota / privacy mode → skip */
  }
}

function clearBrowserPersist(): void {
  try {
    window.localStorage.removeItem(BROWSER_PERSIST_KEY);
  } catch {
    /* ignore */
  }
}

interface SessionState {
  status: AuthStatus;
  userId: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number;

  /** Bootstrap on app mount — reads from keychain via preload. */
  bootstrap: () => Promise<void>;

  /** Called by deep-link handler / login modal after token arrives. */
  hydrate: (s: {
    userId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  }) => void;

  /** Clears in-memory + keychain. Used by logout. */
  clear: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({

  status: 'unknown',
  userId: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,

  bootstrap: async () => {
    const bridge = window.hone;
    if (!bridge) {
      // Browser-only (Vite preview / dev / e2e) — не Electron, нет keychain.
      // Priority: localStorage dev-persist (LoginScreen DEV LOGIN кладёт
      // туда tokens) > VITE_DRUZ9_DEV_TOKEN env > guest.
      const persisted = readBrowserPersist();
      if (persisted) {
        set({
          status: 'signed_in',
          userId: persisted.userId,
          accessToken: persisted.accessToken,
          refreshToken: persisted.refreshToken,
          expiresAt: persisted.expiresAt,
        });
        window.__honeSession = useSessionStore;
        return;
      }
      const devToken = import.meta.env.VITE_DRUZ9_DEV_TOKEN?.trim();
      if (devToken) {
        set({
          status: 'signed_in',
          userId: 'dev-preview-user',
          accessToken: devToken,
          refreshToken: null,
          expiresAt: 0,
        });
        return;
      }
      // Без токена в browser-mode — экспонируем store на window
      // как hatch для preview (eval'нуть useSessionStore из DevTools).
      window.__honeSession = useSessionStore;
      set({ status: 'guest' });
      return;
    }
    try {
      const s = await bridge.auth.session();
      if (s && s.accessToken) {
        // Если access-token уже истёк (по локальному expiresAt) — попытка
        // refresh'нуть его «горячо» через transport interceptor сработает
        // на первом RPC. Но: если ОБА токена expired (e.g. ноут отлежал
        // месяц), interceptor force-clear'ит сессию и App переключится на
        // LoginScreen сам. Доверяем этому flow'у — здесь просто hydrate'им.
        window.__honeSession = useSessionStore;
        set({
          status: 'signed_in',
          userId: s.userId,
          accessToken: s.accessToken,
          refreshToken: s.refreshToken ?? null,
          expiresAt: s.expiresAt ?? 0,
        });
        return;
      }
    } catch {
      /* swallow — keychain may be locked / unavailable */
    }
    // Bridge defined но bridge.auth.session() returned null/empty (Hone
    // Electron в dev — main process не имеет /auth/dev/login flow).
    // Fallback: localStorage dev-persist. Renderer DEV LOGIN button пишет
    // туда, bootstrap читает на reload. Production-safe: TG-flow в main
    // переписывает localStorage value при authChanged event.
    const persisted = readBrowserPersist();
    if (persisted) {
      window.__honeSession = useSessionStore;
      set({
        status: 'signed_in',
        userId: persisted.userId,
        accessToken: persisted.accessToken,
        refreshToken: persisted.refreshToken,
        expiresAt: persisted.expiresAt,
      });
      return;
    }
    set({ status: 'guest' });
  },

  hydrate: ({ userId, accessToken, refreshToken, expiresAt }) => {
    set({
      status: 'signed_in',
      userId,
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiresAt ?? 0,
    });
    // Persist в localStorage всегда — survives page reload в обеих средах.
    // Hone Electron: bridge.auth.session() returns null в dev (main-process
    // не имеет dev/login flow), fallback в bootstrap читает отсюда.
    // Production TG-flow: main bridge будет overwrite через authChanged event.
    writeBrowserPersist({
      userId,
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt: expiresAt ?? 0,
    });
  },

  clear: async () => {
    const bridge = window.hone;
    if (bridge) {
      try {
        await bridge.auth.logout();
      } catch {
        /* ignore */
      }
    } else {
      clearBrowserPersist();
    }
    set({ status: 'guest', userId: null, accessToken: null, refreshToken: null, expiresAt: 0 });
  },
}));
