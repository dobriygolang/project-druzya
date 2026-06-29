// outbox.ts — durable queue для write-ops которые юзер делает offline.
//
// Контракт:
//   - Каждая op'а identifies'ся client-generated UUID. Backend mutation
//     handlers ДОЛЖНЫ быть idempotent по этому UUID (т.е. CreateRoom с
//     тем же id → no-op возвращающий existing row, не дубликат).
//   - Op'ы пишутся через `enqueue(...)`. Возвращают immediately (не ждут
//     network'а). UI предполагает success'ную operation: room появляется
//     в sidebar'е сразу с pending-меткой.
//   - Drain'ятся в FIFO порядке: если order matters (CreateRoom → AddMember)
//     гарантия только если caller enqueue'ит в правильной последовательности.
//   - Online-event listener (см. `installOutboxAutoDrain`) дёргает drain
//     когда navigator.onLine становится true. Каждая op'а имеет attempts
//     counter — при N+1 fail'ах с non-retryable error'ом помечается
//     `dead` и НЕ удаляется (caller'у решать как показать юзеру).
//
// Storage: IndexedDB DB `hone-outbox`, store `ops`. Не зависит от Y.Doc'ов
// (которые в `hone:editor:*` / `hone:whiteboard:*`).
//
// Для каких операций используется:
//   - CreateEditorRoom    (POST /api/v1/editor/room)
//   - CreateWhiteboardRoom (POST /api/v1/whiteboard/room)
//   - SetEditorRoomVisibility / SetWhiteboardRoomVisibility (POST .../visibility)
//   - DeleteEditorRoom (DELETE .../room/:id)
//   - CreateNote — НЕ используется здесь, у Notes свой local-* flow
//     с прямой sync через services/sync (см. api/sync.ts). Не дублируем.
//
// API:
//   - enqueue(op) → opId
//   - drainAll() — runs всё что можно
//   - listPending() — для UI badge'а
//   - removeOp(opId) — после success или manual cancel
//   - installOutboxAutoDrain() — wire'ит online event

// ─── Types ───────────────────────────────────────────────────────────────

export type OutboxOpKind =
  | 'editor.create_room'
  | 'editor.set_visibility'
  | 'editor.delete_room'
  | 'whiteboard.create_room'
  | 'whiteboard.set_visibility'
  | 'whiteboard.delete_room'
  // personal resource library (curation overrides).
  // Все кroms backend'у нужен Idempotency-Key header — UC ON CONFLICT
  // DO NOTHING в Insert делает write idempotent; повторный drain не
  // создаст duplicate row.
  | 'resource.add'
  | 'resource.hide'
  | 'resource.unhelpful'
  | 'resource.replace'
  // multi-takeaway reflection. Local fallback grade
  // (naiveQuality) пишется сразу; reconnect → server TaskReflectionGrade
  // overwrite через UPDATE user_resource_log (idempotent — quality_score
  // is a scalar overwrite, не accumulator).
  | 'reflection.submit'
  // Verify в wire — graceful enqueue если
  // log session offline.
  | 'external_activity.log'
  // MAX_ATTEMPTS, reflection доедет с первой удачной попытки.
  | 'focus.end'
  | 'focus.reflection';

export interface OutboxOp {
  id: string; // client-generated uuid v4
  kind: OutboxOpKind;
  payload: unknown; // shape depends on kind, validated at drain time
  attempts: number; // increment on each retry
  lastError?: string;
  dead?: boolean; // permanent failure, don't auto-retry
  createdAt: number; // Date.now()
  updatedAt: number;
}

// ExecutorResult — то что executor возвращает после успеха. serverID нужен
// чтобы post-drain hook'и могли смигрировать local state (например,
// переименовать y-indexeddb ключ с clientId на server-assigned ID).
export interface ExecutorResult {
  serverId?: string;
}

