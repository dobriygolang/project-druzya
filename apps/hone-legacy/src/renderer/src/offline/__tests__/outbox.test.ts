// outbox.test.ts — критичные пути offline-outbox'а.
//
// Tested invariants:
//   • FIFO drain order (createdAt ASC)
//   • Idempotency per-op (UUID generation + dedup на повторном drain'е)
//   • Retry / max-attempts → dead-letter
//   • 409 conflict → nonRetryable → dead-letter (текущий behavior)
//   • Online-restore drain triggered by `online` event
//   • Multi op-kind executor isolation
//   • Persistence across "reload" (IDB survives module re-import)
//
// Test isolation strategy:
//   `vi.resetModules()` в beforeEach + dynamic `await import(...)` чтобы
//   получить fresh module-scoped state (executors map, postDrainHooks,
//   `installed` flag, `_dbPromise`). DB wiped через `afterEach` в setup.ts.
//
// Mocking:
//   Executors зарегистрированы прямо через `registerExecutor` — никакого
//   network mocking'а на этом уровне. wire.test.ts отдельно тестирует
//   fetch-layer.
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { OutboxOpKind, ExecutorResult } from '../outbox';

// Executor type не exported из outbox.ts (внутренний alias), mirror'им here.
type Executor = (payload: unknown, opId: string) => Promise<ExecutorResult | void>;

/**
 * loadOutbox — fresh outbox module за каждый тест. Без `vi.resetModules()`
 * executors / hooks накапливались бы между тестами (module singleton).
 */
async function loadOutbox(): Promise<typeof import('../outbox')> {
  vi.resetModules();
  return await import('../outbox');
}

/**
 * setOnline — toggles `navigator.onLine` для drain'а. defineProperty
 * нужен потому что happy-dom marks onLine как read-only-ish.
 */
function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
}

