// AICursor — visual overlay that shows a "ghost AI agent" moving the
// kanban around. Drives off the SSE stream from
// /api/v1/hone/tasks/events/stream — every event nudges the on-screen
// pointer or triggers a card-level animation hint.
//
// State machine (derived from the latest event Kind):
//   cursor.move    → pointer animates toward the card's column header
//   card.focus     → pointer parks on the card; CSS-class gives glow
//   card.thinking  → spinner overlay on the card
//   card.comment   → toast-style comment chip flies into the thread
//   card.move      → card "floats" from fromColumn → toColumn (parent owns the actual reorder)
//
// The component is layered: the root div is fixed-positioned and pointer-
// events: none, so it never blocks user clicks. It renders ONLY when an
// active event is in-flight; otherwise the SVG is hidden.
import { useEffect, useState } from 'react';
import type { CursorEvent } from '../api/tasks';
import { zIndex } from '../lib/z-index';

interface Position {
  x: number;
  y: number;
}

// taskAnchorPosition reads the card element's centre point. Returns null
// when the card is not on screen (filtered out / scrolled away).
function taskAnchorPosition(taskId: string): Position | null {
  const el = document.querySelector<HTMLElement>(`[data-task-id="${taskId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

interface AICursorProps {
  events: CursorEvent[]; // last N events from SSE — newest last
}

// AICursor consumes the rolling event log from the parent (TaskBoard) and
// shows a single pointer mid-flight. Replays of historical events are
// skipped — only the most recent event in the last 4s drives a frame.
export function AICursor({ events }: AICursorProps): JSX.Element | null {
  const [pos, setPos] = useState<Position | null>(null);
  const [thinking, setThinking] = useState(false);

  useEffect(() => {
    if (events.length === 0) return;
    const last = events[events.length - 1];
    if (!last) return;
    const ageMs = Date.now() - new Date(last.occurredAt).getTime();
    if (ageMs > 4000) {
      setThinking(false);
      return;
    }
    const taskId = last.taskId;
    const anchor = taskId ? taskAnchorPosition(taskId) : null;
    switch (last.kind) {
      case 'cursor.move':
      case 'card.focus':
      case 'card.move':
        if (anchor) setPos(anchor);
        setThinking(false);
        break;
      case 'card.thinking':
        if (anchor) setPos(anchor);
        setThinking(true);
        break;
      case 'card.comment':
      case 'card.categorise':
        setThinking(false);
        break;
      default: {
        const _exhaustive: never = last.kind;
        throw new Error(`Unhandled cursor event kind: ${String(_exhaustive)}`);
      }
    }
  }, [events]);

  if (!pos) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        transition: 'left var(--motion-dur-large) var(--motion-ease-standard), top var(--motion-dur-large) var(--motion-ease-standard)',
        zIndex: zIndex.tooltip,
      }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <radialGradient id="ai-cursor-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--ink-40)" />
            <stop offset="100%" stopColor="rgb(var(--ink-rgb) / 0)" />
          </radialGradient>
        </defs>
        <circle cx="16" cy="16" r="14" fill="url(#ai-cursor-halo)">
          {thinking && (
            <animate
              attributeName="r"
              values="10;15;10"
              dur="1.4s"
              repeatCount="indefinite"
            />
          )}
        </circle>
        <path
          d="M10 8 L10 22 L14 18 L17 24 L19 23 L16 17 L22 17 Z"
          fill="var(--ink)"
          stroke="var(--ink-40)"
          strokeWidth="0.8"
        />
      </svg>
    </div>
  );
}
