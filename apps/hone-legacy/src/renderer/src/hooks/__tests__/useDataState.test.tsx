// useDataState.test.tsx — finite state machine для async fetchers.
//
// Тестовая стратегия:
//   @testing-library/react не установлен. Render'им компонент через
//   react-dom/client.createRoot + use react-dom/test-utils.act().
//   Hook читаем через DOM (рендерим текущее значение в <div data-testid="...">),
//   избегая custom renderHook'а который требует @testing-library/react.
//
// Покрытие:
//   • idle → loading → ready на success path'е
//   • idle → loading → error на rejection (включая non-Error throw → wrap)
//   • cancellation: unmount пока fetch in-flight → нет state-mutation
//   • refetch(): ready → loading → ready
//   • deps change → автоматический re-fetch
//   • Data shape preservation (любой T)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { createElement, useEffect, useRef, act, type ReactElement } from 'react';

import { useDataState, type DataState } from '../useDataState';

// Enable React act() environment чтобы скрыть warning'и + ensure
// concurrent-mode batching работает predictable.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

interface Captured<T> {
  latest: DataState<T> | null;
  history: Array<{ status: string; data: T | null; error: string | null }>;
}

/**
 * HookHarness — рендерит useDataState и пишет каждое его значение
 * в captured.history. Это даёт нам assertion'ы на полную последовательность
 * status'ов без `waitFor`.
 */
function HookHarness<T>(props: {
  fetcher: () => Promise<T>;
  deps: ReadonlyArray<unknown>;
  captured: Captured<T>;
  exposeRefetch?: { current: (() => void) | null };
}): ReactElement {
  const state = useDataState(props.fetcher, props.deps);
  const refCount = useRef(0);
  refCount.current += 1;
  props.captured.latest = state;
  props.captured.history.push({
    status: state.status,
    data: state.data,
    error: state.error ? state.error.message : null,
  });
  // Каждый render записываем актуальный refetch в exposed ref чтобы
  // тесты могли его триггерить.
  useEffect(() => {
    if (props.exposeRefetch) props.exposeRefetch.current = state.refetch;
  });
  return createElement('div', { 'data-testid': 'status' }, state.status);
}

async function flush(): Promise<void> {
  // Дренируем promise microtasks → useEffect → setState → react render.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useDataState — success path', () => {
  it('idle → loading → ready с resolved data', async () => {
    const d = deferred<number>();
    const captured: Captured<number> = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness<number>, { fetcher: () => d.promise, deps: [], captured }));
    });

    // Первый mount: synchronously useEffect → setStatus('loading').
    // history содержит как минимум idle/loading initial state.
    expect(captured.latest?.status).toBe('loading');
    expect(captured.latest?.data).toBeNull();

    await act(async () => {
      d.resolve(42);
      await flush();
    });

    expect(captured.latest?.status).toBe('ready');
    expect(captured.latest?.data).toBe(42);
    expect(captured.latest?.error).toBeNull();
  });

  it('preserves object data shape', async () => {
    const d = deferred<{ count: number; items: string[] }>();
    const captured: Captured<{ count: number; items: string[] }> = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness, { fetcher: () => d.promise, deps: [], captured }));
    });
    await act(async () => {
      d.resolve({ count: 2, items: ['a', 'b'] });
      await flush();
    });
    expect(captured.latest?.data).toEqual({ count: 2, items: ['a', 'b'] });
  });
});

describe('useDataState — error path', () => {
  it('rejected Error → status=error + error preserved', async () => {
    const d = deferred<string>();
    const captured: Captured<string> = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness<string>, { fetcher: () => d.promise, deps: [], captured }));
    });
    await act(async () => {
      d.reject(new Error('boom'));
      await flush();
    });
    expect(captured.latest?.status).toBe('error');
    expect(captured.latest?.error?.message).toBe('boom');
    expect(captured.latest?.data).toBeNull();
  });

  it('rejected non-Error wrapped via String(err)', async () => {
    const d = deferred<string>();
    const captured: Captured<string> = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness<string>, { fetcher: () => d.promise, deps: [], captured }));
    });
    await act(async () => {
      d.reject('plain string fail');
      await flush();
    });
    expect(captured.latest?.status).toBe('error');
    expect(captured.latest?.error).toBeInstanceOf(Error);
    expect(captured.latest?.error?.message).toBe('plain string fail');
  });

  it('rejected number → wrap String(err)', async () => {
    const d = deferred<unknown>();
    const captured: Captured<unknown> = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness, { fetcher: () => d.promise, deps: [], captured }));
    });
    await act(async () => {
      d.reject(404);
      await flush();
    });
    expect(captured.latest?.error?.message).toBe('404');
  });
});

