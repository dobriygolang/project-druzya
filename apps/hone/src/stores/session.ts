import { create } from 'zustand';

import { DEV_BEARER_TOKEN } from '../api/config';

type AuthStatus = 'unknown' | 'guest' | 'signed_in';

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
    /* ignore */
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
  bootstrap: () => Promise<void>;
  hydrate: (s: {
    userId: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
  }) => void;
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
      const persisted = readBrowserPersist();
      if (persisted) {
        set({
          status: 'signed_in',
          userId: persisted.userId,
          accessToken: persisted.accessToken,
          refreshToken: persisted.refreshToken,
          expiresAt: persisted.expiresAt,
        });
        return;
      }
      if (DEV_BEARER_TOKEN) {
        set({
          status: 'signed_in',
          userId: 'dev-preview-user',
          accessToken: DEV_BEARER_TOKEN,
          refreshToken: null,
          expiresAt: 0,
        });
        return;
      }
      set({ status: 'guest' });
      return;
    }

    try {
      const s = await bridge.auth.session();
      if (s?.accessToken) {
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
      /* keychain unavailable */
    }

    const persisted = readBrowserPersist();
    if (persisted) {
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
    set({
      status: 'guest',
      userId: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: 0,
    });
  },
}));
