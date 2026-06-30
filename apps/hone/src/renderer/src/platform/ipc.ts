// Shared IPC types — narrow surface for the Hone MVP Tauri shell.

export const eventChannels = {
  deepLink: 'app:deep-link',
  authChanged: 'auth:changed',
} as const;

export interface HoneAPI {
  auth: {
    session: () => Promise<AuthSession | null>;
    persist: (s: AuthSession) => Promise<void>;
    logout: () => Promise<void>;
    tgStart: () => Promise<TelegramStart>;
    tgPoll: (code: string) => Promise<TelegramPollResult>;
    config: () => Promise<{ telegram_bot_username: string }>;
    telegram: (code: string) => Promise<AuthSession>;
  };
  pomodoro: {
    load: () => Promise<PomodoroSnapshot | null>;
    save: (s: PomodoroSnapshot) => Promise<void>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  window: {
    setTrafficLights: (visible: boolean) => Promise<void>;
  };
  tray: {
    update: (title: string, tooltip: string) => Promise<void>;
  };
  vault?: {
    passLoad: (userId: string) => Promise<string | null>;
    passSave: (userId: string, passphrase: string) => Promise<void>;
    passClear: (userId: string) => Promise<void>;
  };
  on: <K extends keyof typeof eventChannels>(
    channel: K,
    listener: (payload: EventPayload[K]) => void,
  ) => () => void;
}

export interface TelegramStart {
  code: string;
  deepLink: string;
  expiresAt: string;
}

export type TelegramPollResult =
  | { kind: 'ok'; session: AuthSession; isNewUser: boolean }
  | { kind: 'pending' }
  | { kind: 'expired' }
  | { kind: 'rate_limited'; retryAfter: number }
  | { kind: 'error'; message: string };

export interface AuthSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface PomodoroSnapshot {
  remainSec: number;
  running: boolean;
  savedAt: number;
  mode?: 'pomodoro' | 'stopwatch';
}

export interface EventPayload {
  deepLink: { url: string };
  authChanged: AuthSession | null;
}
