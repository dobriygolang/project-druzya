// lifecycle.test.ts — end-to-end-ish smoke test для offline-flow'а:
//
//   1. Start offline. Enqueue mixed-kind ops.
//   2. Simulate crash (re-import module, IDB persists).
//   3. Flip online + fire `online` event.
//   4. Assert all ops drained в createdAt order, IDB cleared.
//
// Tests the "хочу спокойно работать в самолёте" guarantee end-to-end,
// not just unit-level: catching regressions where outbox + wire combo
// breaks даже если each layer'а unit tests pass'ятся.
//
// Mocks: те же что в wire.test.ts — мы стуб'аем api/* чтобы драйв через
// настоящий fetch без backend'а.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock chain mirror'ит wire.test.ts ──────────────────────────────────
vi.mock('../../stores/session', () => ({
  useSessionStore: { getState: () => ({ accessToken: 'tok' }) },
}));
vi.mock('../../api/config', () => ({
  API_BASE_URL: 'http://test-api',
  DEV_BEARER_TOKEN: null,
  WEB_BASE_URL: 'http://test',
  PRO_UPGRADE_URL_BASE: 'http://test',
  PRO_BYOK_URL: 'http://test',
}));

const endFocusSessionMock = vi.fn().mockResolvedValue({ sessionId: 's' });
vi.mock('../../api/focusClient', () => ({
  endFocusSession: (...args: unknown[]) => endFocusSessionMock(...args),
}));

