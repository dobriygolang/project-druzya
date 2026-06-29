// localCache.ts — IndexedDB-backed local cache for sync data.
//
// Зачем cache: после pull'а нам надо где-то хранить snapshot'ы между
// session'ами. Если каждый запуск делать full pull → юзер ждёт сетевой
// round-trip перед тем как увидит свои notes. Cache позволяет:
//   - render заметок мгновенно из локального snapshot'а
//   - background pull через 30s, обновление UI при прибытии delta
//
// Storage choice: IndexedDB вместо localStorage по двум причинам:
//   (1) localStorage синхронный — блокирует UI thread при больших dump'ах
//       (10MB notes corpus = noticeable jank).
//   (2) localStorage — 5-10 MB cap. Production users с сотнями notes
//       упрутся.
// IndexedDB: async, ~50% disk quota allowed, structured data.
//
// Design:
//   - Один DB per logged-in user. Key: `hone-sync-{userId-prefix}`. При
//     logout — wipe целиком (privacy: сменился аккаунт = чужие данные не
//     должны висеть в кеше).
//   - Один object store per таблица. Primary key = id (UUID).
//   - Версия schema bumpаем при добавлении таблиц / меняющихся полях.
//
// Не используем готовых wrapper'ов (idb / dexie) сознательно: набор
// операций ультра-узкий (get/put/delete/clear-all), а лишние deps
// растут bundle.

const DB_VERSION = 1;
const STORES = [
  'hone_notes',
  'hone_whiteboards',
  'hone_focus_sessions',
  'hone_plans',
  'coach_episodes',
] as const;

export type CacheStore = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;
let openedForUserId: string | null = null;

function dbName(userId: string): string {
  // Берём первые 12 hex символов user-id'а — достаточно уникально для
  // одной машины (collision'ов меньше чем 2^48), и не светит полный uuid
  // в DevTools storage UI.
  return `hone-sync-${userId.replace(/-/g, '').slice(0, 12)}`;
}

/**
 * openDB — lazy-init. Должен быть вызван с user-id'ом чтобы выбрать
 * правильную базу. При смене user-id'а (login as другой пользователь)
 * закрывает старую и открывает новую.
 */
export async function openCacheDB(userId: string): Promise<IDBDatabase> {
  if (dbPromise && openedForUserId === userId) return dbPromise;
  if (dbPromise && openedForUserId !== userId) {
    // Сменился юзер — закрываем старую базу. Не удаляем — может быть
    // пригодится при возврате на тот аккаунт.
    const old = await dbPromise;
    old.close();
    dbPromise = null;
  }
  openedForUserId = userId;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(dbName(userId), DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          // hone_plans уникальная: ключ — (user_id, day) — но т.к. one
          // user-per-database, day достаточно. Остальные все по id.
          const keyPath = name === 'hone_plans' ? 'day' : 'id';
          db.createObjectStore(name, { keyPath });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexeddb open failed'));
    req.onblocked = () => reject(new Error('indexeddb open blocked'));
  });
  return dbPromise;
}

/**
 * closeAndForget — close current connection и забыть user-id'а. Вызывается
 * на logout. После этого следующий openCacheDB заново откроет.
 */
export async function closeCache(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
  openedForUserId = null;
}

/**
 * wipeCache — DELETE целиком всю базу для текущего юзера. Вызывается
 * при device_revoked (paranoid privacy: revoke = data wipe).
 */
export async function wipeCache(userId: string): Promise<void> {
  await closeCache();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(dbName(userId));
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error ?? new Error('deleteDatabase failed'));
    req.onblocked = () => {
      // Other tabs still have it open. Resolve anyway — wipe completes
      // when last tab closes; meanwhile current tab won't reopen because
      // dbPromise is null.
      resolve();
    };
  });
}

// ─── CRUD ────────────────────────────────────────────────────────────────

export async function putRows(userId: string, store: CacheStore, rows: Array<Record<string, unknown>>): Promise<void> {
  if (rows.length === 0) return;
  const db = await openCacheDB(userId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const row of rows) {
      os.put(row);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('putRows failed'));
    tx.onabort = () => reject(tx.error ?? new Error('putRows aborted'));
  });
}

export async function deleteRows(userId: string, store: CacheStore, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openCacheDB(userId);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const id of ids) {
      os.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('deleteRows failed'));
    tx.onabort = () => reject(tx.error ?? new Error('deleteRows aborted'));
  });
}

export async function getAllRows<T = Record<string, unknown>>(userId: string, store: CacheStore): Promise<T[]> {
  const db = await openCacheDB(userId);
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const os = tx.objectStore(store);
    const req = os.getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error ?? new Error('getAll failed'));
  });
}

export async function getRow<T = Record<string, unknown>>(userId: string, store: CacheStore, id: string): Promise<T | null> {
  const db = await openCacheDB(userId);
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const os = tx.objectStore(store);
    const req = os.get(id);
    req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('get failed'));
  });
}

// ─── Hi-level: apply pull response ────────────────────────────────────────

import type { PullResponse, SyncTable } from './sync';

/**
 * applyPullResponse — пишет changed → put, deleted → delete.
 * Идемпотентно: повторный apply того же response не ломает state.
 */
export async function applyPullResponse(userId: string, resp: PullResponse): Promise<void> {
  // Apply upserts per-table.
  for (const [tableStr, rows] of Object.entries(resp.changed)) {
    const table = tableStr as SyncTable;
    if (rows && rows.length > 0) {
      await putRows(userId, table, rows);
    }
  }
  // Apply deletes — group by table to minimize TX overhead.
  const byTable = new Map<SyncTable, string[]>();
  for (const d of resp.deleted) {
    const arr = byTable.get(d.table) ?? [];
    arr.push(d.rowId);
    byTable.set(d.table, arr);
  }
  for (const [table, ids] of byTable) {
    await deleteRows(userId, table, ids);
  }
}
