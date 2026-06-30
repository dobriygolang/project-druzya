import { useState } from 'react';

import type { TaskCard } from '@features/tasks/api/tasks';
import { defaultDurationMin } from './lib/dates';
import { DurationPicker } from './DurationPicker';

const COL_W = 254;

interface TaskRowProps {
  task: TaskCard;
  dragging: boolean;
  onToggleDone: (task: TaskCard) => void;
  onDurationChange: (task: TaskCard, minutes: number) => void;
  onPointerDragStart: (taskId: string, e: React.PointerEvent) => void;
}

export function TaskRow({
  task,
  dragging,
  onToggleDone,
  onDurationChange,
  onPointerDragStart,
}: TaskRowProps): JSX.Element {
  const [hover, setHover] = useState(false);
  const done = task.status === 'done';

  return (
    <article
      onPointerDown={(e) => {
        if (done) return;
        const target = e.target as HTMLElement;
        if (target.closest('button, [data-no-drag]')) return;
        onPointerDragStart(task.id, e);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={(e) => e.stopPropagation()}
      style={{
        boxSizing: 'border-box',
        width: COL_W,
        padding: '10px 12px',
        borderRadius: 12,
        background: done ? 'transparent' : hover ? 'rgb(var(--ink-rgb) / 0.08)' : 'rgb(var(--ink-rgb) / 0.05)',
        border: '1px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: done ? 0.45 : dragging ? 0.4 : 1,
        cursor: done ? 'default' : dragging ? 'grabbing' : 'grab',
        transform: dragging ? 'scale(0.98)' : 'none',
        touchAction: 'none',
        transition:
          'background-color var(--motion-dur-small) var(--motion-ease-standard), opacity var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)',
      }}
    >
      <button
        type="button"
        data-no-drag
        aria-label={done ? 'Mark incomplete' : 'Mark done'}
        onClick={() => onToggleDone(task)}
        style={{
          width: 16,
          height: 16,
          borderRadius: 99,
          border: 'none',
          background: done ? '#4CB35C' : 'transparent',
          boxShadow: done ? 'none' : 'inset 0 0 0 1.5px var(--ink-50)',
          flexShrink: 0,
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          color: done ? '#0a0a0a' : 'transparent',
          fontSize: 10,
          lineHeight: 1,
          padding: 0,
        }}
      >
        {done ? '✓' : ''}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            lineHeight: '16px',
            color: done ? 'var(--ink-50)' : 'var(--ink-90)',
            textDecoration: done ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title || 'Untitled'}
        </div>
      </div>

      <div data-no-drag>
        <DurationPicker
          valueMin={defaultDurationMin(task)}
          disabled={done}
          onChange={(min) => onDurationChange(task, min)}
        />
      </div>
    </article>
  );
}
