import { useT } from '@d9-i18n';

import type { TaskCard } from '@features/tasks/api/tasks';
import { defaultDurationMin, taskScheduleStart } from './lib/dates';
import { DurationPicker } from './DurationPicker';
import { TimePicker } from './TimePicker';

const COL_W = 254;

interface TaskRowProps {
  task: TaskCard;
  columnDate: Date;
  dragging: boolean;
  dropTarget: boolean;
  onToggleDone: (task: TaskCard) => void;
  onDelete: (task: TaskCard) => void;
  onDurationChange: (task: TaskCard, minutes: number) => void;
  onTimeChange: (task: TaskCard, start: Date) => void;
  onPointerDragStart: (taskId: string, e: React.PointerEvent) => void;
}

export function TaskRow({
  task,
  columnDate,
  dragging,
  dropTarget,
  onToggleDone,
  onDelete,
  onDurationChange,
  onTimeChange,
  onPointerDragStart,
}: TaskRowProps): JSX.Element {
  const t = useT();
  const done = task.status === 'done';
  const scheduled = taskScheduleStart(task);

  return (
    <article
      data-task-row
      data-task-id={task.id}
      data-done={done ? 'true' : 'false'}
      className="hone-task-row"
      onPointerDown={(e) => {
        if (done) return;
        const target = e.target as HTMLElement;
        if (target.closest('button, [data-no-drag]')) return;
        onPointerDragStart(task.id, e);
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        boxSizing: 'border-box',
        width: COL_W,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'rgb(var(--ink-rgb) / 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: done ? 0.45 : dragging ? 0.4 : 1,
        cursor: done ? 'default' : dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        outline: dropTarget ? '2px solid rgb(var(--ink-rgb) / 0.55)' : 'none',
        outlineOffset: dropTarget ? 1 : 0,
      }}
    >
      <button
        type="button"
        data-no-drag
        aria-label={done ? t('hone.taskboard.mark_incomplete') : t('hone.taskboard.mark_done')}
        onClick={() => onToggleDone(task)}
        style={{
          width: 16,
          height: 16,
          borderRadius: 99,
          border: done ? 'none' : '1.5px solid var(--ink-60)',
          background: done ? '#4CB35C' : 'rgb(var(--ink-rgb) / 0.04)',
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
            color: done ? 'var(--ink-40)' : 'var(--ink-90)',
            textDecoration: done ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title || t('hone.taskboard.untitled')}
        </div>
      </div>

      <div data-no-drag style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <button
          type="button"
          aria-label={t('hone.taskboard.delete_task')}
          onClick={() => onDelete(task)}
          style={{
            width: 20,
            height: 20,
            borderRadius: 6,
            border: 'none',
            background: 'transparent',
            color: 'var(--ink-40)',
            cursor: 'pointer',
            fontSize: 14,
            lineHeight: 1,
            padding: 0,
            flexShrink: 0,
          }}
        >
          ×
        </button>
        <TimePicker
          value={scheduled}
          day={columnDate}
          disabled={done}
          onChange={(start) => onTimeChange(task, start)}
        />
        <DurationPicker
          valueMin={defaultDurationMin(task)}
          disabled={done}
          onChange={(min) => onDurationChange(task, min)}
        />
      </div>
    </article>
  );
}
