import type { SystemDesignWorkspace } from '@/lib/api/systemDesign'

const DB_NAME = 'druzya-sd'
const DB_VERSION = 1
const STORE = 'drafts'
const PENDING = 'pending-patches'

type DraftRecord = {
  sessionTaskId: string
  workspace: SystemDesignWorkspace
  savedAt: string
}

type PendingPatch = {
  id: string
  sessionTaskId: string
  payload: Record<string, unknown>
  createdAt: string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'sessionTaskId' })
      }
      if (!db.objectStoreNames.contains(PENDING)) {
        db.createObjectStore(PENDING, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('idb open failed'))
  })
}

function tx<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    const req = fn(s)
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error ?? new Error('idb tx failed'))
  })
}

export async function saveSDDraft(sessionTaskId: string, workspace: SystemDesignWorkspace) {
  if (!sessionTaskId) return
  const db = await openDB()
  try {
    const record: DraftRecord = {
      sessionTaskId,
      workspace,
      savedAt: new Date().toISOString(),
    }
    await tx(db, STORE, 'readwrite', (s) => s.put(record))
  } finally {
    db.close()
  }
}

export async function loadSDDraft(sessionTaskId: string): Promise<SystemDesignWorkspace | null> {
  if (!sessionTaskId) return null
  const db = await openDB()
  try {
    const row = await tx<DraftRecord | undefined>(db, STORE, 'readonly', (s) => s.get(sessionTaskId))
    return row?.workspace ?? null
  } finally {
    db.close()
  }
}

export async function clearSDDraft(sessionTaskId: string) {
  if (!sessionTaskId) return
  const db = await openDB()
  try {
    await tx(db, STORE, 'readwrite', (s) => s.delete(sessionTaskId))
  } finally {
    db.close()
  }
}

export async function queueSDPatch(sessionTaskId: string, payload: Record<string, unknown>) {
  const db = await openDB()
  try {
    const item: PendingPatch = {
      id: `${sessionTaskId}:${Date.now()}`,
      sessionTaskId,
      payload,
      createdAt: new Date().toISOString(),
    }
    await tx(db, PENDING, 'readwrite', (s) => s.add(item))
  } finally {
    db.close()
  }
}

export async function listPendingSDPatches(sessionTaskId: string): Promise<PendingPatch[]> {
  const db = await openDB()
  try {
    const all = await tx<PendingPatch[]>(db, PENDING, 'readonly', (s) => s.getAll())
    return all.filter((p) => p.sessionTaskId === sessionTaskId)
  } finally {
    db.close()
  }
}

export async function removePendingSDPatch(id: string) {
  const db = await openDB()
  try {
    await tx(db, PENDING, 'readwrite', (s) => s.delete(id))
  } finally {
    db.close()
  }
}

export async function flushPendingSDPatches(
  sessionTaskId: string,
  send: (payload: Record<string, unknown>) => Promise<void>,
) {
  const pending = await listPendingSDPatches(sessionTaskId)
  for (const item of pending) {
    await send(item.payload)
    await removePendingSDPatch(item.id)
  }
}
