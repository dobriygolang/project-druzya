// Schedule — time-blocking day view (backlog + timeline).
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import {
  listTasks,
  scheduleTask,
  unscheduleTask,
  type TaskCard,
} from '../../api/tasks';

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 23;
const SLOT_HEIGHT = 60;

interface Block {
  task: TaskCard;
  startMs: number;
  durationMin: number;
}

function localDayStart(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function isoFromSlot(date: Date, hour: number, minute = 0): string {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function parseBlock(t: TaskCard, dayStart: Date): Block | null {
  if (!t.scheduledStart || !t.scheduledDurationMin) return null;
  const start = new Date(t.scheduledStart);
  if (start.toDateString() !== dayStart.toDateString()) return null;
  return {
    task: t,
    startMs: start.getTime() - dayStart.getTime(),
    durationMin: t.scheduledDurationMin,
  };
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

interface BacklogItemProps {
  task: TaskCard;
  isDragging: boolean;
  onDragStartId: (id: string) => void;
  onDragEnd: () => void;
}

const BacklogItem = memo(function BacklogItem({
  task,
  isDragging,
  onDragStartId,
  onDragEnd,
}: BacklogItemProps) {
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/x-hone-task', task.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStartId(task.id);
  }, [task.id, onDragStartId]);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={isDragging ? 'schedule-backlog-item dragging' : 'schedule-backlog-item'}
    >
      <div className="schedule-backlog-title">{task.title}</div>
      <div className="schedule-backlog-kind">{task.kind}</div>
    </div>
  );
});

interface HourSlotProps {
  hour: number;
  topPx: number;
  onDrop: (taskId: string, hour: number, minute: number) => void | Promise<void>;
  onAfterDrop: () => void;
}

const HourSlot = memo(function HourSlot({
  hour, topPx, onDrop, onAfterDrop,
}: HourSlotProps) {
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('text/x-hone-task')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/x-hone-task');
    if (!taskId) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const minute = e.clientY - rect.top > SLOT_HEIGHT / 2 ? 30 : 0;
    void onDrop(taskId, hour, minute);
    onAfterDrop();
  }, [hour, onDrop, onAfterDrop]);

  return (
    <div
      data-hour={hour}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="schedule-hour-slot"
      style={{ top: topPx }}
    >
      <span className="schedule-hour-label">{pad(hour)}:00</span>
    </div>
  );
});

interface ScheduledBlockProps {
  block: Block;
  resizing: boolean;
  onDragStartId: (id: string) => void;
  onDragEnd: () => void;
  onUnschedule: (id: string) => void | Promise<void>;
  onResizeStart: (id: string) => void;
  onResizeEnd: () => void;
  onResizeCommit: (block: Block, newMin: number) => void | Promise<void>;
}

const ScheduledBlock = memo(function ScheduledBlock({
  block,
  resizing,
  onDragStartId,
  onDragEnd,
  onUnschedule,
  onResizeStart,
  onResizeEnd,
  onResizeCommit,
}: ScheduledBlockProps) {
  const { task, startMs, durationMin } = block;
  const startMin = startMs / 60_000;
  const offsetMin = startMin - DAY_START_HOUR * 60;
  const topPx = (offsetMin / 60) * SLOT_HEIGHT;
  const heightPx = (durationMin / 60) * SLOT_HEIGHT;

  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/x-hone-task', task.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStartId(task.id);
  }, [task.id, onDragStartId]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const blockEl = (e.currentTarget as HTMLElement).parentElement;
    onResizeStart(task.id);
    const startY = e.clientY;
    const startDuration = durationMin;
    const onMove = (ev: MouseEvent): void => {
      const dy = ev.clientY - startY;
      const deltaMin = (dy / SLOT_HEIGHT) * 60;
      const next = startDuration + deltaMin;
      if (blockEl) {
        blockEl.style.height = `${Math.max(24, (next / 60) * SLOT_HEIGHT - 2)}px`;
        blockEl.dataset.tempDuration = String(next);
      }
    };
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const newMin = blockEl?.dataset.tempDuration
        ? Number(blockEl.dataset.tempDuration)
        : durationMin;
      void onResizeCommit(block, newMin);
      onResizeEnd();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [block, task.id, durationMin, onResizeStart, onResizeEnd, onResizeCommit]);

  const blockStyle: CSSProperties = {
    top: topPx,
    height: Math.max(heightPx - 2, 24),
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className="schedule-block"
      style={blockStyle}
    >
      <div className="schedule-block-head">
        <span className="schedule-block-title">{task.title}</span>
        <button
          type="button"
          onClick={() => void onUnschedule(task.id)}
          className="schedule-block-clear"
          aria-label="Unschedule"
        >
          ×
        </button>
      </div>
      <div className="schedule-block-duration">{durationMin}m</div>
      <div
        role="separator"
        aria-orientation="horizontal"
        onMouseDown={handleResizeMouseDown}
        className={resizing ? 'schedule-block-resize active' : 'schedule-block-resize'}
      />
    </div>
  );
});