// Executor либо resolve'ит на success'е (опционально возвращая server-assigned
// IDs), либо throws. Если throws с `nonRetryable=true` flag'ом (Error.cause) —
// помечает op как dead (не auto-retry, юзер должен сам решить).
type Executor = (payload: unknown, opId: string) => Promise<ExecutorResult | void>;

// Post-drain hooks — fire после удачного drain'а каждой op'ы. Используется
// для migration'а local IndexedDB state (Y.Doc keyed by clientId → server ID).
// Hook'и идемпотентны (могут fire'ться несколько раз если drain ре-tries
// успешный response из cache), не зависят от очерёдности fire'а.
type PostDrainHook = (
  kind: OutboxOpKind,
  payload: unknown,
  result: ExecutorResult,
) => void | Promise<void>;

// ─── Constants ───────────────────────────────────────────────────────────

const DB_NAME = 'hone-outbox';
const STORE = 'ops';
const VERSION = 1;
const MAX_ATTEMPTS = 5;

// ─── Storage (IDB helpers) ───────────────────────────────────────────────

let _dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        const os = d.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const d = await db();
  return new Promise<T>((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result: T;
    Promise.resolve(fn(store))
      .then((r) => {
        result = r;
      })
      .catch(reject);
    t.oncomplete = () => resolve(result!);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

async function bumpAttempt(id: string, errorMessage: string, markDead: boolean): Promise<void> {
  await tx('readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const g = s.get(id);
      g.onsuccess = () => {
        const op = g.result as OutboxOp | undefined;
        if (!op) {
          resolve();
          return;
        }
        op.attempts += 1;
        op.lastError = errorMessage.slice(0, 500);
        op.dead = markDead || op.attempts >= MAX_ATTEMPTS;
        op.updatedAt = Date.now();
        const p = s.put(op);
        p.onsuccess = () => resolve();
        p.onerror = () => reject(p.error);
      };
      g.onerror = () => reject(g.error);
    });
  });
  notify();
}

// ─── Subscriptions (UI badge updates) ────────────────────────────────────

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore listener errors */
    }
  }
}

// ─── Executors registry + post-drain hooks ───────────────────────────────

const executors = new Map<OutboxOpKind, Executor>();
const postDrainHooks = new Set<PostDrainHook>();

/**
 * registerExecutor — wires конкретный handler для op-kind'а. Вызывается
 * в `offline/wire.ts` где есть доступ к API клиентам (мы не импортируем
 * api/* напрямую сюда чтобы не получить circular dep'ы).
 */
export function registerExecutor(kind: OutboxOpKind, fn: Executor): void {
  executors.set(kind, fn);
}

export function registerPostDrainHook(fn: PostDrainHook): () => void {
  postDrainHooks.add(fn);
  return () => postDrainHooks.delete(fn);
}

// ─── Public API: enqueue / list / remove ─────────────────────────────────

/**
 * enqueue — добавляет op в IDB. Caller получает op.id для UI-tracking'а
 * (например, room-row рендерится с этим id как «pending»). Op запускается
 * на drain через installOutboxAutoDrain (online event) или вручную drainAll.
 */
export async function enqueue(kind: OutboxOpKind, payload: unknown): Promise<string> {
  const op: OutboxOp = {
    id: crypto.randomUUID(),
    kind,
    payload,
    attempts: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await tx('readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const r = s.put(op);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  });
  // Notify subscribers — UI badge может реагировать.
  notify();
  return op.id;
}

/**
 * listPending — все non-dead op'ы, oldest first. Используется UI badge'ом
 * + drain loop'ом.
 */
export async function listPending(): Promise<OutboxOp[]> {
  return await tx('readonly', (s) => {
    return new Promise<OutboxOp[]>((resolve, reject) => {
      const out: OutboxOp[] = [];
      const r = s.openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (!c) {
          out.sort((a, b) => a.createdAt - b.createdAt);
          resolve(out);
          return;
        }
        const op = c.value as OutboxOp;
        if (!op.dead) out.push(op);
        c.continue();
      };
      r.onerror = () => reject(r.error);
    });
  });
}

/** Полный список включая dead — для admin UI. */
export async function listAll(): Promise<OutboxOp[]> {
  return await tx('readonly', (s) => {
    return new Promise<OutboxOp[]>((resolve, reject) => {
      const out: OutboxOp[] = [];
      const r = s.openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (!c) {
          out.sort((a, b) => a.createdAt - b.createdAt);
          resolve(out);
          return;
        }
        out.push(c.value as OutboxOp);
        c.continue();
      };
      r.onerror = () => reject(r.error);
    });
  });
}

