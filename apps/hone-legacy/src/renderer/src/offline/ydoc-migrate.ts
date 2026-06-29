// ydoc-migrate.ts — post-drain hook'и для миграции y-indexeddb состояния
// после того как server вернул real ID для offline-create'нутой room'ы.
//
// Сценарий:
//   1. Юзер offline создаёт editor-room: clientId = client-uuid-123
//   2. Mы записали Y.Doc state в IndexedDB под `hone:editor:client-uuid-123`
//      (если юзер открыл pending-room и редактировал — Y.Doc + y-indexeddb
//      поймал updates).
//   3. Online → drain → backend create вернул `serverId = real-uuid-456`
//   4. Этот hook копирует state из старого ключа в новый, удаляет старый.
//
// Без этого юзер потерял бы offline-edits: при первом online-mount комнаты
// под server-id Y.Doc был бы пустой (IndexedDB key не совпал).
//
// Edge-cases:
//   - Если pending-room никогда не открывалась (Y.Doc не создавался) — нет
//     IndexedDB DB под `hone:editor:client-uuid-123`. Hook silently no-op.
//   - Если оба ключа существуют (юзер уже открыл server-id room до hook'а
//     успел fire'нуть — race) — мы НЕ перезаписываем server-id state'а.
//     Hook detects existing target и skip'ает.
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

import { registerPostDrainHook, type ExecutorResult, type OutboxOpKind } from './outbox';

// ─── Types & constants ───────────────────────────────────────────────────

interface CreateRoomPayload {
  clientId: string;
  type?: string;
  language?: number;
}

const PREFIXES: Partial<Record<OutboxOpKind, string>> = {
  'editor.create_room': 'hone:editor:',
  'whiteboard.create_room': 'hone:whiteboard:',
};

// y-indexeddb encoded empty Y.Doc → header only, ≤2 bytes. Used as
// «is this doc empty?» check без декодинга всего state'а.
const EMPTY_YDOC_BYTE_THRESHOLD = 2;

// Persistence whenSynced может никогда не resolve'нуться если DB не существует;
// race против таймера это safety net.
const PERSISTENCE_TIMEOUT_MS = 1500;
const PERSISTENCE_FLUSH_MS = 100;

// ─── Y.Doc IDB migration helpers ─────────────────────────────────────────

// Wait until persistence loaded (or timeout — DB may not exist).
function waitPersistenceReady(p: IndexeddbPersistence): Promise<unknown> {
  return Promise.race([
    p.whenSynced,
    new Promise((resolve) => window.setTimeout(resolve, PERSISTENCE_TIMEOUT_MS)),
  ]);
}

async function destroyQuietly(p: IndexeddbPersistence): Promise<void> {
  try {
    await p.destroy();
  } catch {
    /* ignore */
  }
}

/**
 * Migrate Y.Doc state from `<prefix><clientId>` IndexedDB DB to
 * `<prefix><serverId>`. Returns true if migration happened, false если
 * source-state не было (т.е. юзер не редактировал pending-room).
 */
async function migrateOne(prefix: string, clientId: string, serverId: string): Promise<boolean> {
  const oldKey = prefix + clientId;
  const newKey = prefix + serverId;
  if (oldKey === newKey) return false;

  // Probe IDB чтобы узнать существует ли DB под oldKey. y-indexeddb
  // создаёт IDBDatabase с именем = key. Если такого DB нет — нечего
  // мигрировать (юзер не открывал pending-room).
  const oldDoc = new Y.Doc();
  const oldPersistence = new IndexeddbPersistence(oldKey, oldDoc);
  await waitPersistenceReady(oldPersistence);

  // Если в Y.Doc нет state'а (свежий ydoc → 0 bytes update) — нечего мигрировать.
  const stateUpdate = Y.encodeStateAsUpdate(oldDoc);
  if (stateUpdate.byteLength <= EMPTY_YDOC_BYTE_THRESHOLD) {
    await destroyQuietly(oldPersistence);
    oldDoc.destroy();
    return false;
  }

  // Открываем target DB. Если там уже что-то есть (race) — НЕ перезаписываем.
  const newDoc = new Y.Doc();
  const newPersistence = new IndexeddbPersistence(newKey, newDoc);
  await waitPersistenceReady(newPersistence);
  const targetExisting = Y.encodeStateAsUpdate(newDoc);
  if (targetExisting.byteLength > EMPTY_YDOC_BYTE_THRESHOLD) {
    // Race — другой mount уже инициализировал server-id state. Skip
    // migration, тегаем oldKey как «orphan» (cleanup ниже).
    await destroyQuietly(newPersistence);
    newDoc.destroy();
  } else {
    // Apply old state в new doc — IndexeddbPersistence сам persist'ит.
    Y.applyUpdate(newDoc, stateUpdate);
    // Wait for persistence flush.
    await new Promise((resolve) => window.setTimeout(resolve, PERSISTENCE_FLUSH_MS));
    await destroyQuietly(newPersistence);
    newDoc.destroy();
  }

  // Drop old IDB database (cleanup) — больше не нужна. y-indexeddb создаёт
  // её под именем = key.
  try {
    await oldPersistence.clearData();
  } catch {
    /* ignore */
  }
  await destroyQuietly(oldPersistence);
  oldDoc.destroy();
  // Force-delete IDBDatabase tоже — clearData оставляет пустую DB.
  try {
    indexedDB.deleteDatabase(oldKey);
  } catch {
    /* ignore — некоторые browser'ы не разрешают на active connection'ах */
  }
  return true;
}