/** flushAsync — drain pending microtasks (для async-Promise.resolve chains). */
function flushAsync(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe('outbox — enqueue', () => {
  beforeEach(() => setOnline(true));

  it('generates unique UUID per op', async () => {
    const { enqueue, listAll } = await loadOutbox();
    const id1 = await enqueue('editor.create_room', { clientId: 'a', type: 'practice', language: 1 });
    const id2 = await enqueue('editor.create_room', { clientId: 'b', type: 'practice', language: 1 });
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^[0-9a-f-]+$/i);
    const all = await listAll();
    expect(all).toHaveLength(2);
  });

  it('persists payload verbatim в IDB', async () => {
    const { enqueue, listAll } = await loadOutbox();
    const payload = { clientId: 'xyz', type: 'interview', language: 7, nested: { foo: 'bar' } };
    await enqueue('editor.create_room', payload);
    const all = await listAll();
    expect(all[0]?.payload).toEqual(payload);
    expect(all[0]?.kind).toBe('editor.create_room');
    expect(all[0]?.attempts).toBe(0);
    expect(all[0]?.createdAt).toBeGreaterThan(0);
  });

  it('multiple distinct ops sit independent (no dedup на kind+payload)', async () => {
    // Outbox умышленно дедуп НЕ делает — caller отвечает за idempotency
    // через client-generated `clientId` в payload (отдельный from op.id).
    // Server должен ON CONFLICT DO NOTHING по этому clientId.
    const { enqueue, listPending } = await loadOutbox();
    const samePayload = { clientId: 'same', type: 'practice', language: 1 };
    await enqueue('editor.create_room', samePayload);
    await enqueue('editor.create_room', samePayload);
    const pending = await listPending();
    expect(pending).toHaveLength(2);
    expect(pending[0]?.id).not.toBe(pending[1]?.id);
  });

  it('notifies subscribers on enqueue', async () => {
    const { enqueue, subscribe } = await loadOutbox();
    const fn = vi.fn();
    const unsub = subscribe(fn);
    await enqueue('reflection.submit', { resourceId: 'r1', grade: 4 });
    expect(fn).toHaveBeenCalled();
    unsub();
  });

  it('subscribe returns unsubscribe function', async () => {
    const { enqueue, subscribe } = await loadOutbox();
    const fn = vi.fn();
    const unsub = subscribe(fn);
    unsub();
    await enqueue('reflection.submit', { x: 1 });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('outbox — listPending / listAll', () => {
  beforeEach(() => setOnline(true));

  it('listPending sorted by createdAt ASC (FIFO)', async () => {
    const { enqueue, listPending } = await loadOutbox();
    // Enqueue 3 ops с принудительной задержкой между ними (иначе ms-precision
    // createdAt не различается).
    const id1 = await enqueue('editor.create_room', { clientId: '1', type: 'p', language: 1 });
    await new Promise((r) => setTimeout(r, 5));
    const id2 = await enqueue('editor.create_room', { clientId: '2', type: 'p', language: 1 });
    await new Promise((r) => setTimeout(r, 5));
    const id3 = await enqueue('editor.create_room', { clientId: '3', type: 'p', language: 1 });

    const pending = await listPending();
    expect(pending.map((p) => p.id)).toEqual([id1, id2, id3]);
  });

  it('listPending excludes dead-letter ops', async () => {
    const { enqueue, registerExecutor, drainAll, listPending, listAll } = await loadOutbox();
    registerExecutor('editor.create_room', vi.fn().mockRejectedValue(
      Object.assign(new Error('nope'), { cause: { nonRetryable: true } }),
    ));
    await enqueue('editor.create_room', { clientId: '1', type: 'p', language: 1 });
    await drainAll();
    const pending = await listPending();
    const all = await listAll();
    expect(pending).toHaveLength(0); // dead op excluded from pending
    expect(all).toHaveLength(1); // но остаётся в listAll
    expect(all[0]?.dead).toBe(true);
  });
});

describe('outbox — drainAll FIFO', () => {
  beforeEach(() => setOnline(true));

  it('drains pending ops in createdAt order', async () => {
    const { enqueue, registerExecutor, drainAll } = await loadOutbox();
    const calls: string[] = [];
    const exec: Executor = async (payload) => {
      calls.push((payload as { clientId: string }).clientId);
    };
    registerExecutor('editor.create_room', exec);

    await enqueue('editor.create_room', { clientId: 'A', type: 'p', language: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await enqueue('editor.create_room', { clientId: 'B', type: 'p', language: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await enqueue('editor.create_room', { clientId: 'C', type: 'p', language: 1 });

    const result = await drainAll();
    expect(result.done).toBe(3);
    expect(result.failed).toBe(0);
    expect(calls).toEqual(['A', 'B', 'C']);
  });

  it('skips drain when navigator.onLine === false', async () => {
    const { enqueue, registerExecutor, drainAll, listPending } = await loadOutbox();
    const exec = vi.fn().mockResolvedValue({});
    registerExecutor('editor.create_room', exec);

    await enqueue('editor.create_room', { clientId: 'X', type: 'p', language: 1 });
    setOnline(false);
    const result = await drainAll();
    expect(result).toEqual({ done: 0, failed: 0 });
    expect(exec).not.toHaveBeenCalled();
    const pending = await listPending();
    expect(pending).toHaveLength(1);
  });

  it('removes successful ops from IDB after drain', async () => {
    const { enqueue, registerExecutor, drainAll, listAll } = await loadOutbox();
    registerExecutor('editor.create_room', vi.fn().mockResolvedValue({}));
    await enqueue('editor.create_room', { clientId: 'success', type: 'p', language: 1 });
    await drainAll();
    expect(await listAll()).toHaveLength(0);
  });

  it('failure of one op не блокирует drain'+'ом следующих', async () => {
    const { enqueue, registerExecutor, drainAll, listAll } = await loadOutbox();
    const fail = vi.fn().mockRejectedValue(new Error('network'));
    const ok = vi.fn().mockResolvedValue({});
    registerExecutor('editor.create_room', fail);
    registerExecutor('reflection.submit', ok);

    await enqueue('editor.create_room', { clientId: 'fail', type: 'p', language: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await enqueue('reflection.submit', { resourceId: 'r1', grade: 4 });

    const result = await drainAll();
    expect(result.done).toBe(1);
    expect(result.failed).toBe(1);
    expect(ok).toHaveBeenCalledTimes(1);
    expect(fail).toHaveBeenCalledTimes(1);

    // Failed op остаётся в IDB с bumped attempts.
    const all = await listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.attempts).toBe(1);
  });

  it('unknown op-kind leaves op untouched (для forward-compat)', async () => {
    const { enqueue, drainAll, listAll } = await loadOutbox();
    // Cast потому что 'future.op' не в OutboxOpKind union — но IDB не валидирует.
    await enqueue('future.op' as OutboxOpKind, { something: 'new' });
    const result = await drainAll();
    expect(result).toEqual({ done: 0, failed: 0 });
    expect(await listAll()).toHaveLength(1);
  });
});

describe('outbox — retry / max-attempts → dead-letter', () => {
  beforeEach(() => setOnline(true));

  it('bumps attempts on transient (retryable) failure', async () => {
    const { enqueue, registerExecutor, drainAll, listAll } = await loadOutbox();
    // Transient = throws без nonRetryable cause.
    registerExecutor('editor.create_room', vi.fn().mockRejectedValue(new Error('5xx')));
    await enqueue('editor.create_room', { clientId: 'r', type: 'p', language: 1 });

    await drainAll();
    let all = await listAll();
    expect(all[0]?.attempts).toBe(1);
    expect(all[0]?.dead).toBeFalsy();
    expect(all[0]?.lastError).toContain('5xx');

    await drainAll();
    all = await listAll();
    expect(all[0]?.attempts).toBe(2);
    expect(all[0]?.dead).toBeFalsy();
  });

  it('marks dead-letter after MAX_ATTEMPTS=5', async () => {
    const { enqueue, registerExecutor, drainAll, listAll, listPending } = await loadOutbox();
    registerExecutor('editor.create_room', vi.fn().mockRejectedValue(new Error('transient')));
    await enqueue('editor.create_room', { clientId: 'r', type: 'p', language: 1 });

    // 5 drains → 5 bump'ов → dead-letter.
    for (let i = 0; i < 5; i++) {
      await drainAll();
    }
    const all = await listAll();
    expect(all[0]?.attempts).toBe(5);
    expect(all[0]?.dead).toBe(true);

    // Pending excludes dead.
    expect(await listPending()).toHaveLength(0);
  });

  it('marks dead immediately if cause.nonRetryable=true (4xx semantics)', async () => {
    const { enqueue, registerExecutor, drainAll, listAll } = await loadOutbox();
    registerExecutor('editor.create_room', vi.fn().mockRejectedValue(
      Object.assign(new Error('403 forbidden'), { cause: { nonRetryable: true } }),
    ));
    await enqueue('editor.create_room', { clientId: 'r', type: 'p', language: 1 });

    await drainAll();
    const all = await listAll();
    expect(all[0]?.attempts).toBe(1);
    expect(all[0]?.dead).toBe(true);
    expect(all[0]?.lastError).toContain('403');
  });

  it('dead-letter ops не drain'+'ятся повторно', async () => {
    const { enqueue, registerExecutor, drainAll } = await loadOutbox();
    const exec = vi.fn().mockRejectedValue(
      Object.assign(new Error('forbidden'), { cause: { nonRetryable: true } }),
    );
    registerExecutor('editor.create_room', exec);
    await enqueue('editor.create_room', { clientId: 'r', type: 'p', language: 1 });

    await drainAll(); // op → dead
    expect(exec).toHaveBeenCalledTimes(1);

    // Повторные drain'ы не trigger'ят executor для dead-letter op'ы.
    await drainAll();
    await drainAll();
    expect(exec).toHaveBeenCalledTimes(1);
  });
});

describe('outbox — 409 conflict (current behavior)', () => {
  beforeEach(() => setOnline(true));

  // NOTE: Текущая wire.ts implementation: 409 → rpcError с nonRetryable=true
  // (т.к. 4xx-кроме-408/429). То есть outbox помечает op как dead-letter
  // на первом 409. ConflictModal surfaces UI hint, но retry-merge не
  // делается (все три handlers — no-op в maybeSurface409).
  it('409 (modeled as nonRetryable error) marks op as dead-letter', async () => {
    const { enqueue, registerExecutor, drainAll, listAll } = await loadOutbox();
    registerExecutor('editor.create_room', vi.fn().mockRejectedValue(
      Object.assign(new Error('editor.create_room (HTTP 409)'), {
        cause: { nonRetryable: true },
      }),
    ));
    await enqueue('editor.create_room', { clientId: 'dup', type: 'p', language: 1 });
    await drainAll();
    const all = await listAll();
    expect(all[0]?.dead).toBe(true);
    expect(all[0]?.attempts).toBe(1);
  });

  it('retryable 5xx errors не dead-letter на первом fail'+'е', async () => {
    const { enqueue, registerExecutor, drainAll, listAll } = await loadOutbox();
    registerExecutor('editor.create_room', vi.fn().mockRejectedValue(
      Object.assign(new Error('editor.create_room (HTTP 503)'), {
        cause: { nonRetryable: false },
      }),
    ));
    await enqueue('editor.create_room', { clientId: 'retry', type: 'p', language: 1 });
    await drainAll();
    const all = await listAll();
    expect(all[0]?.dead).toBeFalsy();
    expect(all[0]?.attempts).toBe(1);
  });
});

describe('outbox — online-restore', () => {
  it('installOutboxAutoDrain calls drainAll on construction', async () => {
    const { enqueue, registerExecutor, installOutboxAutoDrain } = await loadOutbox();
    const exec = vi.fn().mockResolvedValue({});
    registerExecutor('reflection.submit', exec);
    setOnline(true);

    await enqueue('reflection.submit', { resourceId: 'r', grade: 5 });
    installOutboxAutoDrain();

    // installOutboxAutoDrain делает immediate `drainAll().catch(...)` без
    // await'а. Ждём микротасков чтобы async chain прорезолвилcя.
    await flushAsync();
    await flushAsync();
    await flushAsync();

    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('drains pending ops after `online` event fire', async () => {
    const { enqueue, registerExecutor, installOutboxAutoDrain } = await loadOutbox();
    const exec = vi.fn().mockResolvedValue({});
    registerExecutor('editor.create_room', exec);

    setOnline(false);
    await enqueue('editor.create_room', { clientId: 'q', type: 'p', language: 1 });
    installOutboxAutoDrain();
    await flushAsync();
    expect(exec).not.toHaveBeenCalled(); // offline → no drain

    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await flushAsync();
    await flushAsync();
    await flushAsync();

    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('installOutboxAutoDrain idempotent — повторный install no-op', async () => {
    const { enqueue, registerExecutor, installOutboxAutoDrain } = await loadOutbox();
    const exec = vi.fn().mockResolvedValue({});
    registerExecutor('reflection.submit', exec);
    setOnline(true);

    installOutboxAutoDrain();
    installOutboxAutoDrain();
    installOutboxAutoDrain();
    await flushAsync();

    // Initial drain должен fire ровно один раз; повторные install'ы no-op
    // (`installed=true` short-circuit). Online listener тоже добавлен 1 раз.
    await enqueue('reflection.submit', { resourceId: 'r', grade: 5 });
    window.dispatchEvent(new Event('online'));
    await flushAsync();
    await flushAsync();

    // 1 initial-empty drain + 1 online drain = 1 exec call (initial был
    // пустой т.к. queue был empty).
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('FIFO restored after online — несколько pending ops drain'+'ятся в createdAt order', async () => {
    const { enqueue, registerExecutor, installOutboxAutoDrain } = await loadOutbox();
    const calls: string[] = [];
    registerExecutor('editor.create_room', async (payload) => {
      calls.push((payload as { clientId: string }).clientId);
    });

    setOnline(false);
    await enqueue('editor.create_room', { clientId: 'A', type: 'p', language: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await enqueue('editor.create_room', { clientId: 'B', type: 'p', language: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await enqueue('editor.create_room', { clientId: 'C', type: 'p', language: 1 });

    installOutboxAutoDrain();
    await flushAsync();
    expect(calls).toEqual([]);

    setOnline(true);
    window.dispatchEvent(new Event('online'));
    // Wait for drain to complete (3 IDB-cursor + 3 executor invocations).
    for (let i = 0; i < 10; i++) await flushAsync();

    expect(calls).toEqual(['A', 'B', 'C']);
  });
});

describe('outbox — multi op-kind isolation', () => {
  beforeEach(() => setOnline(true));

  it('routes payloads to correct executor by kind', async () => {
    const { enqueue, registerExecutor, drainAll } = await loadOutbox();
    const editorExec = vi.fn().mockResolvedValue({});
    const reflExec = vi.fn().mockResolvedValue({});
    const focusExec = vi.fn().mockResolvedValue({});

    registerExecutor('editor.create_room', editorExec);
    registerExecutor('reflection.submit', reflExec);
    registerExecutor('focus.reflection', focusExec);

    await enqueue('editor.create_room', { clientId: 'e', type: 'p', language: 1 });
    await enqueue('reflection.submit', { resourceId: 'r', grade: 4 });
    await enqueue('focus.reflection', {
      sessionId: 's', focusMode: 'pomodoro', durationSeconds: 1500,
      grade: 5, notes: '', startedAt: '2026-05-12T10:00:00Z', endedAt: '2026-05-12T10:25:00Z',
    });

    await drainAll();

    expect(editorExec).toHaveBeenCalledTimes(1);
    expect(reflExec).toHaveBeenCalledTimes(1);
    expect(focusExec).toHaveBeenCalledTimes(1);
  });

  it('failure of one kind не affects другие kinds', async () => {
    const { enqueue, registerExecutor, drainAll, listAll } = await loadOutbox();
    const failExec = vi.fn().mockRejectedValue(new Error('boom'));
    const okExec = vi.fn().mockResolvedValue({});

    registerExecutor('editor.create_room', failExec);
    registerExecutor('reflection.submit', okExec);

    await enqueue('editor.create_room', { clientId: 'f', type: 'p', language: 1 });
    await enqueue('reflection.submit', { resourceId: 'r', grade: 5 });

    const result = await drainAll();
    expect(result.done).toBe(1);
    expect(result.failed).toBe(1);

    const all = await listAll();
    // Failed editor op survived, ok reflection — removed.
    expect(all).toHaveLength(1);
    expect(all[0]?.kind).toBe('editor.create_room');
  });

  it('serverId из ExecutorResult пробрасывается в post-drain hook', async () => {
    const { enqueue, registerExecutor, registerPostDrainHook, drainAll } = await loadOutbox();
    const hookFn = vi.fn();
    registerPostDrainHook(hookFn);
    registerExecutor('editor.create_room', async (): Promise<ExecutorResult> => ({ serverId: 'srv-123' }));
    await enqueue('editor.create_room', { clientId: 'c', type: 'p', language: 1 });

    await drainAll();

    expect(hookFn).toHaveBeenCalledWith(
      'editor.create_room',
      expect.objectContaining({ clientId: 'c' }),
      { serverId: 'srv-123' },
    );
  });

  it('hook errors не блокируют op removal', async () => {
    const { enqueue, registerExecutor, registerPostDrainHook, drainAll, listAll } = await loadOutbox();
    const badHook = vi.fn().mockRejectedValue(new Error('hook fail'));
    registerPostDrainHook(badHook);
    registerExecutor('editor.create_room', vi.fn().mockResolvedValue({ serverId: 'srv-1' }));
    await enqueue('editor.create_room', { clientId: 'c', type: 'p', language: 1 });

    const result = await drainAll();
    expect(result.done).toBe(1);
    expect(badHook).toHaveBeenCalled();
    expect(await listAll()).toHaveLength(0); // op all-clear despite hook fail
  });
});

describe('outbox — persistence across module reload', () => {
  beforeEach(() => setOnline(true));

  it('ops survive module re-import (IDB-backed)', async () => {
    const ob1 = await loadOutbox();
    await ob1.enqueue('editor.create_room', { clientId: '1', type: 'p', language: 1 });
    // Small delay чтобы createdAt'ы различались (ms-precision).
    await new Promise((r) => setTimeout(r, 5));
    await ob1.enqueue('reflection.submit', { resourceId: 'r', grade: 4 });

    // Имитируем "reload" — fresh module, IDB остаётся.
    const ob2 = await loadOutbox();
    const pending = await ob2.listPending();
    expect(pending).toHaveLength(2);
    // FIFO ordering preserved across reload (createdAt-based).
    expect(pending[0]?.kind).toBe('editor.create_room');
    expect(pending[1]?.kind).toBe('reflection.submit');
  });

  it('removeOp purges op from IDB completely', async () => {
    const { enqueue, removeOp, listAll } = await loadOutbox();
    const id = await enqueue('reflection.submit', { resourceId: 'r', grade: 4 });

    await removeOp(id);
    expect(await listAll()).toHaveLength(0);

    // Verify persistence — fresh module load тоже empty.
    const ob2 = await loadOutbox();
    expect(await ob2.listAll()).toHaveLength(0);
  });
});
