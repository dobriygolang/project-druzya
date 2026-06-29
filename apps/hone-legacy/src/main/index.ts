// Main-process entry for Hone.
//
// Owns: single BrowserWindow, druz9:// protocol handling, encrypted
// auth-session persistence, pomodoro snapshot persistence. Тонкий слой
// — все продуктовые решения остаются в renderer'е.
//
// Auth flow:
//   1. Renderer без accessToken показывает LoginScreen.
//   2. Click «Sign in» → открыть в браузере
//      `https://druz9.ru/login?desktop=druz9://auth`.
//   3. Web после успешного OAuth callback'а проверяет ?desktop=...
//      и редиректит туда с access_token + refresh_token + user_id.
//   4. macOS/Windows OS триггерит open-url / second-instance с
//      druz9://auth?token=...&refresh=...&user=...
//   5. routeDeepLink парсит, шлёт в renderer через authChanged event,
//      также сохраняет в keychain через safeStorage.
//
// Deep-link routes:
//   druz9://auth?token=...&refresh=...&user=...&exp=ms
//   druz9://focus/start?task=<plan-item-id>&title=<urlenc-title>
//   druz9://focus  (free-form focus, без plan-item)
//
// Любой URL не из этих — forward'им в renderer как generic event,
// renderer решает что делать (или ignore).

import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, shell } from 'electron';
import { init as sentryInit, IPCMode } from '@sentry/electron/main';
import { join } from 'node:path';

import {
  eventChannels,
  invokeChannels,
  type AuthSession,
  type TelegramPollResult,
  type TelegramStart,
} from '@shared/ipc';
import { clearSession, loadSession, saveSession } from './keychain';
import { clearVaultPassphrase, loadVaultPassphrase, saveVaultPassphrase } from './vaultKeychain';
import { loadPomodoro, savePomodoro } from './pomodoro_store';
import { quitAndInstall, startPeriodicCheck, wireUpdater } from './updater';
// Phase K Wave 15 — Quick Capture global hotkey + End-of-day shutdown ritual.
import { initQuickCapture, disposeQuickCapture } from './quick_capture';
import { initDayShutdownScheduler, disposeDayShutdownScheduler } from './day_shutdown_scheduler';
// Phase K Wave 16 — soft energy-check nudge every 3 hours (quiet 00-08).
import { initEnergyNudgeScheduler, disposeEnergyNudgeScheduler } from './energy_nudge';
import { parseDeepLink, dispatchIntent } from './auth/deeplink';
import { runFocusShortcut } from './focus_mode';

// Backend host. Main can't import the renderer alias due to electron-vite's
// split bundles, so we duplicate the resolution logic here.
//   - Dev (npm run dev → !app.isPackaged): http://localhost:8080.
//   - Prod (.app/.dmg): https://druz9.online.
//   - Override через HONE_API_BASE env (для staging / удалённого dev).
const API_BASE =
  (process.env.HONE_API_BASE?.trim()) ||
  (app.isPackaged ? 'https://druz9.online' : 'http://localhost:8080');

// Sentry: main-process handler. DSN приходит из env (HONE_SENTRY_DSN) в
// prod-билде через electron-builder config; пустая DSN → no-op, что
// позволяет разработчику запускать dev без внешних зависимостей.
const sentryDSN = process.env.HONE_SENTRY_DSN ?? '';
if (sentryDSN) {
  sentryInit({
    dsn: sentryDSN,
    release: `hone@${app.getVersion()}`,
    environment: process.env.NODE_ENV ?? 'production',
    // Sampling: 100% crashes main-process'а (их мало, каждый важен),
    // 10% renderer'а — ограничено инициализацией в renderer/index.tsx.
    tracesSampleRate: 0,
    // IPC mode = Classic заставляет renderer общаться с main через preload
    // ipcRenderer, а не через custom `sentry-ipc://` protocol scheme. Default
    // (Both) fallback'ит на protocol если preload не сконфигурирован, и
    // тогда CSP/Chromium ругается «URL scheme sentry-ipc not supported».
    // Classic избегает scheme registration целиком — нативный IPC bus.
    ipcMode: IPCMode.Classic,
  });
}

