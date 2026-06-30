import { Suspense, lazy, memo, useEffect, useState } from 'react';

const CalendarModal = lazy(() =>
  import('@pages/Calendar/CalendarModal').then((m) => ({ default: m.CalendarModal })),
);

const UNMOUNT_DELAY_MS = 420;

export const AnimatedCalendarOverlay = memo(function AnimatedCalendarOverlay({
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
      <CalendarModal onClose={onClose} closing={closing} />
    </Suspense>
  );
});
