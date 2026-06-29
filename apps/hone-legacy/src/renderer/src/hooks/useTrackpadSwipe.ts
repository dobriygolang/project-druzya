// useTrackpadSwipe — Mac-style 2-finger horizontal swipe → Stats overlay.
//
// Swipe LEFT (deltaX > 0, content скроллится вправо) → открыть Stats.
// Swipe RIGHT (deltaX < 0) → закрыть Stats / no-op.
//
// Mac trackpad шлёт wheel-event'ы с `deltaX` как continuous flow, не
// discrete как mouse-wheel — так что нужна threshold'ная аккумуляция в
// rolling window'е, иначе один micro-swipe запустит overlay.
import { useEffect } from 'react';

const THRESHOLD = 140; // px — после которого fire'им action
const RESET_GAP_MS = 300; // если паузу >300ms — сбрасываем accumulator
const COOLDOWN_MS = 700; // после fire — игнорируем дальнейшие deltas

export function useTrackpadSwipe(statsOpen: boolean, setStatsOpen: (open: boolean) => void): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let accDx = 0; // accumulator
    let lastEvtAt = 0;
    let cooldownUntil = 0;
    const onWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now < cooldownUntil) return;
      // Игнорируем vertical-доminant'ы (классический mouse-wheel scroll
      // вверх-вниз) — нам нужен только горизонтальный pure swipe.
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5) return;
      // Mouse-wheel'ы обычно дают deltaMode=DOM_DELTA_LINE (1), trackpad —
      // DOM_DELTA_PIXEL (0). Reject не-pixel input — это явно mouse, не
      // trackpad swipe.
      if (e.deltaMode !== 0) return;
      // Пауза → reset accumulator.
      if (now - lastEvtAt > RESET_GAP_MS) accDx = 0;
      lastEvtAt = now;
      accDx += e.deltaX;
      if (accDx > THRESHOLD) {
        if (!statsOpen) {
          setStatsOpen(true);
        }
        accDx = 0;
        cooldownUntil = now + COOLDOWN_MS;
      } else if (accDx < -THRESHOLD) {
        if (statsOpen) {
          setStatsOpen(false);
        }
        accDx = 0;
        cooldownUntil = now + COOLDOWN_MS;
      }
    };
    // passive=true — мы не e.preventDefault'им (хотим чтобы scroll тоже
    // работал normally на других элементах).
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [statsOpen, setStatsOpen]);
}
