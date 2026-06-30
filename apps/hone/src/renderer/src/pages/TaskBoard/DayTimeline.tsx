import { useMemo } from 'react';

import type { TaskCard } from '@features/tasks/api/tasks';
import { defaultDurationMin, formatTimelineHeader, toDayKey } from './lib/dates';

const HOUR_START = 8;
const HOUR_END = 23;
const HOUR_PX = 52;

interface DayTimelineProps {
  date: Date;
  tasks: TaskCard[];
}

function hourLabel(h: number): string {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

export function DayTimeline({ date, tasks }: DayTimelineProps) {
  const dayKey = toDayKey(date);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow = toDayKey(now) === dayKey;

  const scheduled = useMemo(
    () =>
      tasks.filter((t) => {
        if (!t.scheduledStart) return false;
        const d = new Date(t.scheduledStart);
        return !Number.isNaN(d.getTime()) && toDayKey(d) === dayKey;
      }),
    [tasks, dayKey],
  );

  const gridHeight = (HOUR_END - HOUR_START + 1) * HOUR_PX;

  return (
    <aside
      style={{
        flex: '0 0 280px',
        borderLeft: '1px solid var(--ink-tint-06)',
        padding: '0 0 0 16px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <header style={{ padding: '0 8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--ink-80)' }}>
        {formatTimelineHeader(date)}
      </header>

      <div style={{ position: 'relative', flex: 1, overflowY: 'auto', paddingRight: 8 }}>
        <div style={{ position: 'relative', height: gridHeight, marginLeft: 44 }}>
          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i).map((h) => (
            <div
              key={h}
              style={{
                position: 'absolute',
                top: (h - HOUR_START) * HOUR_PX,
                left: 0,
                right: 0,
                height: HOUR_PX,
                borderTop: '1px solid var(--ink-tint-06)',
              }}
            >
              <span
                className="mono"
                style={{
                  position: 'absolute',
                  left: -44,
                  top: -7,
                  width: 40,
                  textAlign: 'right',
                  fontSize: 10,
                  color: 'var(--ink-40)',
                }}
              >
                {hourLabel(h)}
              </span>
            </div>
          ))}

          {showNow && now.getHours() >= HOUR_START && now.getHours() <= HOUR_END && (
            <div
              style={{
                position: 'absolute',
                top: ((now.getHours() - HOUR_START) * HOUR_PX) + (now.getMinutes() / 60) * HOUR_PX,
                left: -6,
                right: 0,
                height: 2,
                background: '#e85d4c',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: -4,
                  top: -4,
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#e85d4c',
                }}
              />
            </div>
          )}

          {scheduled.map((task) => {
            const start = new Date(task.scheduledStart!);
            const startMin = start.getHours() * 60 + start.getMinutes();
            const top = ((startMin / 60) - HOUR_START) * HOUR_PX;
            const height = Math.max(28, (defaultDurationMin(task) / 60) * HOUR_PX);
            return (
              <div
                key={task.id}
                title={task.title}
                style={{
                  position: 'absolute',
                  top,
                  left: 4,
                  right: 4,
                  height,
                  borderRadius: 8,
                  padding: '6px 8px',
                  background: 'rgb(180 120 60 / 0.35)',
                  border: '1px solid rgb(180 120 60 / 0.5)',
                  fontSize: 11,
                  color: 'var(--ink-90)',
                  overflow: 'hidden',
                  zIndex: 1,
                }}
              >
                {task.title}
              </div>
            );
          })}
        </div>

        {scheduled.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--ink-40)', padding: '8px 8px 24px' }}>
            No scheduled blocks — drag scheduling comes next.
          </p>
        )}
      </div>
    </aside>
  );
}
