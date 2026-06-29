// Preload — runs in a privileged context with partial Node access and
// exposes a narrow, typed API to the renderer via contextBridge.
//
// Rule: every method here is a thin ipcRenderer wrapper, no business
// logic. Phase 5b expanded the surface to include keychain-backed auth
// (persist + logout), pomodoro snapshots, and an external-shell hatch
// for the OAuth redirect flow.

import { contextBridge, ipcRenderer } from 'electron';

import {
  eventChannels,
  invokeChannels,
  type AuthSession,
  type FocusModeResult,
  type HoneAPI,
  type PomodoroSnapshot,
  type TelegramPollResult,
  type TelegramStart,
} from '@shared/ipc';

const api: HoneAPI = {
  auth: {
    session: () =>
      ipcRenderer.invoke(invokeChannels.authSession) as Promise<AuthSession | null>,
    persist: (s: AuthSession) =>
      ipcRenderer.invoke(invokeChannels.authPersist, s) as Promise<void>,
    logout: () => ipcRenderer.invoke(invokeChannels.authLogout) as Promise<void>,
    tgStart: () =>
      ipcRenderer.invoke(invokeChannels.authTgStart) as Promise<TelegramStart>,
    tgPoll: (code: string) =>
      ipcRenderer.invoke(invokeChannels.authTgPoll, code) as Promise<TelegramPollResult>,
  },
  pomodoro: {
    load: () =>
      ipcRenderer.invoke(invokeChannels.pomodoroLoad) as Promise<PomodoroSnapshot | null>,
    save: (s: PomodoroSnapshot) =>
      ipcRenderer.invoke(invokeChannels.pomodoroSave, s) as Promise<void>,
  },
  shell: {
    openExternal: (url: string) =>
      ipcRenderer.invoke(invokeChannels.shellOpenExternal, url) as Promise<void>,
  },
  updater: {
    install: () => ipcRenderer.invoke(invokeChannels.updaterInstall) as Promise<void>,
  },
  window: {
    setTrafficLights: (visible: boolean) =>
      ipcRenderer.invoke(invokeChannels.trafficLightsShow, visible) as Promise<void>,
  },
  tray: {
    // Phase 2.5 — push a compact status to the macOS menubar tray.
    // title  — "25:00" / "Focus 12:34" / "" to clear.
    // tooltip — longer hover text (pinned task name, track step).
    update: (title: string, tooltip: string) =>
      ipcRenderer.invoke(invokeChannels.trayUpdate, { title, tooltip }) as Promise<void>,
  },
  focusMode: {
    // Phase K Wave 15 — `shortcuts run "<name>"` через child_process.exec
    // в main процессе. Возвращает { ok: false, error: '…' } если шорткат
    // не найден / OS не darwin / имя пустое. UI решает что показать.
    start: (name: string) =>
      ipcRenderer.invoke(invokeChannels.focusModeStart, name) as Promise<FocusModeResult>,
    stop: (name: string) =>
      ipcRenderer.invoke(invokeChannels.focusModeStop, name) as Promise<FocusModeResult>,
  },
  vault: {
    passLoad: () =>
      ipcRenderer.invoke(invokeChannels.vaultPassLoad) as Promise<string | null>,
    passSave: (passphrase: string) =>
      ipcRenderer.invoke(invokeChannels.vaultPassSave, passphrase) as Promise<void>,
    passClear: () =>
      ipcRenderer.invoke(invokeChannels.vaultPassClear) as Promise<void>,
  },
  on: (channel, listener) => {
    const wire = eventChannels[channel];
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      listener(payload as never);
    };
    ipcRenderer.on(wire, handler);
    return () => ipcRenderer.off(wire, handler);
  },
};

contextBridge.exposeInMainWorld('hone', api);

// ── Phase K Wave 15 — Quick Capture overlay window. Tiny IPC surface
// exposed to BOTH the main app window (Settings toggle) and the
// quick-capture overlay window. Keeping it on `window.honeQuickCapture`
// rather than nested in `window.hone.*` so the overlay's minimal
// vanilla-JS module can call it without type acrobatics, and so it
// doesn't break the `HoneAPI` interface contract for the main app.
// ── Phase K Wave 15 — narrow IPC proxy for settings channels that don't
// fit the strict HoneAPI shape (DayShutdownSection's time/enabled
// settings). Whitelist of allowed channels — DO NOT expand to generic
// invoke without auditing — passing arbitrary channels would let
// renderer escape the typed HoneAPI surface.
const DAY_SHUTDOWN_GET = 'day-shutdown:get-settings';
const DAY_SHUTDOWN_SET = 'day-shutdown:set-settings';
// Phase K Wave 16 — energy nudge: per-user 3h soft check настройка + event
// open-picker когда юзер кликает по нативной нотификации.
const ENERGY_NUDGE_GET = 'energy-nudge:get-settings';
const ENERGY_NUDGE_SET = 'energy-nudge:set-settings';
const ALLOWED_INVOKE_CHANNELS = new Set<string>([
  DAY_SHUTDOWN_GET,
  DAY_SHUTDOWN_SET,
  ENERGY_NUDGE_GET,
  ENERGY_NUDGE_SET,
]);
const ALLOWED_EVENT_CHANNELS = new Set<string>([
  'day-shutdown:open-modal',
  'energy-nudge:open-picker',
]);
contextBridge.exposeInMainWorld('__honeIPC', {
  invoke: (channel: string, ...args: unknown[]) => {
    if (!ALLOWED_INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`[__honeIPC] channel not allowed: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },
  on: (channel: string, listener: (...args: unknown[]) => void) => {
    if (!ALLOWED_EVENT_CHANNELS.has(channel)) {
      throw new Error(`[__honeIPC] channel not allowed: ${channel}`);
    }
    const handler = (_e: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.off(channel, handler);
  },
});

contextBridge.exposeInMainWorld('honeQuickCapture', {
  /** Save a captured thought. Returns { ok, error? }. */
  save: (text: string) =>
    ipcRenderer.invoke(invokeChannels.quickCaptureSave, text) as Promise<{
      ok: boolean;
      error?: string;
    }>,
  /** Dismiss the overlay without saving. */
  dismiss: () => ipcRenderer.invoke(invokeChannels.quickCaptureDismiss) as Promise<void>,
  /** Read the persisted "enabled" flag (Settings toggle). */
  getEnabled: () =>
    ipcRenderer.invoke(invokeChannels.quickCaptureGetEnabled) as Promise<boolean>,
  /** Toggle the global shortcut on/off. */
  setEnabled: (enabled: boolean) =>
    ipcRenderer.invoke(invokeChannels.quickCaptureSetEnabled, enabled) as Promise<void>,
});
