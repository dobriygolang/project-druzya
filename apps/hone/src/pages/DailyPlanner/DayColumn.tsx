import { memo, useCallback, useState, type FormEvent, type MouseEvent } from 'react';

import type { TaskCard } from '../../api/tasks';
import { columnTotalMin, formatColumnHeader, formatDuration } from './lib/dates';
import { DurationMenu } from './DurationMenu';

interface DayColumnProps {
  day: Date;
  tasks: TaskCard[];
  selected: boolean;
  onSelect: () => void;
  onAdd: (title: string) => void | Promise<void>;
  onToggleDone: (taskId: string, done: boolean) => void;
  onDuration: (taskId: string, min: number) => void;
}

export const DayColumn = memo(function DayColumn({
  day,
  tasks,
  selected,
  onSelect,
  onAdd,
  onToggleDone,
  onDuration,
}: DayColumnProps): JSX.Element {
  const [draft, setDraft] = useState('');
  const [durationMenu, setDurationMenu] = useState<{ taskId: string; x: number; y: number; value: number } | null>(null);

  const { weekday, date } = formatColumnHeader(day);
  const total = formatDuration(columnTotalMin(tasks));

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      const title = draft.trim();
      if (!title) return;
      setDraft('');
      await onAdd(title);
    },
    [draft, onAdd],
  );

  const openDuration = useCallback((e: MouseEvent<HTMLButtonElement>, task: TaskCard) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setDurationMenu({
      taskId: task.id,
      x: rect.left,
      y: rect.bottom + 4,
      value: task.scheduledDurationMin ?? 30,
    });
  }, []);

  return (
    <section
      className={selected ? 'dp-column dp-column--selected' : 'dp-column'}
      onClick={onSelect}
      aria-label={`${weekday} ${date}`}
    >
      <header className="dp-column-head">
        <div className="dp-column-title">
          <span className="dp-column-weekday">{weekday}</span>
          <span className="dp-column-date">{date}</span>
        </div>
        <span className="dp-column-total">{total}</span>
      </header>

      <form className="dp-add-form" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <input
          className="dp-add-input"
          placeholder="Add task"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </form>

      <ul className="dp-task-list">
        {tasks.map((task) => {
          const done = task.status === 'done';
          const dur = task.scheduledDurationMin ?? 30;
          return (
            <li
              key={task.id}
              className={done ? 'dp-task dp-task--done' : 'dp-task'}
              draggable={!done}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/x-hone-task', task.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
            >
              <button
                type="button"
                className={done ? 'dp-check dp-check--done' : 'dp-check'}
                aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDone(task.id, !done);
                }}
              />
              <span className="dp-task-title">{task.title}</span>
              <button
                type="button"
                className="dp-task-dur"
                onClick={(e) => openDuration(e, task)}
              >
                {formatDuration(dur)}
              </button>
            </li>
          );
        })}
      </ul>

      {durationMenu && (
        <DurationMenu
          x={durationMenu.x}
          y={durationMenu.y}
          value={durationMenu.value}
          onPick={(min) => onDuration(durationMenu.taskId, min)}
          onClose={() => setDurationMenu(null)}
        />
      )}
    </section>
  );
});
