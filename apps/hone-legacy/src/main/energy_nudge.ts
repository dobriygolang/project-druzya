// energy_nudge.ts — Phase K Wave 16 soft energy-check nudge.
//
// Каждые 30 минут проверяем: прошло ли >= 3 часов с последнего log'а
// энергии у юзера? Если да — тихая нативная Notification «как энергия
// сейчас?» с click→focus → renderer event `energy-nudge:open-picker`.
// Renderer App.tsx слушает event и навигирует на /energy (или открывает
// EnergyPicker модалкой — детали в renderer).
//
// Quiet hours: 00:00–08:00 local — мы НЕ шлём никаких notifications в
// это окно (юзер либо спит, либо рано встал и не хочет дёргаться).
//
// Why main owns the timer:
//   - Renderer setInterval drift'ит при свернутом окне и suspend'ах OS.
//     Main процесс получает honest setTimeout от Chromium даже когда
//     window hidden.
//   - Auth-token нужен для fetch'а last-log'а — main достаёт его через
//     keychain helper (`loadSession`), ровно как updater.ts.
//
// Settings persistence:
//   - userData/energy_nudge.json: { enabled, intervalHours }.
//   - Default: enabled=true, intervalHours=3.
//   - Renderer mutates via IPC `energy-nudge:get/set-settings`.

import { app, BrowserWindow, Notification, ipcMain } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { loadSession } from './keychain';

const FLAG_FILENAME = 'energy_nudge.json';
const DEFAULT_INTERVAL_HOURS = 3;
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 минут.
const QUIET_START_HOUR = 0; // включительно
const QUIET_END_HOUR = 8; // НЕ включительно

const EVENT_OPEN_PICKER = 'energy-nudge:open-picker';
const IPC_GET = 'energy-nudge:get-settings';
const IPC_SET = 'energy-nudge:set-settings';

export interface EnergyNudgeSettings {
  enabled: boolean;
  intervalHours: number; // >= 1, <= 12.
}

interface EnergyLog {
  id: string;
  level: number;
  note?: string;
  loggedAt: string; // ISO
}

function flagPath(): string {
  return join(app.getPath('userData'), FLAG_FILENAME);
}

