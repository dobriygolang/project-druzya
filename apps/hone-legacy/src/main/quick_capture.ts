// quick_capture.ts — Phase K Wave 15.
//
// Global hotkey ⌘⇧Space anywhere on the OS → tiny spotlight-style window
// with one input. User types a thought, presses Enter, window closes,
// thought lands in their Hone Inbox folder as a private note.
//
// Why a separate window instead of summoning the main app:
//   - Main window is 1280×840, busy, with Dock + Tray + traffic lights.
//     The "thought I'm losing" UX needs <80ms and zero distractions.
//   - The overlay is frameless / transparent / alwaysOnTop and loads a
//     ~3KB vanilla-JS bundle — no React, no app routes.
//
// Persistence model:
//   - Enabled flag lives in `userData/quick_capture.json` (so it
//     survives logout, mirrors how Mac apps remember Spotlight-style
//     preferences). Default = enabled.
//   - Inbox folder is created on-demand by `ensureInboxFolder` (idempotent
//     via listFolders).
//   - All RPC writes use the session loaded from keychain — main process
//     calls /api/v1/hone/folders + /api/v1/hone/notes with Bearer token.

import { app, BrowserWindow, globalShortcut, ipcMain, screen, shell } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { invokeChannels } from '@shared/ipc';
import { loadSession } from './keychain';

// Persisted user toggle. We deliberately don't reuse localStorage in the
// renderer — main process owns the shortcut registration, and that
// happens before any renderer mounts. Reading from disk on app.ready
// keeps the lifecycle deterministic.
const FLAG_FILENAME = 'quick_capture.json';
const SHORTCUT_ACCELERATOR = 'CommandOrControl+Shift+Space';
const INBOX_FOLDER_NAME = 'Inbox';

interface QuickCaptureState {
  enabled: boolean;
}

function flagPath(): string {
  return join(app.getPath('userData'), FLAG_FILENAME);
}

async function readState(): Promise<QuickCaptureState> {
  try {
    const raw = await readFile(flagPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<QuickCaptureState>;
    return { enabled: parsed.enabled !== false };
  } catch {
    // Missing / corrupt → default on.
    return { enabled: true };
  }
}

async function writeState(state: QuickCaptureState): Promise<void> {
  const path = flagPath();
  if (!existsSync(dirname(path))) {
    await mkdir(dirname(path), { recursive: true });
  }
  await writeFile(path, JSON.stringify(state), 'utf8');
}

// ── Inbox folder discovery / creation ────────────────────────────────────

interface FolderRow {
  id?: string;
  name?: string;
  parent_id?: string;
}

let cachedInboxFolderId: string | null = null;

async function fetchAuthHeaders(apiBase: string): Promise<Record<string, string>> {
  const session = await loadSession();
  if (!session?.accessToken) {
    throw new Error('not_signed_in');
  }
  return {
    Authorization: `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
    'X-Hone-Source': 'quick-capture',
    'X-Api-Base': apiBase,
  };
}

async function listFolders(apiBase: string): Promise<FolderRow[]> {
  const headers = await fetchAuthHeaders(apiBase);
  const res = await fetch(`${apiBase}/api/v1/hone/folders`, { headers });
  if (!res.ok) {
    throw new Error(`list_folders_${res.status}`);
  }
  const body = (await res.json()) as { folders?: FolderRow[] };
  return body.folders ?? [];
}

async function createFolder(apiBase: string, name: string): Promise<FolderRow> {
  const headers = await fetchAuthHeaders(apiBase);
  const res = await fetch(`${apiBase}/api/v1/hone/folders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(`create_folder_${res.status}`);
  }
  return (await res.json()) as FolderRow;
}

async function ensureInboxFolder(apiBase: string): Promise<string> {
  if (cachedInboxFolderId) return cachedInboxFolderId;
  const folders = await listFolders(apiBase);
  const existing = folders.find((f) => f.name === INBOX_FOLDER_NAME && !f.parent_id);
  if (existing?.id) {
    cachedInboxFolderId = existing.id;
    return existing.id;
  }
  const created = await createFolder(apiBase, INBOX_FOLDER_NAME);
  if (!created.id) {
    throw new Error('create_folder_no_id');
  }
  cachedInboxFolderId = created.id;
  return created.id;
}

async function createInboxNote(apiBase: string, title: string, bodyMd: string): Promise<void> {
  const folderId = await ensureInboxFolder(apiBase);
  const headers = await fetchAuthHeaders(apiBase);
  const res = await fetch(`${apiBase}/api/v1/hone/notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title, body_md: bodyMd, folder_id: folderId }),
  });
  if (!res.ok) {
    throw new Error(`create_note_${res.status}`);
  }
}

// ── Capture window lifecycle ──────────────────────────────────────────────

let captureWindow: BrowserWindow | null = null;

function quickCapturePagePath(): string {
  // electron-vite multi-entry: in dev, vite serves both entries under the
  // same URL prefix; in prod, electron-builder ships them side by side
  // in the renderer dir. ELECTRON_RENDERER_URL is set by electron-vite
  // dev server.
  if (process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}/quick-capture.html`;
  }
  // __dirname в prod указывает в out/main; quick-capture.html лежит в
  // out/renderer (рядом с index.html для main app).
  return join(__dirname, '../renderer/quick-capture.html');
}

function showCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.show();
    captureWindow.focus();
    return;
  }

  const primary = screen.getPrimaryDisplay();
  const width = 480;
  const height = 110;
  const x = Math.round(primary.workArea.x + (primary.workArea.width - width) / 2);
  // Position the overlay in the upper third — feels less obtrusive
  // than dead-centre and matches Spotlight's classic placement.
  const y = Math.round(primary.workArea.y + primary.workArea.height * 0.22);

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Visible across spaces / on top of fullscreen apps — matches user's
  // expectation of «press hotkey, see input no matter what's foreground».
  if (process.platform === 'darwin') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // Auto-dismiss on blur (clicked outside) — mirrors Spotlight UX.
  win.on('blur', () => {
    if (!win.isDestroyed()) win.hide();
  });

  win.on('closed', () => {
    if (captureWindow === win) captureWindow = null;
  });

  // External links — if user pastes a URL we let them open it manually
  // later from the Note; don't open in an in-window webview.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const target = quickCapturePagePath();
  if (target.startsWith('http://') || target.startsWith('https://')) {
    void win.loadURL(target);
  } else {
    void win.loadFile(target);
  }

  captureWindow = win;
}

