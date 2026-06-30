import {
  dbDelete,
  dbGet,
  dbGetAllByUser,
  dbPut,
  entityKey,
  requireUserId,
} from '@shared/db/honeDb';
import { mergePersistedAppState } from '@shared/lib/excalidraw/excalidrawPersist';
import { honeExcalidrawInitialAppState } from '@shared/lib/excalidraw/honeTheme';

export interface StoredWhiteboard {
  userId: string;
  id: string;
  key: string;
  title: string;
  sceneJson: string;
  createdAt?: string;
  updatedAt: string;
}

export interface WhiteboardScene {
  elements: unknown[];
  files: Record<string, unknown>;
  appState?: Record<string, unknown>;
}

export interface BoardSummary {
  id: string;
  title: string;
  updatedAt: Date | null;
}

export interface Board extends BoardSummary {
  sceneJson: string;
  createdAt: Date | null;
}

function parseTs(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rowFrom(
  userId: string,
  partial: Omit<StoredWhiteboard, 'key' | 'userId'>,
): StoredWhiteboard {
  return { ...partial, userId, key: entityKey(partial.id, userId) };
}

function toSummary(row: StoredWhiteboard): BoardSummary {
  return {
    id: row.id,
    title: row.title,
    updatedAt: parseTs(row.updatedAt),
  };
}

function toBoard(row: StoredWhiteboard): Board {
  return {
    ...toSummary(row),
    sceneJson: row.sceneJson,
    createdAt: parseTs(row.createdAt ?? row.updatedAt),
  };
}

export function parseSceneJson(raw: string): WhiteboardScene | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WhiteboardScene>;
    if (!Array.isArray(parsed.elements)) return null;
    return {
      elements: parsed.elements,
      files: (parsed.files as Record<string, unknown>) ?? {},
      appState: mergePersistedAppState(
        honeExcalidrawInitialAppState(),
        parsed.appState as Record<string, unknown> | undefined,
      ),
    };
  } catch {
    return null;
  }
}

export function serializeScene(scene: WhiteboardScene): string {
  return JSON.stringify(scene);
}

export async function boardsStoreList(): Promise<BoardSummary[]> {
  const userId = requireUserId();
  const rows = await dbGetAllByUser<StoredWhiteboard>('whiteboards', userId);
  return rows
    .map(toSummary)
    .sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
}

export async function boardsStoreGet(id: string): Promise<Board | null> {
  const userId = requireUserId();
  const row = await dbGet<StoredWhiteboard>('whiteboards', entityKey(id, userId));
  return row ? toBoard(row) : null;
}

export async function boardsStoreCreate(title: string): Promise<Board> {
  const userId = requireUserId();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = rowFrom(userId, {
    id,
    title: title.trim() || 'Untitled',
    sceneJson: '',
    createdAt: now,
    updatedAt: now,
  });
  await dbPut('whiteboards', row);
  return toBoard(row);
}

export async function boardsStoreUpdateScene(id: string, sceneJson: string): Promise<Board> {
  const userId = requireUserId();
  const key = entityKey(id, userId);
  const existing = await dbGet<StoredWhiteboard>('whiteboards', key);
  if (!existing) throw new Error(`Board not found: ${id}`);
  const now = new Date().toISOString();
  const row: StoredWhiteboard = { ...existing, sceneJson, updatedAt: now };
  await dbPut('whiteboards', row);
  return toBoard(row);
}

export async function boardsStoreUpdateTitle(id: string, title: string): Promise<Board> {
  const userId = requireUserId();
  const key = entityKey(id, userId);
  const existing = await dbGet<StoredWhiteboard>('whiteboards', key);
  if (!existing) throw new Error(`Board not found: ${id}`);
  const now = new Date().toISOString();
  const row: StoredWhiteboard = { ...existing, title: title.trim() || 'Untitled', updatedAt: now };
  await dbPut('whiteboards', row);
  return toBoard(row);
}

export async function boardsStoreDelete(id: string): Promise<void> {
  const userId = requireUserId();
  const key = entityKey(id, userId);
  const existing = await dbGet<StoredWhiteboard>('whiteboards', key);
  if (existing) {
    await dbDelete('whiteboards', key);
    return;
  }
  // Fallback: list by userId index in case an older row has a mismatched primary key.
  const rows = await dbGetAllByUser<StoredWhiteboard>('whiteboards', userId);
  const row = rows.find((r) => r.id === id);
  if (!row) throw new Error(`Board not found: ${id}`);
  await dbDelete('whiteboards', row.key);
}
