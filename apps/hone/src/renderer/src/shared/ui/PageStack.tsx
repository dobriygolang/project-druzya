import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

import type { PageId } from '@widgets/Palette';

import { PageSkeleton } from './Skeleton';

const PAGE_FADE_MS = 440;

type LayerStatus = 'active' | 'entering' | 'leaving';

interface Layer {
  id: PageId;
  status: LayerStatus;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function PageStack({
  page,
  children,
}: {
  page: PageId;
  children: (id: PageId) => ReactNode;
}): JSX.Element {
  const [layers, setLayers] = useState<Layer[]>([{ id: page, status: 'active' }]);
  const timerRef = useRef<number>();
  const activeRef = useRef(page);

  useEffect(() => {
    if (activeRef.current === page) return;
    activeRef.current = page;

    if (prefersReducedMotion()) {
      setLayers([{ id: page, status: 'active' }]);
      return;
    }

    setLayers((prev) => [
      ...prev.map((l) =>
        l.status === 'active' || l.status === 'entering'
          ? { ...l, status: 'leaving' as const }
          : l,
      ),
      { id: page, status: 'entering' as const },
    ]);

    const enterRaf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setLayers((prev) =>
          prev.map((l) => (l.status === 'entering' ? { ...l, status: 'active' as const } : l)),
        );
      });
    });

    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setLayers((prev) => prev.filter((l) => l.status !== 'leaving'));
    }, PAGE_FADE_MS);

    return () => {
      cancelAnimationFrame(enterRaf);
      window.clearTimeout(timerRef.current);
    };
  }, [page]);

  return (
    <>
      {layers.map((layer) => (
        <div
          key={layer.id}
          className="hone-page-layer"
          data-status={layer.status}
          aria-hidden={layer.status === 'leaving' ? true : undefined}
        >
          <Suspense fallback={<PageSkeleton />}>{children(layer.id)}</Suspense>
        </div>
      ))}
    </>
  );
}
