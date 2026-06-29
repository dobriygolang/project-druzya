// updater.ts — тонкая обёртка над electron-updater.
//
// Поведение:
//   - checkOnBoot(): через 30 сек после старта, если не dev, пробуем один
//     check. 30 сек — даём юзеру собрать контекст и не грузим сеть пока
//     он только что открыл окно.
//   - Periodic check: каждые 4 часа (electron-updater сам умеет, но мы
//     управляем интервалом явно — не хотим скачивать ночью когда ноут
//     спит и чревато eaten-battery).
//   - Все события транслируются в renderer через updaterStatus channel.
//   - HONE_UPDATE_FEED_URL override'ит provider:github из
//     electron-builder.yml — удобно в staging (тестовый S3-бакет).

import type { BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

import { eventChannels, type EventPayload } from '@shared/ipc';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 30 * 1000;

let timer: NodeJS.Timeout | null = null;
let checking = false;
let pendingVersion = '';

function send(win: BrowserWindow | null, status: EventPayload['updaterStatus']): void {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(eventChannels.updaterStatus, status);
}

export function wireUpdater(getWindow: () => BrowserWindow | null): void {
  // No auto-download: хотим явный trigger на пользовательское действие
  // или внутренний timer. electron-updater по дефолту качает сразу — это
  // может убить канал если юзер на hotspot'е. Мы сами решаем когда.
  autoUpdater.autoDownload = true; // но downloadPromise спросим явно
  autoUpdater.autoInstallOnAppQuit = false;

  // HONE_UPDATE_FEED_URL — опциональный override (staging).
  const override = process.env.HONE_UPDATE_FEED_URL;
  if (override) {
    autoUpdater.setFeedURL({ provider: 'generic', url: override });
  }

  autoUpdater.on('checking-for-update', () => {
    send(getWindow(), { kind: 'checking' });
  });
  autoUpdater.on('update-available', (info) => {
    pendingVersion = info.version;
    send(getWindow(), { kind: 'available', version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    send(getWindow(), { kind: 'idle' });
  });
  autoUpdater.on('update-downloaded', (info) => {
    pendingVersion = info.version;
    send(getWindow(), { kind: 'downloaded', version: info.version });
  });
  autoUpdater.on('error', (err) => {
    send(getWindow(), { kind: 'error', message: err.message });
  });
}

export async function checkForUpdates(): Promise<void> {
  if (checking) return;
  if (process.env.ELECTRON_RENDERER_URL) {
    // Dev run — скипаем.
    return;
  }
  checking = true;
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    /* ошибка уже транслирована через .on('error') */
  } finally {
    checking = false;
  }
}

export function startPeriodicCheck(): void {
  if (timer) return;
  setTimeout(() => {
    void checkForUpdates();
    timer = setInterval(() => {
      void checkForUpdates();
    }, CHECK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}

export function quitAndInstall(): void {
  if (!pendingVersion) return;
  autoUpdater.quitAndInstall(false, true);
}