/** removeOp — после success'а или ручной отмены. */
export async function removeOp(id: string): Promise<void> {
  await tx('readwrite', (s) => {
    return new Promise<void>((resolve, reject) => {
      const r = s.delete(id);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  });
  notify();
}

// ─── Drain ───────────────────────────────────────────────────────────────

// Drain mutex — без этого reconnect + manual retry могут параллельно fire'ить
// один и тот же executor (двойная запись на backend, double idempotency key
// hit). Если drain уже идёт, второй вызов ждёт текущий и возвращает его result.
let activeDrain: Promise<{ done: number; failed: number }> | null = null;

/**
 * drainAll — runs все pending op'ы по очереди. Каждая op fail'ом не
 * блокирует следующие (в отличие от строгой sequential модели). Если
 * порядок важен, caller'ы должны enqueue'ить так, чтобы зависимости
 * естественно соблюдались (CreateRoom → SetVisibility — обе идут на одного
 * room.id; SetVisibility упадёт с 404 если CreateRoom ещё в outbox'е, но
 * следующий drain — уже после CreateRoom — её отработает).
 */
export async function drainAll(): Promise<{ done: number; failed: number }> {
  if (activeDrain) return activeDrain;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { done: 0, failed: 0 };
  }
  activeDrain = (async () => {
    const pending = await listPending();
    let done = 0;
    let failed = 0;
    for (const op of pending) {
      const exec = executors.get(op.kind);
      if (!exec) {
        // Unknown kind — leave op'у untouched, может позже зарегистрируется
        // executor'ом (старый client → new client migration).
        continue;
      }
      try {
        const res = (await exec(op.payload, op.id)) ?? {};
        // Fire post-drain hooks BEFORE removeOp — если hook throws (rare),
        // op остаётся в outbox'е, повторный drain re-fire'нет hook (executor
        // должен быть idempotent через Idempotency-Key header).
        for (const hook of postDrainHooks) {
          try {
            await hook(op.kind, op.payload, res);
          } catch {
            /* hook errors не критичны — основной op уже выполнен */
          }
        }
        await removeOp(op.id);
        done += 1;
      } catch (err) {
        const e = err instanceof Error ? (err as Error & { cause?: { nonRetryable?: boolean } }) : null;
        const nonRetryable = e?.cause?.nonRetryable === true;
        await bumpAttempt(op.id, e?.message || String(err), nonRetryable);
        failed += 1;
      }
    }
    return { done, failed };
  })();
  try {
    return await activeDrain;
  } finally {
    activeDrain = null;
  }
}

// ─── Auto-drain ──────────────────────────────────────────────────────────

let installed = false;

/**
 * installOutboxAutoDrain — wire'ит online event + initial drain on call.
 * Вызывается ОДИН раз из App.tsx bootstrap'а. Idempotent — повторный
 * вызов no-op.
 */
export function installOutboxAutoDrain(): void {
  if (installed) return;
  installed = true;
  if (typeof window === 'undefined') return;
  // Initial drain — если тек. сессия уже online, может там что-то pending'ит
  // от прошлой offline-сессии.
  void drainAll().catch(() => {
    /* swallow — bumpAttempt уже залогировано. */
  });
  // Reconnect → drain. Без debounce — событие firing'ится один раз на reconnect'е.
  window.addEventListener('online', () => {
    void drainAll().catch(() => {
      /* swallow */
    });
  });
}
