// localNotes.ts — Free-tier local-only notes store.
//
// Notes на free-плане НИКОГДА не попадают на бэкенд (ни через
// CreateNote, ни через Yjs append). Хранение полностью локальное:
//
//   - IndexedDB store `hone-local-notes:notes` — JSON record
//     {id, title, bodyMd, createdAt, updatedAt} per local note.
//
// «Publish to cloud» (явное действие пользователя) делает REST POST
// /notes, получает server id, копирует body_md, удаляет локальную копию.
// Этот переход реализован в Notes.tsx (handlePublishLocal).
//
// Префикс id: `local:` чтобы UI / storage layer однозначно различал
// local vs cloud-носители без отдельного флага.

const DB_NAME = 'hone-local-notes';
const DB_VERSION = 1;
const STORE = 'notes';

export interface LocalNote {
  id: string; // 'local:<uuid>'
  title: string;
  bodyMd: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export const LOCAL_NOTE_PREFIX = 'local:';

export function isLocalNoteId(id: string): boolean {
  return id.startsWith(LOCAL_NOTE_PREFIX);
}

function genId(): string {
  // crypto.randomUUID — доступен в Electron renderer (Chromium 120+).
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${LOCAL_NOTE_PREFIX}${uuid}`;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const s = t.objectStore(STORE);
    const result = op(s);
    if (result instanceof Promise) {
      result.then(resolve).catch(reject);
      return;
    }
    result.onsuccess = () => resolve(result.result as T);
    result.onerror = () => reject(result.error);
  });
}

export async function createLocalNote(title = 'Untitled', bodyMd = ''): Promise<LocalNote> {
  const now = new Date().toISOString();
  const note: LocalNote = {
    id: genId(),
    title,
    bodyMd,
    createdAt: now,
    updatedAt: now,
  };
  await tx('readwrite', (s) => s.put(note));
  return note;
}

export async function listLocalNotes(): Promise<LocalNote[]> {
  const db = await openDB();
  return new Promise<LocalNote[]>((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const s = t.objectStore(STORE);
    const req = s.getAll();
    req.onsuccess = () => {
      const arr = (req.result as LocalNote[]) ?? [];
      arr.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      resolve(arr);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalNote(id: string): Promise<LocalNote | null> {
  const db = await openDB();
  return new Promise<LocalNote | null>((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const s = t.objectStore(STORE);
    const req = s.get(id);
    req.onsuccess = () => resolve((req.result as LocalNote) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function updateLocalNote(id: string, patch: { title?: string; bodyMd?: string }): Promise<LocalNote | null> {
  const existing = await getLocalNote(id);
  if (!existing) return null;
  const next: LocalNote = {
    ...existing,
    title: patch.title ?? existing.title,
    bodyMd: patch.bodyMd ?? existing.bodyMd,
    updatedAt: new Date().toISOString(),
  };
  await tx('readwrite', (s) => s.put(next));
  return next;
}

export async function deleteLocalNote(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

// promoteToCloud — конвертирует local-only заметку в cloud-note.
// Use case: юзер пытается выполнить операцию которая требует backend
// (move в папку, publish, encrypt). Local id `local:<uuid>` 42 char и
// не парсится backend'ом как UUID → 400. Промоут делает CreateNote,
// получает новый cloud uuid, удаляет local запись.
//
// Если id уже не local — возвращается as-is. Caller должен заменить
// у себя noteId/selectedId на возвращённый cloudId.
//
// NB: импорт createNote из api/hone.ts через ленивый dynamic import
// чтобы не плодить циклические зависимости (hone.ts импортит
// transport, transport — config, etc).
export async function promoteToCloud(localId: string): Promise<string> {
  if (!isLocalNoteId(localId)) return localId;
  const local = await getLocalNote(localId);
  if (!local) {
    throw new Error(`promoteToCloud: local note not found: ${localId}`);
  }
  const { createNote } = await import('./hone');
  const cloud = await createNote(local.title, local.bodyMd, null);
  await deleteLocalNote(localId);
  return cloud.id;
}

export async function countLocalNotes(): Promise<number> {
  const db = await openDB();
  return new Promise<number>((resolve, reject) => {
    const t = db.transaction(STORE, 'readonly');
    const req = t.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
