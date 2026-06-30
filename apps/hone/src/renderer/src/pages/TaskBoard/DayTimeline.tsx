import { useEffect, useMemo, useRef } from 'react';

import { useLocale, useT } from '@d9-i18n';

import { tasksPlannedForDay } from '@features/calendar/lib/events';
import type { TaskCard } from '@features/tasks/api/tasks';
import { defaultDurationMin, formatTimelineHeader, formatTimeShort, toDayKey } from './lib/dates';

const HOUR_START = 6;
const HOUR_END = 23;
const HOUR_PX = 52;
const GRID_PAD_TOP = 12;
const GRID_PAD_BOTTOM = 24;

interface DayTimelineProps {
  date: Date;
  tasks: TaskCard[];
}

function hourLabel(h: number, locale: 'en' | 'ru'): string {
  return formatTimeShort(new Date(2000, 0, 1, h, 0), locale);
}

export function DayTimeline({ date, tasks }: DayTimelineProps) {
  const t = useT();
  const [locale] = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayKey = toDayKey(date);
  const now = new Date();
  const showNow = toDayKey(now) === dayKey;

  const planned = useMemo(() => tasksPlannedForDay(dayKey, tasks), [dayKey, tasks]);

  const hoursHeight = (HOUR_END - HOUR_START + 1) * HOUR_PX;
  const gridHeight = hoursHeight + GRID_PAD_TOP + GRID_PAD_BOTTOM;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = 0;
  }, [dayKey]);

  return (
    <aside
      style={{
        flex: '0 0 280px',
        borderLeft: '1px solid var(--ink-tint-06)',
        padding: '0 0 0 16px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <header style={{ padding: '0 8px 12px', fontSize: 13, fontWeight: 600, color: 'var(--ink-80)' }}>
        {formatTimelineHeader(date, locale)}
      </header>

      <div
        ref={scrollRef}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 8,
          overscrollBehavior: 'contain',
        }}
      >
        <div
          style={{
            position: 'relative',
            height: gridHeight,
            marginLeft: 44,
          }}
        >
          {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i).map((h) => (
            <div
              key={h}
              style={{
                position: 'absolute',
                top: GRID_PAD_TOP + (h - HOUR_START) * HOUR_PX,
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
                {hourLabel(h, locale)}
              </span>
            </div>
          ))}

          {showNow && now.getHours() >= HOUR_START && now.getHours() <= HOUR_END && (
            <div
              style={{
                position: 'absolute',
                top:
                  GRID_PAD_TOP +
                  (now.getHours() - HOUR_START) * HOUR_PX +
                  (now.getMinutes() / 60) * HOUR_PX,
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

          {planned.map(({ task, start }) => {
            const startMin = start.getHours() * 60 + start.getMinutes();
            let top = GRID_PAD_TOP + (startMin / 60 - HOUR_START) * HOUR_PX;
            const height = Math.max(28, (defaultDurationMin(task) / 60) * HOUR_PX);
            const maxTop = GRID_PAD_TOP + (HOUR_END - HOUR_START + 1) * HOUR_PX - height;
            top = Math.max(GRID_PAD_TOP, Math.min(top, maxTop));
            const done = task.status === 'done';
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
                  background: done
                    ? 'rgb(var(--ink-rgb) / 0.08)'
                    : 'rgb(180 120 60 / 0.35)',
                  border: done
                    ? '1px solid var(--ink-tint-08)'
                    : '1px solid rgb(180 120 60 / 0.5)',
                  fontSize: 11,
                  color: done ? 'var(--ink-40)' : 'var(--ink-90)',
                  overflow: 'hidden',
                  zIndex: 1,
                  textDecoration: done ? 'line-through' : 'none',
                }}
              >
                {task.title}
              </div>
            );
          })}
        </div>

        {planned.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--ink-40)', padding: '8px 8px 24px' }}>
            {t('hone.taskboard.timeline_empty')}
          </p>
        )}
      </div>
    </aside>
  );
}
