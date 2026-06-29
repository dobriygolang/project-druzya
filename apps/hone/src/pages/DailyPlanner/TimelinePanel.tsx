import { memo, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';

import { scheduleTask, type TaskCard } from '../../api/tasks';
import { isoAtLocalTime, localDayStart } from './lib/dates';

const DAY_START_HOUR = 10;
const DAY_END_HOUR = 23;
const SLOT_HEIGHT = 48;

interface Block {
  task: TaskCard;
  startMs: number;
  durationMin: number;
}

function parseBlock(t: TaskCard, dayStart: Date): Block | null {
  if (!t.scheduledStart || !t.scheduledDurationMin) return null;
  const start = new Date(t.scheduledStart);
  if (start.toDateString() !== dayStart.toDateString()) return null;
  const hour = start.getHours() + start.getMinutes() / 60;
  if (hour < DAY_START_HOUR || hour >= DAY_END_HOUR) return null;
  return {
    task: t,
    startMs: start.getTime() - dayStart.getTime(),
    durationMin: t.scheduledDurationMin,
  };
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

interface TimelinePanelProps {
  day: Date;
  tasks: TaskCard[];
  onTasksChange: (updater: (prev: TaskCard[]) => TaskCard[]) => void;
}

export function TimelinePanel({ day, tasks, onTasksChange }: TimelinePanelProps): JSX.Element {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const dayStart = localDayStart(day);
  const dayLabel = day.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const blocks = useMemo(
    () =>
      tasks
        .map((t) => parseBlock(t, dayStart))
        .filter((b): b is Block => b !== null && b.task.status !== 'done'),
    [tasks, dayStart],
  );

  const handleDrop = useCallback(
    async (taskId: string, hour: number, minute: number) => {
      const existing = tasks.find((t) => t.id === taskId);
      const duration = existing?.scheduledDurationMin ?? 30;
      try {
        const updated = await scheduleTask(taskId, isoAtLocalTime(day, hour, minute), duration);
        onTasksChange((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } catch {
        /* keep UI */
      }
    },
    [day, onTasksChange, tasks],
  );

  const handleUnschedule = useCallback(
    async (taskId: string) => {
      const existing = tasks.find((t) => t.id === taskId);
      const duration = existing?.scheduledDurationMin ?? 30;
      try {
        const updated = await scheduleTask(taskId, isoAtLocalTime(day, 6, 0), duration);
        onTasksChange((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } catch {
        /* keep UI */
      }
    },
    [day, onTasksChange, tasks],
  );

  const isToday = day.toDateString() === new Date().toDateString();
  const nowOffsetPx = isToday
    ? ((now.getHours() - DAY_START_HOUR) + now.getMinutes() / 60) * SLOT_HEIGHT
    : -1;

  const hourSlots = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
  const slotsHeight = (DAY_END_HOUR - DAY_START_HOUR) * SLOT_HEIGHT;

  return (
    <aside className="dp-timeline">
      <header className="dp-timeline-head">{dayLabel}</header>
      <div className="dp-timeline-body">
        <div className="dp-timeline-slots" style={{ minHeight: slotsHeight }}>
          {hourSlots.map((hour, i) => (
            <HourSlot
              key={hour}
              hour={hour}
              topPx={i * SLOT_HEIGHT}
              onDrop={handleDrop}
              onDragEnd={() => setDraggingId(null)}
            />
          ))}

          {nowOffsetPx >= 0 && nowOffsetPx <= slotsHeight && (
            <div className="schedule-now-line dp-now-line" style={{ top: nowOffsetPx }}>
              <span className="schedule-now-dot" aria-hidden />
            </div>
          )}

          {blocks.map((b) => (
            <TimelineBlock
              key={b.task.id}
              block={b}
              dragging={draggingId === b.task.id}
              onDragStart={() => setDraggingId(b.task.id)}
              onDragEnd={() => setDraggingId(null)}
              onUnschedule={() => void handleUnschedule(b.task.id)}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

interface HourSlotProps {
  hour: number;
  topPx: number;
  onDrop: (taskId: string, hour: number, minute: number) => void | Promise<void>;
  onDragEnd: () => void;
}

const HourSlot = memo(function HourSlot({ hour, topPx, onDrop, onDragEnd }: HourSlotProps) {
  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('text/x-hone-task')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDropHandler = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/x-hone-task');
      if (!taskId) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const minute = e.clientY - rect.top > SLOT_HEIGHT / 2 ? 30 : 0;
      void onDrop(taskId, hour, minute);
      onDragEnd();
    },
    [hour, onDrop, onDragEnd],
  );

  return (
    <div
      className="dp-hour-slot"
      style={{ top: topPx }}
      onDragOver={onDragOver}
      onDrop={onDropHandler}
    >
      <span className="dp-hour-label">{formatHourLabel(hour)}</span>
    </div>
  );
});

interface TimelineBlockProps {
  block: Block;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onUnschedule: () => void;
}

const TimelineBlock = memo(function TimelineBlock({
  block,
  dragging,
  onDragStart,
  onDragEnd,
  onUnschedule,
}: TimelineBlockProps) {
  const { task, startMs, durationMin } = block;
  const startMin = startMs / 60_000;
  const offsetMin = startMin - DAY_START_HOUR * 60;
  const topPx = (offsetMin / 60) * SLOT_HEIGHT;
  const heightPx = (durationMin / 60) * SLOT_HEIGHT;

  const style: CSSProperties = {
    top: topPx,
    height: Math.max(heightPx - 2, 28),
    opacity: dragging ? 0.5 : 1,
  };

  return (
    <div
      draggable
      className="dp-timeline-block"
      style={style}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/x-hone-task', task.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      <span className="dp-timeline-block-title">{task.title}</span>
      <button type="button" className="dp-timeline-block-clear" onClick={onUnschedule} aria-label="Remove from timeline">
        ×
      </button>
    </div>
  );
});
