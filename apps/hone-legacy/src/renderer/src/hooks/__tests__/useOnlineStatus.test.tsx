// useOnlineStatus.test.tsx — реактивно отслеживает navigator.onLine.
//
// Покрытие:
//   • Initial render: возвращает navigator.onLine (true / false).
//   • window.dispatchEvent('online') → state flips to true.
//   • window.dispatchEvent('offline') → state flips to false.
//   • Multiple consumers разделяют один listener pattern (каждый держит свой
//     useState — оба обновляются).
//   • Unmount → listener detached: subsequent events не падают, не leak'ают
//     state changes на removed components.
//
// Render strategy: createRoot + react-dom/client + react.act() — паттерн из
// useDataState.test.tsx (testing-library/react не установлен).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { createElement, act, type ReactElement } from 'react';

import { useOnlineStatus } from '../useOnlineStatus';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

// navigator.onLine: stub via getter. happy-dom default = true (см test/setup.ts);
// перетираем под конкретный тест.
function setOnline(v: boolean): void {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => v,
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  setOnline(true);
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  setOnline(true); // restore default чтобы не зацепить следующий тест
});

interface Captured {
  latest: boolean | null;
  history: boolean[];
}

function HookHarness({ captured }: { captured: Captured }): ReactElement {
  const online = useOnlineStatus();
  captured.latest = online;
  captured.history.push(online);
  return createElement('div', { 'data-testid': 'status' }, online ? 'online' : 'offline');
}

describe('useOnlineStatus — initial state', () => {
  it('returns true когда navigator.onLine=true', async () => {
    setOnline(true);
    const captured: Captured = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness, { captured }));
    });
    expect(captured.latest).toBe(true);
  });

  it('returns false когда navigator.onLine=false на mount', async () => {
    setOnline(false);
    const captured: Captured = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness, { captured }));
    });
    expect(captured.latest).toBe(false);
  });
});

describe('useOnlineStatus — event reactivity', () => {
  it('online event → state flips true', async () => {
    setOnline(false);
    const captured: Captured = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness, { captured }));
    });
    expect(captured.latest).toBe(false);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(captured.latest).toBe(true);
  });

  it('offline event → state flips false', async () => {
    setOnline(true);
    const captured: Captured = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness, { captured }));
    });
    expect(captured.latest).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(captured.latest).toBe(false);
  });

  it('toggle sequence online→offline→online', async () => {
    setOnline(true);
    const captured: Captured = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness, { captured }));
    });
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(captured.latest).toBe(false);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });
    expect(captured.latest).toBe(true);
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(captured.latest).toBe(false);
  });
});

describe('useOnlineStatus — cleanup', () => {
  it('после unmount события не обновляют state и не throw\'ят', async () => {
    setOnline(true);
    const captured: Captured = { latest: null, history: [] };
    await act(async () => {
      root!.render(createElement(HookHarness, { captured }));
    });
    const historyAtUnmount = captured.history.length;
    await act(async () => {
      root!.unmount();
    });
    // Listener должен быть removed — emit event'а не падает и не пишет в history.
    expect(() => window.dispatchEvent(new Event('offline'))).not.toThrow();
    expect(captured.history.length).toBe(historyAtUnmount);
  });
});

describe('useOnlineStatus — multiple consumers', () => {
  it('два независимых hook-инстанса оба обновляются на одном event', async () => {
    setOnline(true);
    const a: Captured = { latest: null, history: [] };
    const b: Captured = { latest: null, history: [] };
    function Pair(): ReactElement {
      return createElement(
        'div',
        null,
        createElement(HookHarness, { captured: a }),
        createElement(HookHarness, { captured: b }),
      );
    }
    await act(async () => {
      root!.render(createElement(Pair));
    });
    expect(a.latest).toBe(true);
    expect(b.latest).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(a.latest).toBe(false);
    expect(b.latest).toBe(false);
  });
});
