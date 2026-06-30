import { useState, type FormEvent } from 'react';

import type { TaskCard } from '@features/tasks/api/tasks';
import { defaultDurationMin, formatColumnHeader, formatDuration, sumDurationMin } from './lib/dates';

const COL_W = 254;
const TASKS_MIN_H = 181;

interface DayColumnProps {
  date: Date;
  today: Date;
  tasks: TaskCard[];
  selected: boolean;
  onSelect: () => void;
  onCreate: (title: string) => void;
  onToggleDone: (task: TaskCard) => void;
  onDelete: (taskId: string) => void;
}

export function DayColumn({ date, today, tasks, selected, onSelect, onCreate, onToggleDone, onDelete }: DayColumnProps) {
  const [draft, setDraft] = useState('');
  const { weekday, label, isToday } = formatColumnHeader(date, today);
  const total = formatDuration(sumDurationMin(tasks));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    onCreate(title);
    setDraft('');
  };

  return (
    <section
      onClick={onSelect}
      style={{
        flex: `0 0 ${COL_W}px`,
        width: COL_W,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        opacity: selected ? 1 : 0.72,
        transition: 'opacity var(--motion-dur-small) var(--motion-ease-standard)',
      }}
    >
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '0 2px' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-90)' }}>{weekday}</div>
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

      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add task"
          style={{
            boxSizing: 'border-box',
            width: COL_W,
            height: 38,
            padding: '10px',
            borderRadius: 12,
            border: '1px solid var(--ink-tint-08)',
            background: 'rgb(var(--ink-rgb) / 0.03)',
            color: 'var(--ink-80)',
            fontSize: 13,
            lineHeight: '16px',
            outline: 'none',
          }}
        />
      </form>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minHeight: TASKS_MIN_H,
        }}
      >
        {tasks.map((task) => {
          const done = task.status === 'done';
          return (
            <article
              key={task.id}
              onClick={(e) => e.stopPropagation()}
              style={{
                boxSizing: 'border-box',
                width: COL_W,
                padding: '10px 12px',
                borderRadius: 12,
                background: done ? 'transparent' : 'rgb(var(--ink-rgb) / 0.06)',
                border: '1px solid var(--ink-tint-06)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <button
                type="button"
                aria-label={done ? 'Mark incomplete' : 'Mark done'}
                onClick={() => onToggleDone(task)}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  border: `1px solid ${done ? 'var(--ink-40)' : 'var(--ink-60)'}`,
                  background: done ? 'var(--ink-40)' : 'transparent',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              />
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
                  {task.title || 'Untitled'}
                </div>
              </div>
              <span className="mono" style={{ fontSize: 10, color: 'var(--ink-40)', flexShrink: 0 }}>
                {formatDuration(defaultDurationMin(task))}
              </span>
              <button
                type="button"
                aria-label="Delete task"
                onClick={() => onDelete(task.id)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--ink-40)',
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