async function readSettings(): Promise<EnergyNudgeSettings> {
  try {
    const raw = await readFile(flagPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<EnergyNudgeSettings>;
    const enabled = parsed.enabled !== false;
    const hours =
      typeof parsed.intervalHours === 'number' && parsed.intervalHours >= 1 && parsed.intervalHours <= 12
        ? parsed.intervalHours
        : DEFAULT_INTERVAL_HOURS;
    return { enabled, intervalHours: hours };
  } catch {
    return { enabled: true, intervalHours: DEFAULT_INTERVAL_HOURS };
  }
}

async function writeSettings(state: EnergyNudgeSettings): Promise<void> {
  const path = flagPath();
  if (!existsSync(dirname(path))) {
    await mkdir(dirname(path), { recursive: true });
  }
  await writeFile(path, JSON.stringify(state), 'utf8');
}

// isQuietHour — true если local hour в [QUIET_START_HOUR, QUIET_END_HOUR).
// Default range: 00..08. Юзер может быть и совой, но MVP — фиксированное
// окно; экспозим settings только для enabled+interval.
function isQuietHour(now: Date): boolean {
  const h = now.getHours();
  return h >= QUIET_START_HOUR && h < QUIET_END_HOUR;
}

// fetchLastLog — пингаем backend на /api/v1/hone/energy?days=2 и берём
// самую свежую запись. Возвращаем null если нет токена / запрос упал /
// логов нет. ВНИМАНИЕ: API_BASE передаётся из index.ts (мы не реимпортим
// его константу — она inline'нута без export). Любая failure — silent
// (мы не хотим спамить notification'ами на network outage; просто
// пропускаем tick).
async function fetchLastLoggedAt(apiBase: string): Promise<Date | null> {
  try {
    const session = await loadSession();
    if (!session?.accessToken) return null;
    const url = `${apiBase}/api/v1/hone/energy?days=2`;
    const resp = await fetch(url, {
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { logs?: EnergyLog[] };
    const logs = data.logs ?? [];
    if (logs.length === 0) return null;
    // Backend сортирует DESC по loggedAt — но безопаснее всё равно
    // отсортировать самостоятельно: иначе случайная перестановка в API
    // даст ложный «свежий» log.
    let latest = 0;
    for (const l of logs) {
      const t = Date.parse(l.loggedAt);
      if (!Number.isNaN(t) && t > latest) latest = t;
    }
    if (latest === 0) return null;
    return new Date(latest);
  } catch {
    return null;
  }
}

// ── Notification + focus flow ─────────────────────────────────────────────

let pollTimer: NodeJS.Timeout | null = null;
let lastFiredEpochMs = 0; // дедуп между тиками: если только что firenuli — не повторяем сразу.

function fireNudge(getMainWindow: () => BrowserWindow | null): void {
  if (!Notification.isSupported()) {
    pingRenderer(getMainWindow);
    return;
  }
  const now = Date.now();
  // 2-часовой cooldown между notification'ами: чтобы в случае ошибки
  // backend'а (например, log не дошёл) мы не дёргали юзера каждые 30 мин.
  if (now - lastFiredEpochMs < 2 * 60 * 60 * 1000) {
    return;
  }
  lastFiredEpochMs = now;

  const n = new Notification({
    title: 'Как энергия сейчас?',
    body: '1–5: drained · low · ok · high · peak. Один тап в Hone.',
    silent: true, // тихая нотификация — это soft-nudge, не алерт.
  });
  n.on('click', () => pingRenderer(getMainWindow));
  n.show();
}

function pingRenderer(getMainWindow: () => BrowserWindow | null): void {
  const win = getMainWindow();
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  win.webContents.send(EVENT_OPEN_PICKER);
}

// ── Poll loop ─────────────────────────────────────────────────────────────

async function tick(
  apiBase: string,
  getMainWindow: () => BrowserWindow | null,
): Promise<void> {
  const settings = await readSettings();
  if (!settings.enabled) return;

  const now = new Date();
  if (isQuietHour(now)) return;

  const lastAt = await fetchLastLoggedAt(apiBase);
  // No logs / not signed in — НЕ дёргаем юзера. Логи появятся когда
  // он первый раз залогинит энергию вручную (или ивенту из Settings).
  if (lastAt === null) return;

  const sinceMs = now.getTime() - lastAt.getTime();
  const intervalMs = settings.intervalHours * 60 * 60 * 1000;
  if (sinceMs < intervalMs) return;

  fireNudge(getMainWindow);
}

/**
 * Initialise energy-nudge scheduler. Wire IPC + start polling.
 * Call once after app.whenReady().
 *
 * @param apiBase — same backend host as the renderer fetches (passed
 *   in от index.ts чтобы не дублировать API_BASE resolution).
 */
export async function initEnergyNudgeScheduler(
  apiBase: string,
  getMainWindow: () => BrowserWindow | null,
): Promise<void> {
  registerSettingsIpc();
  // Не стартуем polling если в принципе disabled — сэкономим один fetch.
  // Toggle через IPC рестартит scheduler через separately invocation.
  startPolling(apiBase, getMainWindow);
}

function registerSettingsIpc(): void {
  ipcMain.handle(IPC_GET, async () => readSettings());
  ipcMain.handle(IPC_SET, async (_e, payload: unknown) => {
    const p = (payload ?? {}) as Partial<EnergyNudgeSettings>;
    const enabled = p.enabled !== false;
    const intervalHours =
      typeof p.intervalHours === 'number' && p.intervalHours >= 1 && p.intervalHours <= 12
        ? p.intervalHours
        : DEFAULT_INTERVAL_HOURS;
    await writeSettings({ enabled, intervalHours });
  });
}

function startPolling(
  apiBase: string,
  getMainWindow: () => BrowserWindow | null,
): void {
  if (pollTimer) clearInterval(pollTimer);
  // Первый tick делаем сразу через короткий timeout (даём 60s после старта
  // app — чтобы keychain прогрелся, токен подтянулся). Дальше — каждые
  // POLL_INTERVAL_MS.
  setTimeout(() => {
    void tick(apiBase, getMainWindow);
  }, 60 * 1000);
  pollTimer = setInterval(() => {
    void tick(apiBase, getMainWindow);
  }, POLL_INTERVAL_MS);
}

/** Tear-down hook — call on app.on('will-quit'). */
export function disposeEnergyNudgeScheduler(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Re-export IPC channel names — renderer hard-codes them in
// EnergyNudgeSection (parallel pattern with DAY_SHUTDOWN_IPC).
export const ENERGY_NUDGE_IPC = {
  get: IPC_GET,
  set: IPC_SET,
  eventOpenPicker: EVENT_OPEN_PICKER,
} as const;

// Test-only helpers — exported для unit tests без подключения electron'а.
// `app` mock в Vitest setup'е делает это бесполезным для строгих тестов,
// но pure helpers стоит держать testable.
export const __internal = {
  isQuietHour,
};
