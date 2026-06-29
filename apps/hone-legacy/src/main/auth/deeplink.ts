// Centralised druz9:// deeplink parsing + dispatch for Hone main process.
//
//   parseDeepLink(url) — pure URL → typed Intent | null
//   dispatchIntent(intent, ctx) — keychain / filesystem / IPC side-effects

import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import type { BrowserWindow } from 'electron';

import { eventChannels, type AuthSession } from '@shared/ipc';
import { saveSession } from '../keychain';

/** Closed union of recognised intents. Unknown intents return null. */
export type DeepLinkIntent =
  | { kind: 'auth'; session: AuthSession }
  | { kind: 'note.import'; filePath: string; source?: string }
  | { kind: 'focus.start'; goal?: string; mode?: string; duration?: number; task?: string; title?: string; source?: string }
  | { kind: 'task.open'; taskId: string; source?: string }
  | { kind: 'note.open'; noteId: string; source?: string }
  | { kind: 'generic'; url: string };

/** Dispatch context — DI'd from main-process so the router stays testable. */
export interface DispatchContext {
  window: BrowserWindow | null;
}

export function parseDeepLink(raw: string): DeepLinkIntent | null {
  const parsed = parseDeepLinkURL(raw);
  if (!parsed) return null;
  const { url: u, host, route, source } = parsed;

  if (host === 'auth') return parseAuth(u);
  if (route === 'notes/import') return parseNoteImport(u, source);
  if (host === 'focus' || route === 'focus/start' || host === 'focus.start') {
    return parseFocusStart(u, source);
  }
  if (host === 'task.open' || route === 'task/open') return parseTaskOpen(u, source);
  if (host === 'note.open' || route === 'note/open') return parseNoteOpen(u, source);

  return { kind: 'generic', url: raw };
}

interface ParsedURL {
  url: URL;
  host: string;
  route: string;
  source: string | undefined;
}

function parseDeepLinkURL(raw: string): ParsedURL | null {
  if (!raw.startsWith('druz9://')) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'druz9:') return null;
  const host = u.host.toLowerCase();
  const path = u.pathname.replace(/^\/+/, '').toLowerCase();
  const route = path ? `${host}/${path}` : host;
  const source = u.searchParams.get('source') ?? undefined;
  return { url: u, host, route, source };
}

function parseAuth(u: URL): DeepLinkIntent | null {
  const token = u.searchParams.get('token');
  const userId = u.searchParams.get('user');
  if (!token || !userId) return null;
  const session: AuthSession = {
    userId,
    accessToken: token,
    refreshToken: u.searchParams.get('refresh') ?? '',
    expiresAt: Number(u.searchParams.get('exp') ?? 0),
  };
  return { kind: 'auth', session };
}

function parseNoteImport(u: URL, source: string | undefined): DeepLinkIntent | null {
  const encoded = u.searchParams.get('path');
  if (!encoded) return null;
  let filePath: string;
  try {
    filePath = Buffer.from(encoded, 'base64').toString('utf-8');
  } catch {
    return null;
  }
  return { kind: 'note.import', filePath, source };
}

function parseFocusStart(u: URL, source: string | undefined): DeepLinkIntent {
  const duration = parseIntSafe(u.searchParams.get('duration'));
  return {
    kind: 'focus.start',
    goal: u.searchParams.get('goal') ?? undefined,
    mode: u.searchParams.get('mode') ?? undefined,
    duration: duration ?? undefined,
    task: u.searchParams.get('task') ?? undefined,
    title: u.searchParams.get('title') ?? undefined,
    source,
  };
}

function parseTaskOpen(u: URL, source: string | undefined): DeepLinkIntent | null {
  const taskId = u.searchParams.get('id') ?? u.searchParams.get('task');
  if (!taskId) return null;
  return { kind: 'task.open', taskId, source };
}

function parseNoteOpen(u: URL, source: string | undefined): DeepLinkIntent | null {
  const noteId = u.searchParams.get('id') ?? u.searchParams.get('note');
  if (!noteId) return null;
  return { kind: 'note.open', noteId, source };
}

export async function dispatchIntent(intent: DeepLinkIntent, ctx: DispatchContext): Promise<void> {
  const win = ctx.window;
  if (!win || win.isDestroyed()) return;

  switch (intent.kind) {
    case 'auth': {
      try {
        await saveSession(intent.session);
      } catch {
        /* non-fatal */
      }
      win.webContents.send(eventChannels.authChanged, intent.session);
      break;
    }
    case 'note.import': {
      try {
        const raw = await readFile(intent.filePath, 'utf-8');
        const analysis = JSON.parse(raw) as unknown;
        win.webContents.send(eventChannels.cueNoteImport, {
          filePath: intent.filePath,
          analysis,
        });
      } catch {
        win.webContents.send(eventChannels.deepLink, {
          url: `druz9://notes/import?path=${Buffer.from(intent.filePath).toString('base64')}`,
        });
      }
      break;
    }
    case 'focus.start':
    case 'task.open':
    case 'note.open':
    case 'generic': {
      const url = intent.kind === 'generic' ? intent.url : encodeIntent(intent);
      win.webContents.send(eventChannels.deepLink, { url });
      break;
    }
  }

  if (win.isMinimized()) win.restore();
  win.focus();
}

function encodeIntent(intent: DeepLinkIntent): string {
  const params = new URLSearchParams();
  const push = (k: string, v: string | number | undefined): void => {
    if (v === undefined || v === null) return;
    if (typeof v === 'number') {
      if (Number.isFinite(v)) params.set(k, String(v));
      return;
    }
    if (v.length > 0) params.set(k, v);
  };
  switch (intent.kind) {
    case 'focus.start': {
      push('goal', intent.goal);
      push('mode', intent.mode);
      push('duration', intent.duration);
      push('task', intent.task);
      push('title', intent.title);
      push('source', intent.source);
      const qs = params.toString();
      return `druz9://focus.start${qs ? `?${qs}` : ''}`;
    }
    case 'task.open':
      push('id', intent.taskId);
      push('source', intent.source);
      return `druz9://task.open?${params.toString()}`;
    case 'note.open':
      push('id', intent.noteId);
      push('source', intent.source);
      return `druz9://note.open?${params.toString()}`;
    default:
      return 'druz9://';
  }
}

function parseIntSafe(s: string | null): number | null {
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