export function SchedulePage(): JSX.Element {
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<Date>(() => localDayStart(new Date()));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await listTasks());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const dayStart = localDayStart(day);
  const blocks: Block[] = useMemo(() => {
    return tasks
      .map((tk) => parseBlock(tk, dayStart))
      .filter((b): b is Block => b !== null && b.task.status !== 'done' && b.task.status !== 'dismissed');
  }, [tasks, dayStart]);

  const backlog = useMemo(
    () =>
      tasks.filter(
        (tk) => !tk.scheduledStart && tk.status !== 'done' && tk.status !== 'dismissed',
      ),
    [tasks],
  );

  const totalScheduledMin = blocks.reduce((acc, b) => acc + b.durationMin, 0);

  const handleDropOnSlot = useCallback(
    async (taskId: string, hour: number, minute: number) => {
      const existing = tasks.find((t) => t.id === taskId);
      const duration = existing?.scheduledDurationMin ?? 60;
      const startIso = isoFromSlot(day, hour, minute);
      try {
        const updated = await scheduleTask(taskId, startIso, duration);
        setTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)));
      } catch {
        /* keep UI as-is */
      }
    },
    [day, tasks],
  );

  const handleUnschedule = useCallback(async (taskId: string) => {
    try {
      const updated = await unscheduleTask(taskId);
      setTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)));
    } catch {
      /* swallow */
    }
  }, []);

  const handleResize = useCallback(async (block: Block, newMin: number) => {
    const clamped = Math.max(15, Math.min(480, Math.round(newMin / 15) * 15));
    if (clamped === block.durationMin) return;
    try {
      const updated = await scheduleTask(
        block.task.id,
        block.task.scheduledStart ?? '',
        clamped,
      );
      setTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)));
    } catch {
      /* swallow */
    }
  }, []);

  const dayLabel = day.toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  const goPrevDay = useCallback(
    (): void => setDay((d) => localDayStart(new Date(d.getTime() - 86_400_000))),
    [],
  );
  const goNextDay = useCallback(
    (): void => setDay((d) => localDayStart(new Date(d.getTime() + 86_400_000))),
    [],
  );
  const goToday = useCallback((): void => setDay(localDayStart(new Date())), []);

  const isToday = day.toDateString() === new Date().toDateString();
  const nowOffsetPx = isToday
    ? ((now.getHours() - DAY_START_HOUR) + now.getMinutes() / 60) * SLOT_HEIGHT
    : -1;

  const onDragStartId = useCallback((id: string) => setDraggingId(id), []);
  const onDragEnd = useCallback(() => setDraggingId(null), []);
  const onResizeEnd = useCallback(() => setResizingId(null), []);

  const hourSlots = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i);
  const slotsHeight = (DAY_END_HOUR - DAY_START_HOUR) * SLOT_HEIGHT;

  return (
    <div className="schedule-page fadein">
      <aside className="schedule-backlog">
        <div className="schedule-backlog-head">
          Backlog · {backlog.length}
        </div>
        {loading && <p className="schedule-muted">Loading…</p>}
        {!loading && backlog.length === 0 && (
          <p className="schedule-muted">No unscheduled tasks. Add tasks in Today.</p>
        )}
        {backlog.map((tk) => (
          <BacklogItem
            key={tk.id}
            task={tk}
            isDragging={draggingId === tk.id}
            onDragStartId={onDragStartId}
            onDragEnd={onDragEnd}
          />
        ))}
      </aside>

      <section className="schedule-timeline">
        <header className="schedule-timeline-head">
          <div className="schedule-nav">
            <button type="button" className="schedule-nav-btn" onClick={goPrevDay}>‹</button>
            <button type="button" className="schedule-nav-btn schedule-nav-today" onClick={goToday}>
              today
            </button>
            <button type="button" className="schedule-nav-btn" onClick={goNextDay}>›</button>
            <div className="schedule-day-label">{dayLabel}</div>
          </div>
          <div className="schedule-total" data-testid="schedule-total">
            {(totalScheduledMin / 60).toFixed(1)}h scheduled
          </div>
        </header>

        <div ref={timelineRef} className="schedule-timeline-body">
          <div className="schedule-slots" style={{ minHeight: slotsHeight }}>
            {hourSlots.map((hour, i) => (
              <HourSlot
                key={hour}
                hour={hour}
                topPx={i * SLOT_HEIGHT}
                onDrop={handleDropOnSlot}
                onAfterDrop={onDragEnd}
              />
            ))}

            {nowOffsetPx >= 0 && (
              <div className="schedule-now-line" style={{ top: nowOffsetPx }}>
                <span className="schedule-now-dot" aria-hidden />
              </div>
            )}

            {blocks.map((b) => (
              <ScheduledBlock
                key={b.task.id}
                block={b}
                resizing={resizingId === b.task.id}
                onDragStartId={onDragStartId}
                onDragEnd={onDragEnd}
                onUnschedule={handleUnschedule}
                onResizeStart={setResizingId}
                onResizeEnd={onResizeEnd}
                onResizeCommit={handleResize}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
