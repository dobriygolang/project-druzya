// useDataState — uniform async fetch state machine для Hone.
//
// Заменяет ad-hoc `useState<T|null> + .catch(silent)` паттерн который сейчас
// размазан по 20+ страницам (Stats / Coach / DailyBrief / etc.). Каждая
// fetch'ая выдаёт в state ленту loading / ready / error и retry-функцию,
// которые далее рендерит <DataLoader> wrapper — see components/DataLoader.tsx.
//
// API намеренно отличается от React Query: Hone'у не нужен query cache (95%
// pages — single fetch per mount, refetch только по explicit user action),
// outbox + offline уже отдельный слой. Локальная state machine — 30 строк
// без deps — точно соответствует Hone's «keyboard-first, no SaaS» эстетике.

import { useCallback, useEffect, useState } from 'react';

type DataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface DataState<T> {
  data: T | null;
  status: DataStatus;
  error: Error | null;
  /** Resubmit fetcher. Status flips back to 'loading'. */
  refetch: () => void;
}

/**
 * useDataState — wires a Promise-returning fetcher into a finite state
 * machine. Cancels in-flight requests on unmount (no setState on dead
 * components) и предоставляет refetch для retry button'ов.
 *
 * @param fetcher Promise-returning function (will be invoked on mount +
 *                deps change + manual refetch).
 * @param deps    Dependency array — refetch when any changes. Pass `[]`
 *                for «once per mount» semantics.
 *
 * Example:
 *
 *   const stats = useDataState(() => getStats(), []);
 *   return <DataLoader state={stats} skeleton={<StatsSkeleton />}>
 *     {(data) => <StatsBody data={data} />}
 *   </DataLoader>;
 */
export function useDataState<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): DataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<DataStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    fetcher()
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, status, error, refetch };
}
