import { Suspense, lazy, memo, useEffect, useState } from 'react';

const StatsOverlayCards = lazy(() =>
  import('./StatsOverlayCards').then((m) => ({ default: m.StatsOverlayCards })),
);

const UNMOUNT_DELAY_MS = 420;

export const AnimatedStatsOverlay = memo(function AnimatedStatsOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, UNMOUNT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <StatsOverlayCards onClose={onClose} closing={closing} />
    </Suspense>
  );
});
