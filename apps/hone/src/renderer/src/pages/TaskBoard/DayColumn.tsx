import { useCallback, useEffect, useRef, useState } from 'react';

import type { TaskCard } from '@features/tasks/api/tasks';
import { formatColumnHeader, formatDuration, sumDurationMin } from './lib/dates';
import { TaskRow } from './TaskRow';

const COL_W = 254;

interface DayColumnProps {
  dayKey: string;
  date: Date;
  today: Date;
  tasks: TaskCard[];
  selected: boolean;
  dropHighlight: boolean;
  onSelect: () => void;
  onAddClick: () => void;
  onToggleDone: (task: TaskCard) => void;
  onDurationChange: (task: TaskCard, minutes: number) => void;
  onPointerDragStart: (taskId: string) => void;
  onPointerDragMove: (dayKey: string) => void;
  onPointerDrop: (taskId: string, dayKey: string) => void;
  onPointerDragEnd: () => void;
}

export function DayColumn({
  dayKey,
  date,
  today,
  tasks,
  selected,
  dropHighlight,
  onSelect,
  onAddClick,
  onToggleDone,
  onDurationChange,
  onPointerDragStart,
}: DayColumnProps): JSX.Element {
  const { weekday, label, isToday } = formatColumnHeader(date, today);
  const total = formatDuration(sumDurationMin(tasks.filter((t) => t.status !== 'done')));

  return (
    <section
      data-day-key={dayKey}
      onClick={onSelect}
      style={{
        flex: `0 0 ${COL_W}px`,
        width: COL_W,
        height: '100%',
        minHeight: '100%',
        scrollSnapAlign: 'start',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: dropHighlight ? 8 : 0,
        margin: dropHighlight ? -8 : 0,
        borderRadius: 14,
        background: dropHighlight ? 'rgb(var(--ink-rgb) / 0.07)' : 'transparent',
        boxShadow: dropHighlight ? 'inset 0 0 0 1px rgb(var(--ink-rgb) / 0.22)' : 'none',
        opacity: selected ? 1 : dropHighlight ? 0.95 : 0.72,
        transition:
          'opacity var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard), box-shadow var(--motion-dur-small) var(--motion-ease-standard)',
      }}
    >
      <header style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '0 2px' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: dropHighlight ? 'var(--ink)' : 'var(--ink-90)' }}>
              {weekday}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-40)', marginTop: 2 }}>
              {label}
              {isToday ? ' · today' : ''}
            </div>
          </div>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-40)' }}>
            {total}
          </span>
        </div>
      </header>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAddClick();
        }}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          height: 38,
          flexShrink: 0,
          padding: '10px',
          borderRadius: 12,
          border: '1px solid var(--ink-tint-08)',
          background: 'rgb(var(--ink-rgb) / 0.03)',
          color: 'var(--ink-50)',
          fontSize: 13,
          lineHeight: '16px',
          textAlign: 'left',
          cursor: 'pointer',
          transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.06)';
          e.currentTarget.style.borderColor = 'var(--ink-tint-12)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.03)';
          e.currentTarget.style.borderColor = 'var(--ink-tint-08)';
        }}
      >
        Add task
      </button>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          flex: 1,
          minHeight: 0,
        }}
      >
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            dragging={draggingId === task.id}
            onToggleDone={onToggleDone}
            onDurationChange={onDurationChange}
            onPointerDragStart={onPointerDragStart}
          />
        ))}
      </div>
    </section>
  );
}

/** Pointer-based day drag — works in Tauri/WKWebView where HTML5 drop data is often empty. */
export function useDayTaskDrag(onMoveToDay: (taskId: string, dayKey: string) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const dragRef = useRef<{ taskId: string; pointerId: number } | null>(null);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDraggingId(null);
    setDropDay(null);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  const onPointerDragStart = useCallback((taskId: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { taskId, pointerId: e.pointerId };
    setDraggingId(taskId);
    setDropDay(null);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  useEffect(() => {
    if (!draggingId) return;

    const dayKeyFromPoint = (x: number, y: number): string | null => {
      const el = document.elementFromPoint(x, y);
      return el?.closest('[data-day-key]')?.getAttribute('data-day-key') ?? null;
    };

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
      const dayKey = dayKeyFromPoint(e.clientX, e.clientY);
      if (dayKey) setDropDay(dayKey);
    };

    const onUp = (e: PointerEvent) => {
      if (!dragRef.current || e.pointerId !== dragRef.current.pointerId) return;
      const dayKey = dayKeyFromPoint(e.clientX, e.clientY);
      if (dayKey) onMoveToDay(dragRef.current.taskId, dayKey);
      endDrag();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingId, onMoveToDay, endDrag]);

  return { draggingId, dropDay, onPointerDragStart };
}