vi.mock('../../components/ConflictModal', () => ({
  emitConflict: vi.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────

interface FetchCall {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}
let fetchCalls: FetchCall[] = [];

function setupFetch(): void {
  globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({
      url: String(url),
      method: (init?.method ?? 'GET') as string,
      body: init?.body ? JSON.parse(init.body as string) : null,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    // По умолчанию ok — каждый endpoint вернёт минимальный success body.
    return new Response(JSON.stringify({ id: 'srv-id-1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

function setOnline(b: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => b });
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

beforeEach(() => {
  fetchCalls = [];
  setupFetch();
  editorSetVisibility.mockResolvedValue('private');
  whiteboardSetVisibility.mockResolvedValue('private');
  endFocusSessionMock.mockResolvedValue({ sessionId: 's' });
  saveFocusReflectionMock.mockResolvedValue({ reflectionId: 'r' });
});

afterEach(() => {
  delete (globalThis as { fetch?: typeof fetch }).fetch;
});

// ─── Full lifecycle ─────────────────────────────────────────────────────

describe('lifecycle — offline → crash → online → drain', () => {
  it('5 mixed ops enqueued offline, drained in order after online-restore', async () => {
    setOnline(false);

    // Phase 1: enqueue 5 ops via fresh module.
    vi.resetModules();
    let outbox = await import('../outbox');
    // ID-stable mode: каждое enqueue с 5ms delay для unique createdAt.
    await outbox.enqueue('editor.create_room', { clientId: 'c1', type: 'practice', language: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await outbox.enqueue('reflection.submit', { resourceId: 'r1', grade: 4 });
    await new Promise((r) => setTimeout(r, 5));
    await outbox.enqueue('focus.end', {
      sessionId: 'sess', pomodorosCompleted: 1, secondsFocused: 1500,
    });
    await new Promise((r) => setTimeout(r, 5));
    await outbox.enqueue('external_activity.log', {
      source: 'cf', topic: 'binary-search',
    });
    await new Promise((r) => setTimeout(r, 5));
    await outbox.enqueue('focus.reflection', {
      sessionId: 'sess', focusMode: 'pomodoro', durationSeconds: 1500,
      grade: 5, notes: 'good', startedAt: '2026-05-12T10:00:00Z',
      endedAt: '2026-05-12T10:25:00Z',
    });

    // Verify all 5 в IDB.
    expect(await outbox.listPending()).toHaveLength(5);

    // Phase 2: simulate crash (fresh module load — IDB persists).
    vi.resetModules();
    outbox = await import('../outbox');
    const wire = await import('../wire');
    wire.wireOutboxExecutors();

    expect(await outbox.listPending()).toHaveLength(5);

    // Phase 3: go online + drain.
    setOnline(true);
    const result = await outbox.drainAll();

    // Phase 4: assert.
    expect(result.done).toBe(5);
    expect(result.failed).toBe(0);
    expect(await outbox.listAll()).toHaveLength(0); // IDB cleared

    // Verify executor calls happened — 3 fetch'и (editor.create_room,
    // reflection.submit, external_activity.log) + 2 RPC wrappers
    // (focus.end, focus.reflection).
    expect(fetchCalls).toHaveLength(3);
    expect(endFocusSessionMock).toHaveBeenCalledTimes(1);
    expect(saveFocusReflectionMock).toHaveBeenCalledTimes(1);

    // FIFO: editor.create_room сначала.
    expect(fetchCalls[0]?.url).toBe('http://test-api/api/v1/editor/room');
    expect(fetchCalls[1]?.url).toBe('http://test-api/api/v1/curation/reflection');
    expect(fetchCalls[2]?.url).toBe('http://test-api/api/v1/hone/external-activity');
  });

  it('auto-drain через installOutboxAutoDrain срабатывает на `online` event', async () => {
    setOnline(false);

    vi.resetModules();
    const outbox = await import('../outbox');
    const wire = await import('../wire');
    wire.wireOutboxExecutors();

    await outbox.enqueue('focus.end', {
      sessionId: 's1', pomodorosCompleted: 1, secondsFocused: 1500,
    });

    outbox.installOutboxAutoDrain();
    await flushAsync(); // initial drain (offline → no-op)
    expect(endFocusSessionMock).not.toHaveBeenCalled();

    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await flushAsync();
    await flushAsync();

    expect(endFocusSessionMock).toHaveBeenCalledTimes(1);
    expect(await outbox.listAll()).toHaveLength(0);
  });

  it('partial failure: одна op fail'+'ит, остальные drain'+'ятся (no cascade)', async () => {
    setOnline(true);

    vi.resetModules();
    const outbox = await import('../outbox');
    const wire = await import('../wire');
    wire.wireOutboxExecutors();

    // Fail mock'аем фокус-end (RPC throws).
    endFocusSessionMock.mockRejectedValueOnce(new Error('5xx transient'));

    await outbox.enqueue('focus.end', {
      sessionId: 's1', pomodorosCompleted: 0, secondsFocused: 0,
    });
    await new Promise((r) => setTimeout(r, 5));
    await outbox.enqueue('reflection.submit', { resourceId: 'r1', grade: 5 });

    const result = await outbox.drainAll();
    expect(result.done).toBe(1);
    expect(result.failed).toBe(1);

    const all = await outbox.listAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.kind).toBe('focus.end');
    expect(all[0]?.attempts).toBe(1);
  });

  it('dead-letter ops оставляются в IDB при retry'+'ах + не блокируют новые', async () => {
    setOnline(true);

    vi.resetModules();
    const outbox = await import('../outbox');
    const wire = await import('../wire');
    wire.wireOutboxExecutors();

    // First op fails permanently — mock fetch to 403 на первой call'е.
    let callCount = 0;
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      callCount += 1;
      fetchCalls.push({
        url: String(url),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(init.body as string) : null,
        headers: (init?.headers ?? {}) as Record<string, string>,
      });
      // First call: 403 nonRetryable. Subsequent: 200 OK.
      if (callCount === 1) {
        return new Response(JSON.stringify({}), { status: 403 });
      }
      return new Response(JSON.stringify({ id: 'ok' }), { status: 200 });
    }) as unknown as typeof fetch;

    await outbox.enqueue('editor.create_room', {
      clientId: 'bad', type: 'practice', language: 1,
    });
    await new Promise((r) => setTimeout(r, 5));
    await outbox.enqueue('reflection.submit', { resourceId: 'r', grade: 5 });

    await outbox.drainAll();
    let all = await outbox.listAll();
    expect(all).toHaveLength(1); // bad op dead, good op removed
    expect(all[0]?.dead).toBe(true);

    // Second drain — dead op skipped.
    await outbox.drainAll();
    expect(fetchCalls).toHaveLength(2); // 1 failed + 1 success — no retry
  });
});
