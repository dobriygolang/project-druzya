/**
 * Tauri implementation of window.hone (formerly Electron preload).
 * Import before React mount so session bootstrap works.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import {
  eventChannels,
  type AuthSession,
  type EventPayload,
  type FocusModeResult,
  type HoneAPI,
  type PomodoroSnapshot,
  type TelegramPollResult,
  type TelegramStart,
} from '@shared/ipc';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function installNativeBridge(): void {
  if (!isTauri() || typeof window === 'undefined') return;
  if (window.hone) return;

  const api: HoneAPI = {
    auth: {
      session: () => invoke<AuthSession | null>('auth_session'),
      persist: (s) => invoke('auth_persist', { session: s }),
      logout: () => invoke('auth_logout'),
      tgStart: () => invoke<TelegramStart>('auth_tg_start'),
      tgPoll: (code) => invoke<TelegramPollResult>('auth_tg_poll', { code }),
    },
    pomodoro: {
      load: () => invoke<PomodoroSnapshot | null>('pomodoro_load'),
      save: (s) => invoke('pomodoro_save', { snapshot: s }),
    },
    shell: {
      openExternal: (url) => invoke('shell_open_external', { url }),
    },
    updater: {
      install: () => invoke('updater_install'),
    },
    window: {
      setTrafficLights: (visible) =>
        invoke('window_traffic_lights_show', { visible }),
    },
    tray: {
      update: (title, tooltip) => invoke('tray_update', { title, tooltip }),
    },
    focusMode: {
      start: (name) => invoke<FocusModeResult>('focus_mode_start', { name }),
      stop: (name) => invoke<FocusModeResult>('focus_mode_stop', { name }),
    },
    vault: {
      passLoad: () => invoke<string | null>('vault_pass_load'),
      passSave: (passphrase) => invoke('vault_pass_save', { passphrase }),
      passClear: () => invoke('vault_pass_clear'),
    },
    on: (channel, listener) => {
      const wire = eventWire(channel);
      let unlisten: UnlistenFn | undefined;
      void listen<unknown>(wire, (ev) => {
        listener(ev.payload as EventPayload[typeof channel]);
      }).then((fn) => {
        unlisten = fn;
      });
      return () => {
        void unlisten?.();
      };
    },
  };

  window.hone = api;

  // Settings helpers (day shutdown, energy nudge) — stub until ported to Rust.
  window.__honeIPC = {
    invoke: () => Promise.reject(new Error('not implemented in Tauri yet')),
    on: () => () => undefined,
  };

  window.honeQuickCapture = {
    save: () => Promise.resolve({ ok: false, error: 'quick capture not wired' }),
    dismiss: () => Promise.resolve(),
    getEnabled: () => Promise.resolve(false),
    setEnabled: () => Promise.resolve(),
  };
}

function eventWire<K extends keyof typeof eventChannels>(
  channel: K,
): string {
  switch (channel) {
    case 'deepLink':
      return 'app:deep-link';
    case 'authChanged':
      return 'auth:changed';
    case 'updaterStatus':
      return 'updater:status';
    case 'cueNoteImport':
      return 'cue:note-import';
    default: {
      const _exhaustive: never = channel;
      return String(_exhaustive);
    }
  }
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}