// ─── Editor recent-list helper ──────────────────────────────────────────

// RECENT_KEY mirror'ит Editor.tsx — single-source мог бы лучше, но мы не
// хотим cross-import между offline/ и pages/ (создаст cycle).
const EDITOR_RECENT_KEY = 'hone:editor:recent';
const EDITOR_RECENT_MAX = 24;

interface EditorRecentEntry {
  id: string;
  language?: number;
  openedAt: number;
}

function appendToEditorRecent(serverId: string, language?: number): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(EDITOR_RECENT_KEY);
    const cur: EditorRecentEntry[] = raw ? JSON.parse(raw) : [];
    if (cur.some((e) => e.id === serverId)) return; // уже есть
    cur.unshift({ id: serverId, language, openedAt: Date.now() });
    window.localStorage.setItem(
      EDITOR_RECENT_KEY,
      JSON.stringify(cur.slice(0, EDITOR_RECENT_MAX)),
    );
  } catch {
    /* localStorage quota / privacy mode */
  }
}

// ─── Hook installer ─────────────────────────────────────────────────────

/**
 * installYDocMigrationHook — wires post-drain hook'у для editor + whiteboard
 * create-room ops. Idempotent: повторный install no-op (hook уже зарегистрирован).
 *
 * Хук делает 3 вещи после drain'а create-op:
 *   1. Y.Doc IndexedDB rename: clientId → serverId.
 *   2. Для editor — append'ит room в `hone:editor:recent` чтобы sidebar
 *      RECENT секция её показала после refresh'а.
 *   3. Dispatch global event `hone:recent-refresh` — Editor + SharedBoards
 *      слушают этот event и refetch'ят свои списки.
 *
 * Вызывается ОДИН раз из App.tsx bootstrap'а.
 */
let installed = false;
export function installYDocMigrationHook(): void {
  if (installed) return;
  installed = true;
  registerPostDrainHook(async (kind: OutboxOpKind, payload: unknown, result: ExecutorResult) => {
    const prefix = PREFIXES[kind];
    const p = payload as CreateRoomPayload | undefined;
    const clientId = p?.clientId;
    const serverId = result.serverId;

    if (prefix && clientId && serverId) {
      try {
        await migrateOne(prefix, clientId, serverId);
      } catch {
        /* migration best-effort */
      }
    }

    // Editor recent-list update — только для editor.create_room.
    if (kind === 'editor.create_room' && serverId) {
      appendToEditorRecent(serverId, p?.language);
    }

    // Notify UI (Editor / SharedBoards / etc) что list нужно refetch'нуть.
    // Любая create-op (editor / whiteboard) или delete-op (whiteboard) меняет
    // сайдбар-список. set_visibility — нет (room уже в списке, visibility
    // отображается в three-dots menu, juзер flip'нул UI оптимистично).
    if (
      kind === 'editor.create_room' ||
      kind === 'whiteboard.create_room' ||
      kind === 'whiteboard.delete_room' ||
      kind === 'editor.delete_room'
    ) {
      try {
        window.dispatchEvent(
          new CustomEvent('hone:recent-refresh', {
            detail: { kind, serverId, clientId },
          }),
        );
      } catch {
        /* SSR / no window */
      }
    }
  });
}
