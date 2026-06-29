// day_shutdown_scheduler.ts — Phase K Wave 15 end-of-day ritual nudge.
//
// At a user-configurable wall-clock time (default 21:00 local), Hone
// posts a quiet "Заверши день — 60 секунд" system notification. Clicking
// it focuses the main window and emits an IPC event the renderer listens
// to; renderer opens the DayShutdownModal which collects 3 textareas
// and submits via SubmitDayShutdown RPC.
//
// Why main owns the timer:
//   - The renderer can sleep / freeze when the window is hidden, and
//     setTimeout drift is unpredictable across OS suspends. Main process
//     timers are honoured by Chromium even when no window is visible.
//   - Notification + click → focus flow is cleanest from main.
//
// Settings persistence:
//   - Local time HH:MM stored at userData/day_shutdown.json. Renderer
//     mutates via IPC.
//   - Default: 21:00. Disable by setting empty / invalid string.

import { app, BrowserWindow, Notification, ipcMain } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const FLAG_FILENAME = 'day_shutdown.json';
const DEFAULT_TIME = '21:00';
const EVENT_OPEN_MODAL = 'day-shutdown:open-modal';

const IPC_GET = 'day-shutdown:get-settings';
const IPC_SET = 'day-shutdown:set-settings';

export interface DayShutdownSettings {
  enabled: boolean;
  // HH:MM in local time. "" when disabled (kept for forward-compat).
  time: string;
}

function flagPath(): string {
  return join(app.getPath('userData'), FLAG_FILENAME);
}

async function readSettings(): Promise<DayShutdownSettings> {
  try {
    const raw = await readFile(flagPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<DayShutdownSettings>;
    return {
      enabled: parsed.enabled !== false,
      time: typeof parsed.time === 'string' && /^\d{1,2}:\d{2}$/.test(parsed.time)
        ? parsed.time
        : DEFAULT_TIME,
    };
  } catch {
    return { enabled: true, time: DEFAULT_TIME };
  }
}

async function writeSettings(state: DayShutdownSettings): Promise<void> {
  const path = flagPath();
  if (!existsSync(dirname(path))) {
    await mkdir(dirname(path), { recursive: true });
  }
  await writeFile(path, JSON.stringify(state), 'utf8');
}

// ── Pure helpers (no electron / fs — easy to unit-test) ──────────────────

// Compute the next firing wall-clock instant for HH:MM in local TZ. If
// today's slot has already passed, schedule for tomorrow.
function nextFiringMs(now: Date, time: string): number {
  const parsed = parseHHMM(time);
  if (!parsed) return Number.POSITIVE_INFINITY;
  const target = new Date(now);
  target.setHours(parsed.hour, parsed.minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

function parseHHMM(time: string): { hour: number; minute: number } | null {
  const [hStr, mStr] = time.split(':');
  const rawHour = Number(hStr);
  const rawMinute = Number(mStr);
  if (!Number.isFinite(rawHour) || !Number.isFinite(rawMinute)) return null;
  return {
    hour: Math.min(23, Math.max(0, rawHour)),
    minute: Math.min(59, Math.max(0, rawMinute)),
  };
}

// ── Notification + focus flow ─────────────────────────────────────────────

let pendingTimer: NodeJS.Timeout | null = null;
let lastFiredYmd = ''; // dedupe per local date — clock changes / focus events shouldn't re-fire.

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function fireNudge(getMainWindow: () => BrowserWindow | null): void {
  if (!Notification.isSupported()) {
    // Headless / unsupported — still send the renderer IPC so a user
    // who happens to be in the app sees the modal next reload.
    pingRenderer(getMainWindow);
    return;
  }
  const today = localYmd(new Date());
  if (lastFiredYmd === today) return;
  lastFiredYmd = today;

  const n = new Notification({
    title: 'Заверши день',
    body: '60 секунд: что сделал, что висит, что важно завтра.',
    silent: false,
  });
  n.on('click', () => pingRenderer(getMainWindow));
  n.show();
  // Also fire the renderer event opportunistically so if the user is
  // already in the app, the modal pops up without requiring the click.
  pingRenderer(getMainWindow);
}

function pingRenderer(getMainWindow: () => BrowserWindow | null): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.send(EVENT_OPEN_MODAL);
}

// ── Scheduler loop ────────────────────────────────────────────────────────

async function scheduleNext(getMainWindow: () => BrowserWindow | null): Promise<void> {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  const settings = await readSettings();
  if (!settings.enabled || !settings.time) return;

  const delay = nextFiringMs(new Date(), settings.time);
  if (!Number.isFinite(delay) || delay <= 0) return;

  // Cap setTimeout to <= 24h. If a user changes their clock or laptop
  // resumes after long sleep, we'll re-schedule via the loop.
  const ms = Math.min(delay, 24 * 60 * 60 * 1000);
  pendingTimer = setTimeout(() => {
    fireNudge(getMainWindow);
    void scheduleNext(getMainWindow);
  }, ms);
}

/**
 * Initialise scheduler. Wire IPC + start the timer. Call once after
 * app.whenReady().
 */
export async function initDayShutdownScheduler(
  getMainWindow: () => BrowserWindow | null,
): Promise<void> {
  registerSettingsIpc(getMainWindow);
  await scheduleNext(getMainWindow);
}

function registerSettingsIpc(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC_GET, async () => {
    const s = await readSettings();
    return s;
  });
  ipcMain.handle(IPC_SET, async (_e, payload: unknown) => {
    const p = (payload ?? {}) as Partial<DayShutdownSettings>;
    const enabled = p.enabled !== false;
    const time =
      typeof p.time === 'string' && /^\d{1,2}:\d{2}$/.test(p.time) ? p.time : DEFAULT_TIME;
    await writeSettings({ enabled, time });
    await scheduleNext(getMainWindow);
  });
}

/** Tear-down hook — call on app.on('will-quit'). */
export function disposeDayShutdownScheduler(): void {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

// Re-export the IPC channel constants so renderer types stay in sync
// without touching @shared/ipc invokeChannels (kept narrow there).
export const DAY_SHUTDOWN_IPC = {
  get: IPC_GET,
  set: IPC_SET,
  eventOpenModal: EVENT_OPEN_MODAL,
} as const;
