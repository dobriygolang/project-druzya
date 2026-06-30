export interface Point {
  x: number;
  y: number;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function waitWhile(paused: () => boolean, intervalMs = 80): Promise<void> {
  return new Promise((resolve) => {
    const tick = () => {
      if (!paused()) {
        resolve();
        return;
      }
      window.setTimeout(tick, intervalMs);
    };
    tick();
  });
}

export function query(root: HTMLElement, sel: string): HTMLElement | null {
  return root.querySelector(sel);
}

export function centerInRoot(el: HTMLElement, root: HTMLElement): Point {
  const er = el.getBoundingClientRect();
  const rr = root.getBoundingClientRect();
  return {
    x: er.left - rr.left + er.width / 2,
    y: er.top - rr.top + er.height / 2,
  };
}

export async function animateCursor(
  setCursor: (fn: (c: CursorState) => CursorState) => void,
  target: Point,
  durationMs: number,
): Promise<void> {
  setCursor((c) => ({ ...c, ...target, visible: true, clicking: false }));
  await sleep(durationMs);
}

export interface CursorState {
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
}

export async function clickTarget(
  setCursor: (fn: (c: CursorState) => CursorState) => void,
  el: HTMLElement,
  root: HTMLElement,
  timing: { cursorMoveMs: number; clickMs: number },
): Promise<void> {
  await animateCursor(setCursor, centerInRoot(el, root), timing.cursorMoveMs);
  setCursor((c) => ({ ...c, clicking: true }));
  await sleep(timing.clickMs);
  el.click();
  setCursor((c) => ({ ...c, clicking: false }));
  await sleep(timing.clickMs * 0.5);
}

export async function simulatePointerDrag(
  taskEl: HTMLElement,
  targetEl: HTMLElement,
  steps = 14,
  stepMs = 48,
): Promise<void> {
  const taskRect = taskEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  const startX = taskRect.left + taskRect.width / 2;
  const startY = taskRect.top + taskRect.height / 2;
  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;

  const base = {
    bubbles: true,
    cancelable: true,
    pointerId: 42,
    pointerType: 'mouse' as const,
    isPrimary: true,
    button: 0,
  };

  taskEl.dispatchEvent(
    new PointerEvent('pointerdown', { ...base, clientX: startX, clientY: startY, buttons: 1 }),
  );

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = startX + (endX - startX) * t;
    const y = startY + (endY - startY) * t;
    taskEl.dispatchEvent(
      new PointerEvent('pointermove', { ...base, clientX: x, clientY: y, buttons: 1 }),
    );
    await sleep(stepMs);
  }

  taskEl.dispatchEvent(
    new PointerEvent('pointerup', { ...base, clientX: endX, clientY: endY, buttons: 0 }),
  );
}
