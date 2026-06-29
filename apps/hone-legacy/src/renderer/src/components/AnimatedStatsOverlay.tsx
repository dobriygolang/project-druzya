// AnimatedStatsOverlay — обёртка вокруг <StatsOverlay/>, которая откладывает
// unmount на длительность slide-to-right анимации, чтобы юзер видел плавный
// уход карточек вправо вместо мгновенного снятия.
import { Suspense, lazy, memo, useEffect, useState } from 'react';

const StatsOverlay = lazy(() =>
  import('./StatsOverlay').then((m) => ({ default: m.StatsOverlay })),
);

// slide-to-right (220ms) + max delay (120ms) + buffer
const UNMOUNT_DELAY_MS = 360;

export const AnimatedStatsOverlay = memo(function AnimatedStatsOverlay({ open, onClose }: { open: boolean; onClose: () => void }): JSX.Element | null {
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
      <StatsOverlay onClose={onClose} closing={closing} />
    </Suspense>
  );
});
