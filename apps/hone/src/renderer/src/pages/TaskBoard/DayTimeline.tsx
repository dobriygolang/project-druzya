import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useLocale, useT } from '@d9-i18n';

import { tasksPlannedForDay } from '@features/calendar/lib/events';
import type { TaskCard } from '@features/tasks/api/tasks';
import { useVerticalDrag } from '@shared/lib/useVerticalDrag';
import {
  defaultDurationMin,
  formatTimelineHeader,
  formatTimeShort,
  snapMinutes,
  startOfLocalDay,
  toDayKey,
} from './lib/dates';

const HOUR_START = 6;
const HOUR_END = 23;
const HOUR_COUNT = HOUR_END - HOUR_START + 1;
const HOUR_PX_DEFAULT = 52;
const HOUR_PX_MIN = 22;
const GRID_PAD_TOP = 12;
const GRID_PAD_BOTTOM = 24;

interface DayTimelineProps {
  date: Date;
  tasks: TaskCard[];
  onReschedule?: (task: TaskCard, start: Date) => void;
}

function hourLabel(h: number, locale: 'en' | 'ru'): string {
  return formatTimeShort(new Date(2000, 0, 1, h, 0), locale);
}

export function DayTimeline({ date, tasks, onReschedule }: DayTimelineProps) {
  const t = useT();
  const [locale] = useLocale();
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayKey = toDayKey(date);
  const now = new Date();
  const showNow = toDayKey(now) === dayKey;
  const { dragId, dragTop, start: startDrag } = useVerticalDrag();

  const planned = useMemo(() => tasksPlannedForDay(dayKey, tasks), [dayKey, tasks]);

  // Fit all hours into the available height; fall back to scrolling only when
  // the panel gets too short to keep rows legible.
  const [hourPx, setHourPx] = useState(HOUR_PX_DEFAULT);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const recompute = () => {
      const usable = el.clientHeight - GRID_PAD_TOP - GRID_PAD_BOTTOM;
      if (usable <= 0) return;
      setHourPx(Math.max(HOUR_PX_MIN, Math.floor(usable / HOUR_COUNT)));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hoursHeight = HOUR_COUNT * hourPx;
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
          {Array.from({ length: HOUR_COUNT }, (_, i) => HOUR_START + i).map((h) => (
            <div
              key={h}
              style={{
                position: 'absolute',
                top: GRID_PAD_TOP + (h - HOUR_START) * hourPx,
                left: 0,
                right: 0,
                height: hourPx,
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
                  (now.getHours() - HOUR_START) * hourPx +
                  (now.getMinutes() / 60) * hourPx,
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
            const baseTop = GRID_PAD_TOP + (startMin / 60 - HOUR_START) * hourPx;
            const height = Math.max(28, (defaultDurationMin(task) / 60) * hourPx);
            const minTop = GRID_PAD_TOP;
            const maxTop = GRID_PAD_TOP + HOUR_COUNT * hourPx - height;
            const isDragging = dragId === task.id;
            const top = Math.max(minTop, Math.min(isDragging ? dragTop : baseTop, maxTop));
            const done = task.status === 'done';
            const canDrag = Boolean(onReschedule);

            const commit = (finalTop: number) => {
              const min = snapMinutes(((finalTop - GRID_PAD_TOP) / hourPx + HOUR_START) * 60);
              const next = startOfLocalDay(date);
              next.setHours(Math.floor(min / 60), min % 60, 0, 0);
              onReschedule?.(task, next);
            };

            return (
              <div
                key={task.id}
                title={task.title}
                onPointerDown={
                  canDrag
                    ? (e) =>
                        startDrag(e, {
                          id: task.id,
                          baseTop,
                          min: minTop,
                          max: maxTop,
                          onCommit: commit,
                        })
                    : undefined
                }
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
                  zIndex: isDragging ? 3 : 1,
                  textDecoration: done ? 'line-through' : 'none',
                  cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'default',
                  touchAction: 'none',
                  boxShadow: isDragging ? '0 8px 24px rgb(0 0 0 / 0.45)' : 'none',
                  userSelect: 'none',
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