// druz9:// scheme registration.
//
// Production (.app): app.setAsDefaultProtocolClient('druz9') — Electron
// сам резолвит через bundle Info.plist + LSHandlers. Tests: dmg-installed
// .app получает druz9-deeplink'и из любого app-launcher'а.
//
// Dev (`npm run dev` или electron-vite dev): по умолчанию `process.argv[1]`
// = relative `.` или путь к main-script'у. Если зарегистрировать с
// relative path'ом, macOS LSHandlers сохранит его как-есть; при
// cold-start через deeplink из ДРУГОГО приложения CWD будет другая,
// `.` укажет в node_modules/electron/dist — Electron запустится без
// app path и покажет default splash «To run a local app, execute…».
// Решение: конвертить argv[1] в абсолютный путь до registration'а.
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    // Resolve относительный path к main-script'у в абсолютный относительно
    // текущего CWD (= project root при npm run dev). После этого LSHandlers
    // сохранит «электрон-binary <abs-script-path>», и cold-start из
    // любой CWD работает корректно.
    const path = require('node:path') as typeof import('node:path');
    const absScript = path.resolve(process.argv[1]!);
    app.setAsDefaultProtocolClient('druz9', process.execPath, [absScript]);
  }
} else {
  app.setAsDefaultProtocolClient('druz9');
}

// Single-instance lock: when the user clicks a druz9:// link from the
// browser while Hone is already running, the OS spawns a second process
// and then hands the URL to the first via the `second-instance` event.
// Without the lock the URL would simply open a new window and nothing
// would route.
//
// DEV CAVEAT: raw Electron.app shares the com.github.electron bundle id
// with every other dev Electron session — skip the lock under
// electron-vite.
if (!process.env.ELECTRON_RENDERER_URL) {
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    process.exit(0);
  }
}

app.setName('Hone');
if (process.platform === 'darwin') {
  app.setAboutPanelOptions({
    applicationName: 'Hone',
    applicationVersion: app.getVersion(),
  });
  // Dock icon в dev-mode. В prod-сборке Electron сам подхватит .icns
  // через electron-builder mac.icon, в dev — Electron-default'ный
  // generic logo торчит в Dock пока ты не выставишь явно. setIcon на
  // dock — стандартный workaround.
  // app.dock?.setIcon — проверяем наличие, чтобы не упасть на не-darwin
  // (linter не знает что мы под if process.platform === 'darwin').
  try {
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'icon.png')
      : join(__dirname, '../../resources/icon.png');
    app.dock?.setIcon(iconPath);
  } catch {
    // icon.png отсутствует — fallback на Electron default; не блокируем boot.
  }
}

let mainWindow: BrowserWindow | null = null;

// Phase 2.5 — macOS menubar tray. Renderer pushes a compact status
// title via IPC (tray:update) — focus timer, pinned-task short label
// — and the icon stays clickable to summon / dismiss the main window.
let tray: Tray | null = null;

function createTray(): Tray {
  // 16×16 PNG; macOS scales up for retina automatically. We reuse the
  // app icon at small size; if missing in dev we fall back to an empty
  // image (text-only tray entry, still functional).
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png');
  let img: Electron.NativeImage;
  try {
    img = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    img = nativeImage.createEmpty();
  }
  // On macOS, marking the image as "template" makes it adapt to dark
  // / light menubar colour automatically.
  if (process.platform === 'darwin') {
    img.setTemplateImage(true);
  }
  const t = new Tray(img);
  t.setToolTip('Hone');
  t.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Hone', click: () => showMainWindow() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
  // Left-click toggles the window (show + focus, or hide if already
  // focused). Mirrors how Things 3 / Linear menubar agents behave.
  t.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      showMainWindow();
      return;
    }
    if (mainWindow.isVisible() && mainWindow.isFocused()) {
      mainWindow.hide();
    } else {
      showMainWindow();
    }
  });
  return t;
}

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function createMainWindow(): BrowserWindow {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png');
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 620,
    backgroundColor: '#000000',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Traffic lights видимы всегда (macOS standard). Старый hover-trick
  // (TrafficLightsHover.tsx → IPC trafficLightsShow) создавал «где же
  // кнопки?» momentum — friction выше benefit'а от cleaner look.
  // Если в будущем понадобится hide-on-hover, использовать IPC handler
  // ниже (он всё ещё wired).

  win.once('ready-to-show', () => win.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
  });

  // Route external links to the system browser so users don't get
  // stuck in an in-app webview.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// pendingDeepLink — URL пришёл до того как окно создалось / готово.
