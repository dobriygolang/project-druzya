import { useCallback, useEffect, useRef, useState } from 'react';

const MOVE_THRESHOLD_PX = 3;

interface DragConfig {
  /** Stable id of the dragged block. */
  id: string;
  /** Current top offset (px) of the block before dragging. */
  baseTop: number;
  /** Lowest allowed top (px). */
  min: number;
  /** Highest allowed top (px). */
  max: number;
  /** Called on release after an actual drag, with the clamped final top (px). */
  onCommit: (top: number) => void;
  /** Called on release without movement (treated as a click). */
  onClick?: () => void;
}

interface Session extends DragConfig {
  startY: number;
  pointerId: number;
  el: HTMLElement;
  moved: boolean;
}

/**
 * Vertical pointer drag for absolutely-positioned time blocks (calendar grids).
 * Distinguishes a click (no movement) from a drag so callers can keep an
 * on-click action (e.g. open task) alongside drag-to-reschedule.
 */
export function useVerticalDrag(): {
  dragId: string | null;
  dragTop: number;
  start: (e: React.PointerEvent, cfg: DragConfig) => void;
} {
  const [active, setActive] = useState<{ id: string; top: number } | null>(null);
  const sessionRef = useRef<Session | null>(null);

  const start = useCallback((e: React.PointerEvent, cfg: DragConfig) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    sessionRef.current = {
      ...cfg,
      startY: e.clientY,
      pointerId: e.pointerId,
      el,
      moved: false,
    };
    setActive({ id: cfg.id, top: cfg.baseTop });
  }, []);

  useEffect(() => {
    const clampTop = (s: Session, dy: number) =>
      Math.max(s.min, Math.min(s.max, s.baseTop + dy));

    const onMove = (e: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      const dy = e.clientY - s.startY;
      if (Math.abs(dy) > MOVE_THRESHOLD_PX) s.moved = true;
      setActive({ id: s.id, top: clampTop(s, dy) });
    };

    const finish = (e: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      const top = clampTop(s, e.clientY - s.startY);
      try {
        s.el.releasePointerCapture(s.pointerId);
      } catch {
        /* ignore */
      }
      sessionRef.current = null;
      setActive(null);
      if (s.moved) s.onCommit(top);
      else s.onClick?.();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, []);

  return { dragId: active?.id ?? null, dragTop: active?.top ?? 0, start };
}
