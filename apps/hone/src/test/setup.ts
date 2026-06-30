// setup.ts — global test bootstrap.
//
// Что подключаем:
//   1. fake-indexeddb/auto — patches global indexedDB + IDBKeyRange чтобы
//      outbox.ts мог открывать DB в node-environment'е. happy-dom не
//      shippит IDB, потому без этого open() сразу бросает.
//   2. Wipe of `hone-outbox` DB между тестами — fake-indexeddb сохраняет
//      state в process-globaльном `indexedDB`, без cleanup'а ops leak'аются.
//   3. Connection tracking — fake-indexeddb's `deleteDatabase` blocks
//      while any IDBDatabase connection остаётся open. Outbox.ts кеширует
//      connection в module-scoped `_dbPromise`; после `vi.resetModules()`
//      module unref'ит handle, но fake-indexeddb всё-равно держит strong
//      ref в `databases.get(name).connections`. Решение: тегаем каждый
//      open() через monkey-patch, в afterEach close()'им все tracked
//      connections перед deleteDatabase.
import 'fake-indexeddb/auto';
import { afterEach, vi } from 'vitest';

// Track every IDBDatabase, открытый через `indexedDB.open(...)`. Закрываем
// все в afterEach чтобы deleteDatabase не блокировался versionchange'ом.
const openConnections = new Set<IDBDatabase>();
const originalOpen = indexedDB.open.bind(indexedDB);
indexedDB.open = function patchedOpen(name: string, version?: number): IDBOpenDBRequest {
  const req = originalOpen(name, version);
  req.addEventListener('success', () => {
    const db = req.result;
    openConnections.add(db);
    db.addEventListener('close', () => openConnections.delete(db));
  });
  return req;
};

// Ensure crypto.randomUUID is available (happy-dom v15 has it, но safety).
// Cast through `unknown` потому что Crypto.randomUUID returns branded
// template-literal type, не plain string.
if (typeof globalThis.crypto === 'undefined' || !globalThis.crypto.randomUUID) {
  const shimRandomUUID = (): `${string}-${string}-${string}-${string}-${string}` => {
    const hex = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-4xxx-yxxx-xxxxxxxxxxxx`
      .replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    return hex as `${string}-${string}-${string}-${string}-${string}`;
  };
  (globalThis as { crypto: Crypto }).crypto = {
    ...(globalThis.crypto ?? {}),
    randomUUID: shimRandomUUID,
  } as Crypto;
}

// Default to online — tests that need offline-state set navigator.onLine
// explicitly via Object.defineProperty в test bodies.
if (typeof navigator !== 'undefined') {
  try {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
  } catch {
    /* navigator.onLine may be already overridden — non-fatal */
  }
}

afterEach(async () => {
  // Close any IDBDatabase connections opened during the test. Otherwise
  // fake-indexeddb's `deleteDatabase` blocks waiting for versionchange
  // ack (which never comes since the connection is unref'd by `vi.resetModules`).
  for (const db of openConnections) {
    try {
      db.close();
    } catch {
      /* already closed */
    }
  }
  openConnections.clear();

  // Wipe outbox IDB между тестами.
  await new Promise<void>((resolve) => {
    try {
      const req = indexedDB.deleteDatabase('hone-outbox');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
  // Reset all mocks/spies созданные через vi.mock / vi.spyOn / vi.fn.
  vi.restoreAllMocks();
});