describe('useDataState — cancellation', () => {
  it('unmount пока fetcher in-flight → нет dead-set-state', async () => {
    const d = deferred<number>();
    const captured: Captured<number> = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness<number>, { fetcher: () => d.promise, deps: [], captured }));
    });
    expect(captured.latest?.status).toBe('loading');

    // Unmount before resolution.
    await act(async () => {
      root!.unmount();
    });
    const lastHistoryLength = captured.history.length;

    // Resolve teh promise after unmount. Не должно быть new render entries.
    await act(async () => {
      d.resolve(99);
      await flush();
    });
    expect(captured.history.length).toBe(lastHistoryLength);
    expect(captured.latest?.data).toBeNull();
  });

  it('superseded fetch не пишет stale result', async () => {
    const d1 = deferred<string>();
    const d2 = deferred<string>();
    let depKey = 'a';
    const fetcher = vi.fn(() => (depKey === 'a' ? d1.promise : d2.promise));
    const captured: Captured<string> = { latest: null, history: [] };

    function Wrapper({ k }: { k: string }): ReactElement {
      depKey = k;
      return createElement(HookHarness<string>, { fetcher, deps: [k], captured });
    }

    await act(async () => {
      root!.render(createElement(Wrapper, { k: 'a' }));
    });
    // Меняем dep до того, как d1 resolve'ится — это запустит second fetch.
    await act(async () => {
      root!.render(createElement(Wrapper, { k: 'b' }));
    });
    // Резолвим первый stale fetch — он должен быть проигнорирован.
    await act(async () => {
      d1.resolve('STALE');
      await flush();
    });
    expect(captured.latest?.data).toBeNull(); // still loading second
    expect(captured.latest?.status).toBe('loading');

    // Резолвим second — он попадает в state.
    await act(async () => {
      d2.resolve('FRESH');
      await flush();
    });
    expect(captured.latest?.data).toBe('FRESH');
    expect(captured.latest?.status).toBe('ready');
  });
});

describe('useDataState — refetch + deps', () => {
  it('refetch() заставляет повторный вызов fetcher', async () => {
    let callCount = 0;
    const resolvers: Array<(v: string) => void> = [];
    const fetcher = (): Promise<string> => {
      callCount += 1;
      return new Promise((res) => resolvers.push(res));
    };
    const captured: Captured<string> = { latest: null, history: [] };
    const refetchRef: { current: (() => void) | null } = { current: null };
    await act(async () => {
      root!.render(
        createElement(HookHarness<string>, { fetcher, deps: [], captured, exposeRefetch: refetchRef }),
      );
    });
    await act(async () => {
      resolvers[0]('one');
      await flush();
    });
    expect(callCount).toBe(1);
    expect(captured.latest?.data).toBe('one');

    await act(async () => {
      refetchRef.current?.();
      await flush();
    });
    expect(callCount).toBe(2);
    expect(captured.latest?.status).toBe('loading');

    await act(async () => {
      resolvers[1]('two');
      await flush();
    });
    expect(captured.latest?.data).toBe('two');
    expect(captured.latest?.status).toBe('ready');
  });

  it('deps change → автоматический re-fetch', async () => {
    let callCount = 0;
    const fetcher = vi.fn(() => {
      callCount += 1;
      return Promise.resolve(callCount);
    });
    const captured: Captured<number> = { latest: null, history: [] };
    function Wrapper({ k }: { k: number }): ReactElement {
      return createElement(HookHarness<number>, { fetcher, deps: [k], captured });
    }
    await act(async () => {
      root!.render(createElement(Wrapper, { k: 1 }));
    });
    await act(async () => {
      await flush();
    });
    expect(captured.latest?.data).toBe(1);

    await act(async () => {
      root!.render(createElement(Wrapper, { k: 2 }));
    });
    await act(async () => {
      await flush();
    });
    expect(callCount).toBe(2);
    expect(captured.latest?.data).toBe(2);
  });
});
