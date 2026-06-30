/** IndexedDB — local-first store scoped by userId. */

const DB_NAME = 'hone-db';
const DB_VERSION = 2;

const STORES = ['notes', 'tasks', 'focus_sessions', 'whiteboards', 'outbox', 'meta', 'id_map'] as const;
export type HoneStore = (typeof STORES)[number];

export interface ScopedRecord {
  userId: string;
  id: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let currentUserId: string | null = null;

export function setDbUserId(userId: string | null): void {
  currentUserId = userId;
}

export function getDbUserId(): string | null {
  return currentUserId;
}

function requireUserId(): string {
  if (!currentUserId) throw new Error('honeDb: userId not set');
  return currentUserId;
}

function scopedKey(userId: string, id: string): string {
  return `${userId}::${id}`;
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('IDB open failed'));
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: 'key' });
          if (name !== 'meta' && name !== 'id_map') {
            store.createIndex('userId', 'userId', { unique: false });
          }
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
  return dbPromise;
}

function runTx<T>(
  store: HoneStore,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const os = tx.objectStore(store);
        const req = fn(os);
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
        tx.onerror = () => reject(tx.error ?? new Error('IDB tx failed'));
      }),
  );
}

export async function dbPut<T extends { key: string }>(store: HoneStore, row: T): Promise<void> {
  await runTx(store, 'readwrite', (s) => s.put(row));
}

export async function dbGet<T>(store: HoneStore, key: string): Promise<T | null> {
  const row = await runTx<T | undefined>(store, 'readonly', (s) => s.get(key));
  return row ?? null;
}

export async function dbDelete(store: HoneStore, key: string): Promise<void> {
  await runTx(store, 'readwrite', (s) => s.delete(key));
}

export async function dbGetAllByUser<T extends { userId: string }>(
  store: HoneStore,
  userId: string,
): Promise<T[]> {
  return runTx<T[]>(store, 'readonly', (s) => {
    const idx = s.index('userId');
    return idx.getAll(userId);
  });
}

export async function dbClearUser(store: HoneStore, userId: string): Promise<void> {
  const rows = await dbGetAllByUser<{ key: string; userId: string }>(store, userId);
  await openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const os = tx.objectStore(store);
        for (const row of rows) os.delete(row.key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export function entityKey(id: string, userId?: string): string {
  return scopedKey(userId ?? requireUserId(), id);
}

export { scopedKey, requireUserId, openDb };