// Сохраняем и доставим после ready-to-show.
let pendingDeepLink: string | null = null;

// dispatchDeepLink — thin wrapper over the auth/deeplink intent router.
function dispatchDeepLink(url: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingDeepLink = url;
    return;
  }
  const intent = parseDeepLink(url);
  if (!intent) return;
  void dispatchIntent(intent, { window: mainWindow });
}

app.on('second-instance', (_event, argv) => {
  const url = argv.find((a) => a.startsWith('druz9://'));
  if (url) dispatchDeepLink(url);
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// macOS: the OS delivers druz9:// links here when Hone is already running.
app.on('open-url', (event, url) => {
  event.preventDefault();
  dispatchDeepLink(url);
});

// При cold-start с deep-link'ом argv содержит URL — обработаем после
// того как окно готово.
function consumeColdStartURL(): void {
  const url = process.argv.find((a) => a.startsWith('druz9://'));
  if (url) pendingDeepLink = url;
}

function registerAuthHandlers(): void {
  ipcMain.handle(invokeChannels.authSession, async () => {
    return await loadSession();
  });

  ipcMain.handle(invokeChannels.authPersist, async (_e, session: AuthSession) => {
    await saveSession(session);
  });

  ipcMain.handle(invokeChannels.authLogout, async () => {
    await clearSession();
    // Logout всегда чистит и vault — иначе следующий юзер на этом
    // ноуте получит unlock'ed vault предыдущего юзера.
    await clearVaultPassphrase();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(eventChannels.authChanged, null);
    }
  });

  // Telegram code-flow IPC. Direct fetch to the backend — no /login web hop,
  // no druz9:// redirect dance. Replaces the historical LoginScreen flow that
  // depended on browser → custom-scheme handover (which Chrome blocks from
  // async contexts and which silently no-ops in dev when LaunchServices has
  // not registered the protocol).
  ipcMain.handle(invokeChannels.authTgStart, async (): Promise<TelegramStart> => {
    const res = await fetch(`${API_BASE}/api/v1/auth/telegram/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`telegram/start ${res.status}: ${text}`);
    }
    const body = (await res.json()) as { code: string; deep_link: string; expires_at: string };
    return { code: body.code, deepLink: body.deep_link, expiresAt: body.expires_at };
  });

  ipcMain.handle(
    invokeChannels.authTgPoll,
    async (_e, code: string): Promise<TelegramPollResult> => {
      let res: Response;
      try {
        res = await fetch(`${API_BASE}/api/v1/auth/telegram/poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
      } catch (e) {
        return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
      }
      if (res.status === 202) return { kind: 'pending' };
      if (res.status === 410) return { kind: 'expired' };
      if (res.status === 429) {
        const retry = Number(res.headers.get('Retry-After') ?? '60');
        return { kind: 'rate_limited', retryAfter: Number.isFinite(retry) ? retry : 60 };
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { kind: 'error', message: `poll ${res.status}: ${text}` };
      }
      const body = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        user?: { id?: string };
        is_new_user?: boolean;
      };
      const refresh = body.refresh_token ?? res.headers.get('X-Refresh-Token') ?? '';
      const session: AuthSession = {
        userId: body.user?.id ?? '',
        accessToken: body.access_token,
        refreshToken: refresh,
        expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : 0,
      };
      // Persist + broadcast so the renderer's session store hydrates without
      // the legacy druz9:// round-trip.
      await saveSession(session).catch(() => {
        // Keychain failure is non-fatal — session still flows to renderer.
      });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(eventChannels.authChanged, session);
      }
      return { kind: 'ok', session, isNewUser: Boolean(body.is_new_user) };
    },
  );
}

function registerVaultHandlers(): void {
  ipcMain.handle(invokeChannels.vaultPassLoad, async () => {
    return await loadVaultPassphrase();
  });
  ipcMain.handle(invokeChannels.vaultPassSave, async (_e, passphrase: string) => {
    await saveVaultPassphrase(passphrase);
  });
  ipcMain.handle(invokeChannels.vaultPassClear, async () => {
    await clearVaultPassphrase();
  });
}

