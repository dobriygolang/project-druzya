import { useT, useLocale } from '@d9-i18n';

import type { TaskCard } from '@features/tasks/api/tasks';
import { formatColumnHeader, formatDuration, sumDurationMin } from './lib/dates';
import { TaskRow } from './TaskRow';

const COL_W = 254;

interface DayColumnProps {
  dayKey: string;
  date: Date;
  today: Date;
  tasks: TaskCard[];
  draggingId: string | null;
  dropHighlight: boolean;
  dropTaskId: string | null;
  selected: boolean;
  onSelect: () => void;
  onAddClick: () => void;
  onToggleDone: (task: TaskCard) => void;
  onDelete: (task: TaskCard) => void;
  onDurationChange: (task: TaskCard, minutes: number) => void;
  onTimeChange: (task: TaskCard, start: Date) => void;
  onPointerDragStart: (taskId: string, e: React.PointerEvent) => void;
}

export function DayColumn({
  dayKey,
  date,
  today,
  tasks,
  draggingId,
  dropHighlight,
  dropTaskId,
  selected,
  onSelect,
  onAddClick,
  onToggleDone,
  onDelete,
  onDurationChange,
  onTimeChange,
  onPointerDragStart,
}: DayColumnProps): JSX.Element {
  const t = useT();
  const [locale] = useLocale();
  const { weekday, label, isToday } = formatColumnHeader(date, today, locale);
  const total = formatDuration(sumDurationMin(tasks.filter((t) => t.status !== 'done')));

  return (
    <section
      className="hone-day-column"
      data-day-key={dayKey}
      onClick={onSelect}
      style={{
        flex: `0 0 ${COL_W}px`,
        width: COL_W,
        height: '100%',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        borderRadius: 14,
        background: dropHighlight ? 'rgb(var(--ink-rgb) / 0.06)' : 'transparent',
        boxShadow: dropHighlight ? 'inset 0 0 0 1px rgb(var(--ink-rgb) / 0.2)' : 'none',
      }}
    >
      <header style={{ flexShrink: 0, pointerEvents: draggingId ? 'none' : 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '0 10px' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: selected ? 'var(--ink)' : 'var(--ink-90)' }}>
              {weekday}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-40)', marginTop: 2 }}>
              {label}
              {isToday ? ` · ${t('hone.taskboard.today')}` : ''}
            </div>
          </div>
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-40)' }}>
            {total}
          </span>
        </div>
      </header>

      <button
        type="button"
        className="hone-day-add-btn"
        onClick={(e) => {
          e.stopPropagation();
          onAddClick();
        }}
        style={{ pointerEvents: draggingId ? 'none' : 'auto' }}
      >
        {t('hone.taskboard.add_task')}
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
            columnDate={date}
            dragging={draggingId === task.id}
            dropTarget={dropTaskId === task.id && draggingId !== null}
            onToggleDone={onToggleDone}
            onDelete={onDelete}
            onDurationChange={onDurationChange}
            onTimeChange={onTimeChange}
            onPointerDragStart={onPointerDragStart}
          />
        ))}
      </div>
    </section>
  );
}
