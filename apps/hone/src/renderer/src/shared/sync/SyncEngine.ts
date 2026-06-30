import { HEALTH_CHECK_URL } from '@shared/api/config';
import { apiFetch } from '@shared/api/http';
import { getDbUserId } from '@shared/db/honeDb';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import { useSyncStore } from '@shared/model/sync';
import { pullFocus, pushFocusOutbox } from '@shared/sync/domains/focusSync';
import { pullNotes, pushNotesOutbox } from '@shared/sync/domains/notesSync';
import { pullTasks, pushTasksOutbox } from '@shared/sync/domains/tasksSync';
import { bumpOutboxAttempts, listOutbox, outboxCount } from '@shared/sync/outbox';
import { runMigrationForCurrentUser } from '@shared/sync/migrateLocalStorage';
import { canReachNetwork, isSyncEnabled } from '@shared/sync/syncConfig';
import type { OutboxEntry } from '@shared/sync/types';

const DEBOUNCE_MS = 3000;
const INTERVAL_MS = 60_000;
const MAX_ATTEMPTS = 8;

let debounceTimer: number | null = null;
let intervalId: number | null = null;
let running = false;
let started = false;

async function probeServer(): Promise<boolean> {
  if (!canReachNetwork()) return false;
  try {
    const resp = await apiFetch(HEALTH_CHECK_URL, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
    return resp.status < 500;
  } catch {
    return false;
  }
}

async function pushEntry(entry: OutboxEntry): Promise<void> {
  if (entry.domain === 'notes') await pushNotesOutbox(entry);
  else if (entry.domain === 'tasks') await pushTasksOutbox(entry);
  else if (entry.domain === 'focus') await pushFocusOutbox(entry);
}

async function pullAll(): Promise<void> {
  await pullNotes();
  await pullTasks();
  await pullFocus();
}

async function syncNow(): Promise<void> {
  if (!isSyncEnabled() || !getDbUserId()) return;
  if (running) return;
  running = true;

  const store = useSyncStore.getState();
  if (!canReachNetwork()) {
    store.setStatus('offline');
    store.setServerReachable(false);
    running = false;
    return;
  }

  const reachable = await probeServer();
  store.setServerReachable(reachable);
  if (!reachable) {
    store.setStatus('offline');
    running = false;
    return;
  }

  store.setStatus('syncing');
  try {
    await runMigrationForCurrentUser();
    const queue = await listOutbox();
    store.setPendingCount(queue.length);

    for (const entry of queue) {
      if (entry.attempts >= MAX_ATTEMPTS) continue;
      try {
        await pushEntry(entry);
      } catch (err) {
        await bumpOutboxAttempts(entry);
        throw err;
      }
    }

    await pullAll();
    store.setPendingCount(await outboxCount());
    store.setLastSyncedAt(Date.now());
    store.setStatus('idle');
    window.dispatchEvent(new Event(HONE_EVENTS.syncChanged));
  } catch (err) {
    store.setLastError(err instanceof Error ? err.message : String(err));
    store.setPendingCount(await outboxCount());
  } finally {
    running = false;
  }
}

export function scheduleSync(): void {
  if (!isSyncEnabled()) return;
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    void syncNow();
  }, DEBOUNCE_MS);
}

export function flushSync(): void {
  if (debounceTimer !== null) {
    window.clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  void syncNow();
}

function onOnline(): void {
  useSyncStore.getState().setStatus('idle');
  flushSync();
}

function onVisible(): void {
  if (document.visibilityState === 'visible') flushSync();
}

function onFocus(): void {
  void syncNow();
}

export function startSyncEngine(): void {
  if (started) return;
  started = true;
  window.addEventListener('online', onOnline);
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onVisible);
  intervalId = window.setInterval(() => {
    const s = useSyncStore.getState();
    if (s.pendingCount > 0 || s.status === 'error') void syncNow();
    else if (isSyncEnabled()) void syncNow();
  }, INTERVAL_MS);
  void syncNow();
}

export function stopSyncEngine(): void {
  if (!started) return;
  started = false;
  window.removeEventListener('online', onOnline);
  window.removeEventListener('focus', onFocus);
  document.removeEventListener('visibilitychange', onVisible);
  if (intervalId !== null) window.clearInterval(intervalId);
  intervalId = null;
  if (debounceTimer !== null) window.clearTimeout(debounceTimer);
  debounceTimer = null;
  useSyncStore.getState().setStatus('idle');
  useSyncStore.getState().setPendingCount(0);
}

export { syncNow };
