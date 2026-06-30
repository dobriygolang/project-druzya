import { useCallback, useEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD_PX = 5;

interface DragSession {
  taskId: string;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  el: HTMLElement;
  ghost: HTMLElement | null;
  active: boolean;
}

function dayKeyFromPoint(x: number, y: number): string | null {
  const hit = document.elementFromPoint(x, y);
  return hit?.closest('[data-day-key]')?.getAttribute('data-day-key') ?? null;
}

function taskIdFromPoint(x: number, y: number): string | null {
  const hit = document.elementFromPoint(x, y);
  return hit?.closest('[data-task-id]')?.getAttribute('data-task-id') ?? null;
}

function createGhost(fromEl: HTMLElement): HTMLElement {
  const ghost = fromEl.cloneNode(true) as HTMLElement;
  ghost.style.position = 'fixed';
  ghost.style.zIndex = '9999';
  ghost.style.pointerEvents = 'none';
  ghost.style.width = `${fromEl.offsetWidth}px`;
  ghost.style.opacity = '0.88';
  ghost.style.background = 'rgb(22 22 22 / 0.96)';
  ghost.style.borderRadius = '12px';
  document.body.appendChild(ghost);
  return ghost;
}

function moveGhost(ghost: HTMLElement, x: number, y: number, offsetX: number, offsetY: number): void {
  ghost.style.left = `${x - offsetX}px`;
  ghost.style.top = `${y - offsetY}px`;
}

function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
}

function setDragSelectLock(locked: boolean): void {
  document.body.style.userSelect = locked ? 'none' : '';
  document.documentElement.style.userSelect = locked ? 'none' : '';
  document.body.classList.toggle('hone-task-dragging', locked);
}

/** Pointer drag with floating ghost — reliable in Tauri/WKWebView where HTML5 drop often fails.
 *  Reports both the target day column and the task row under the pointer so the
 *  caller can either move the task to another day or reorder within the same day. */
export function useDayTaskDrag(
  onDrop: (taskId: string, dayKey: string, targetTaskId: string | null) => void,
) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [dropTaskId, setDropTaskId] = useState<string | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const cleanup = useCallback(() => {
    const s = sessionRef.current;
    if (s?.el) {
      s.el.style.pointerEvents = '';
      try {
        s.el.releasePointerCapture(s.pointerId);
      } catch {
        /* capture may already be released */
      }
    }
    if (s?.ghost) s.ghost.remove();
    sessionRef.current = null;
    setDraggingId(null);
    setDropDay(null);
    setDropTaskId(null);
    setDragSelectLock(false);
    document.body.style.cursor = '';
    clearTextSelection();
  }, []);

  const onPointerDragStart = useCallback((taskId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    clearTextSelection();
    setDragSelectLock(true);

    const el = e.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const rect = el.getBoundingClientRect();
    sessionRef.current = {
      taskId,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      el,
      ghost: null,
      active: false,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || e.pointerId !== s.pointerId) return;

      if (!s.active) {
        const dist = Math.hypot(e.clientX - s.startX, e.clientY - s.startY);
        if (dist < DRAG_THRESHOLD_PX) return;

        s.active = true;
        clearTextSelection();
        s.el.style.pointerEvents = 'none';
        s.ghost = createGhost(s.el);
        moveGhost(s.ghost, e.clientX, e.clientY, s.offsetX, s.offsetY);
        setDraggingId(s.taskId);
        document.body.style.cursor = 'grabbing';
      }

      if (s.ghost) moveGhost(s.ghost, e.clientX, e.clientY, s.offsetX, s.offsetY);
      const dayKey = dayKeyFromPoint(e.clientX, e.clientY);
      const targetTaskId = taskIdFromPoint(e.clientX, e.clientY);
      setDropDay((prev) => (prev === dayKey ? prev : dayKey));
      setDropTaskId((prev) => (prev === targetTaskId ? prev : targetTaskId));
    };

    const onUp = (e: PointerEvent) => {
      const s = sessionRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      if (s.active) {
        const dayKey = dayKeyFromPoint(e.clientX, e.clientY);
        const targetTaskId = taskIdFromPoint(e.clientX, e.clientY);
        if (dayKey) onDropRef.current(s.taskId, dayKey, targetTaskId);
      }
      cleanup();
    };

    const onSelectStart = (e: Event) => {
      if (sessionRef.current) e.preventDefault();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.addEventListener('selectstart', onSelectStart);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('selectstart', onSelectStart);
    };
  }, [cleanup]);

  return { draggingId, dropDay, dropTaskId, onPointerDragStart };
}
