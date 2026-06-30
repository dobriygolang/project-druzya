import type { CursorState } from './domUtils';

export function DemoCursor({ cursor }: { cursor: CursorState }) {
  if (!cursor.visible) return null;

  return (
    <div
      className={`hone-demo-cursor${cursor.clicking ? ' hone-demo-cursor--click' : ''}`}
      style={{ left: cursor.x, top: cursor.y }}
      aria-hidden
    />
  );
}