function registerPomodoroHandlers(): void {
  ipcMain.handle(invokeChannels.pomodoroLoad, async () => await loadPomodoro());
  ipcMain.handle(invokeChannels.pomodoroSave, async (_e, snap) => {
    await savePomodoro(snap);
  });
}

function registerWindowHandlers(): void {
  ipcMain.handle(invokeChannels.shellOpenExternal, async (_e, url: string) => {
    // Whitelist схем: открываем только http(s) — иначе риск
    // исполнить локальный protocol handler из renderer'а.
    if (url.startsWith('http://') || url.startsWith('https://')) {
      await shell.openExternal(url);
    }
  });

  ipcMain.handle(invokeChannels.updaterInstall, async () => {
    quitAndInstall();
  });

  ipcMain.handle(invokeChannels.trafficLightsShow, async (_e, visible: boolean) => {
    if (process.platform !== 'darwin' || !mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setWindowButtonVisibility(Boolean(visible));
  });

  // Renderer's pomodoro tick / track progress hooks call window.hone.tray.update(...)
  // with a compact title; main updates the macOS menubar entry. No-op on non-darwin
  // platforms (Tray.setTitle is darwin-only).
  ipcMain.handle(
    invokeChannels.trayUpdate,
    async (_e, payload: { title?: string; tooltip?: string }) => {
      if (!tray) return;
      const title = typeof payload?.title === 'string' ? payload.title : '';
      const tooltip = typeof payload?.tooltip === 'string' ? payload.tooltip : '';
      if (process.platform === 'darwin') {
        tray.setTitle(title);
      }
      tray.setToolTip(tooltip || 'Hone');
    },
  );
}

function registerFocusHandlers(): void {
  // Renderer передаёт имя shortcut'а (which the user pre-configured to flip
  // a Focus on/off); мы прокидываем в `shortcuts run "<name>"`. focus_mode.ts
  // само обрабатывает empty name + non-darwin + shortcut-not-found.
  ipcMain.handle(invokeChannels.focusModeStart, async (_e, name: string) => {
    return await runFocusShortcut(typeof name === 'string' ? name : '');
  });
  ipcMain.handle(invokeChannels.focusModeStop, async (_e, name: string) => {
    return await runFocusShortcut(typeof name === 'string' ? name : '');
  });
}

function startBackgroundSchedulers(): void {
  // Async init reads disk flags for enabled state. Failures are non-fatal
  // — the main window already works without these background features.
  initQuickCapture(API_BASE).catch((err) =>
    console.warn('[main] quick-capture init failed:', err),
  );
  initDayShutdownScheduler(() => mainWindow).catch((err) =>
    console.warn('[main] day-shutdown scheduler init failed:', err),
  );
  initEnergyNudgeScheduler(API_BASE, () => mainWindow).catch((err) =>
    console.warn('[main] energy-nudge scheduler init failed:', err),
  );
}

function setupAppReady(): void {
  registerAuthHandlers();
  registerVaultHandlers();
  registerPomodoroHandlers();
  registerWindowHandlers();
  registerFocusHandlers();

  consumeColdStartURL();
  mainWindow = createMainWindow();
  // Menubar agent — created after the window so showMainWindow has
  // something to focus on the very first click.
  tray = createTray();

  wireUpdater(() => mainWindow);
  startPeriodicCheck();
  startBackgroundSchedulers();

  // Доставка отложенного deep-link'а после первого render'а.
  mainWindow.webContents.once('did-finish-load', () => {
    if (pendingDeepLink) {
      const url = pendingDeepLink;
      pendingDeepLink = null;
      dispatchDeepLink(url);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createMainWindow();
  });
}

function setupAppLifecycle(): void {
  app.whenReady().then(setupAppReady).catch((err) => {
    console.error('[main] app.whenReady failed:', err);
  });

  app.on('will-quit', () => {
    // Unregister the global hotkey and tear down pending timers;
    // without this, dev-mode reload leaks shortcuts.
    disposeQuickCapture();
    disposeDayShutdownScheduler();
    disposeEnergyNudgeScheduler();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

setupAppLifecycle();
