import { Suspense, lazy, useCallback, useEffect, useState } from 'react';

import { zIndex } from '@shared/lib/z-index';
import { PageSkeleton } from '@shared/ui/Skeleton';

const Stats = lazy(() => import('@pages/Stats').then((m) => ({ default: m.Stats })));

interface StatsOverlayProps {
  onClose: () => void;
}

export function StatsOverlay({ onClose }: StatsOverlayProps): JSX.Element {
  const [closing, setClosing] = useState(false);

  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(() => onClose(), 280);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        requestClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [requestClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close stats"
        className="fadein"
        onClick={requestClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: zIndex.overlay,
          border: 'none',
          padding: 0,
          background: 'rgb(0 0 0 / 0.28)',
          cursor: 'default',
          WebkitAppRegion: 'no-drag',
        }}
      />
      <aside
        className={closing ? 'slide-to-right' : 'slide-from-right'}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(440px, 92vw)',
          zIndex: zIndex.overlay + 1,
          background: 'var(--bg)',
          borderLeft: '1px solid var(--ink-tint-08)',
          boxShadow: '-12px 0 40px rgb(0 0 0 / 0.35)',
          overflow: 'hidden',
          WebkitAppRegion: 'no-drag',
        }}
      >
        <Suspense fallback={<PageSkeleton />}>
          <Stats variant="overlay" onClose={requestClose} />
        </Suspense>
      </aside>
    </>
  );
}