function hideCaptureWindow(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.hide();
  }
}

// ── Public lifecycle ──────────────────────────────────────────────────────

/**
 * Initialise quick-capture: registers IPC handlers, hooks the global
 * shortcut iff enabled. Call once after app.whenReady() and BEFORE the
 * main BrowserWindow is created (so the shortcut is live early — feels
 * faster on cold launch).
 *
 * apiBase: backend host the main process uses for note RPCs.
 */
export async function initQuickCapture(apiBase: string): Promise<void> {
  registerCaptureIpc(apiBase);

  // Register shortcut on boot if user has it enabled (or never toggled).
  const state = await readState();
  if (state.enabled) {
    registerShortcut();
  }
}

// They no-op until session + folder ready.
function registerCaptureIpc(apiBase: string): void {
  ipcMain.handle(invokeChannels.quickCaptureSave, async (_e, text: unknown) => {
    const value = typeof text === 'string' ? text.trim() : '';
    if (!value) {
      return { ok: false, error: 'пусто' };
    }
    try {
      const title = value.length > 40 ? value.slice(0, 40) : value;
      const body = `#inbox\n\n${value}\n`;
      await createInboxNote(apiBase, title, body);
      // Hide on success; renderer не должен пытаться сам hide'ить — main
      // владеет окном.
      hideCaptureWindow();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(invokeChannels.quickCaptureDismiss, async () => {
    hideCaptureWindow();
  });

  ipcMain.handle(invokeChannels.quickCaptureGetEnabled, async () => {
    const state = await readState();
    return state.enabled;
  });

  ipcMain.handle(invokeChannels.quickCaptureSetEnabled, async (_e, enabled: unknown) => {
    const flag = enabled !== false;
    await writeState({ enabled: flag });
    if (flag) {
      registerShortcut();
    } else {
      unregisterShortcut();
    }
  });
}

function registerShortcut(): void {
  if (globalShortcut.isRegistered(SHORTCUT_ACCELERATOR)) return;
  const ok = globalShortcut.register(SHORTCUT_ACCELERATOR, () => {
    // Toggle: if window is already visible & focused, hide it (avoid
    // accidental re-trigger swallowing user keystrokes). Otherwise show.
    if (captureWindow && !captureWindow.isDestroyed() && captureWindow.isVisible()) {
      hideCaptureWindow();
    } else {
      showCaptureWindow();
    }
  });
  if (!ok) {
    // Likely another app owns the accelerator — log + continue. We
    // surface this passively (no toast) because the failure is rare
    // and the user can still capture by switching to Hone manually.
    console.warn(`[quick-capture] globalShortcut.register(${SHORTCUT_ACCELERATOR}) returned false`);
  }
}

function unregisterShortcut(): void {
  if (globalShortcut.isRegistered(SHORTCUT_ACCELERATOR)) {
    globalShortcut.unregister(SHORTCUT_ACCELERATOR);
  }
}

/** Tear-down hook — call on app.on('will-quit'). */
export function disposeQuickCapture(): void {
  unregisterShortcut();
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.close();
  }
  captureWindow = null;
}
