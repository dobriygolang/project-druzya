// SchedulePage — time-blocking day-view.
//
// Layout:
//   • Left rail: backlog (unscheduled tasks, filterable, draggable handles).
//   • Right rail: timeline. Часовые слоты 06:00–23:00 (по дефолту), 15-min
//     grid. Каждая запланированная задача отрисована блоком с серым фоном
//     (b/w only — НЕ цветные kanban-strip'ы), title + длительность.
//   • Header: дата + сумма «6.5h scheduled».
//
// Drag-and-drop: ванильный HTML5 DnD (rfc draggable=true). Drop в часовой
// слот → scheduleTask RPC. Move уже-запланированного блока — drag на новый
// слот. Сдвиг края низа блока меняет длительность (handle + onMouseMove).
//
// Identity: B/W only. #FF3B30 — точка-индикатор (текущее время на таймлайне),
// никогда в bg/fill блоков.
import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

import { useT } from '@d9-i18n';

import {
  listTasks,
  scheduleTask,
  unscheduleTask,
  type TaskCard,
} from '../../api/tasks';
import { trackEvent } from '../../api/events';

const DAY_START_HOUR = 6;
const DAY_END_HOUR = 23;
const SLOT_HEIGHT = 60; // px per hour

interface Block {
  task: TaskCard;
  startMs: number; // ms since dayStart 00:00 local
  durationMin: number;
}

const PAGE_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  paddingTop: 64,
  display: 'flex',
  gap: 16,
  color: 'var(--ink)',
  overflow: 'hidden',
};
const BACKLOG_RAIL_STYLE: CSSProperties = {
  width: 280,
  minWidth: 240,
  flexShrink: 0,
  borderRight: '1px solid var(--ink-tint-06)',
  padding: '0 16px',
  overflowY: 'auto',
};
const BACKLOG_HEADER_STYLE: CSSProperties = {
  paddingBottom: 12, opacity: 0.6, fontSize: 11, letterSpacing: '0.14em',
};
const LOADING_STYLE: CSSProperties = { opacity: 0.5, fontSize: 12 };
const TIMELINE_WRAP_STYLE: CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
};
const TIMELINE_HEADER_STYLE: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0 16px 12px',
};
const TIMELINE_NAV_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 };
const DAY_LABEL_STYLE: CSSProperties = { fontSize: 14, fontWeight: 500 };
const TOTAL_STYLE: CSSProperties = { fontSize: 12, opacity: 0.7 };
const TIMELINE_BODY_STYLE: CSSProperties = {
  flex: 1, position: 'relative', overflowY: 'auto',
  borderTop: '1px solid var(--ink-tint-06)', padding: '0 16px',
};
const SLOT_HOUR_LABEL_STYLE: CSSProperties = {
  position: 'absolute', left: 0, top: -6, width: 50, textAlign: 'right',
  paddingRight: 8, fontFamily: 'JetBrains Mono, ui-monospace, monospace',
};
const NOW_LINE_DOT_STYLE: CSSProperties = {
  position: 'absolute', left: -10, top: -5, width: 10, height: 10,
  borderRadius: '50%', background: '#FF3B30',
};
const BLOCK_TITLE_ROW_STYLE: CSSProperties = {
  display: 'flex', justifyContent: 'space-between', gap: 6,
};
const BLOCK_TITLE_STYLE: CSSProperties = {
  fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};
const BLOCK_UNSCHEDULE_BTN_STYLE: CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--ink-40)',
  cursor: 'pointer', padding: 0, fontSize: 12, lineHeight: 1,
};
const BLOCK_DURATION_STYLE: CSSProperties = { fontSize: 10, opacity: 0.55 };
const NAV_BTN_STYLE: CSSProperties = {
  width: 28, height: 28, borderRadius: 6,
  background: 'var(--ink-tint-04)', border: '1px solid var(--ink-tint-08)',
  color: 'var(--ink)', cursor: 'pointer', fontSize: 14, lineHeight: 1,
};
const NAV_BTN_SM_STYLE: CSSProperties = {
  ...NAV_BTN_STYLE, width: 'auto', padding: '0 10px',
  fontSize: 11, letterSpacing: '0.08em',
};

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
}: BacklogItemProps): JSX.Element {
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('text/x-hone-task', task.id);
    e.dataTransfer.effectAllowed = 'move';
    onDragStartId(task.id);
  }, [task.id, onDragStartId]);
  const style: CSSProperties = {
    padding: '10px 12px',
    marginBottom: 8,
    borderRadius: 8,
    border: '1px solid var(--ink-tint-08)',
    background: isDragging ? 'rgb(var(--ink-rgb) / 0.05)' : 'var(--ink-tint-02)',
    cursor: 'grab',
    fontSize: 13,
    userSelect: 'none',
  };
  return (
    <div draggable onDragStart={handleDragStart} onDragEnd={onDragEnd} style={style}>
      <div style={{ fontWeight: 500 }}>{task.title}</div>
      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>{task.kind}</div>
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
}: HourSlotProps): JSX.Element {
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('text/x-hone-task')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/x-hone-task');
    if (!taskId) return;
    // Snap to the half-hour the cursor landed in.
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const minute = e.clientY - rect.top > SLOT_HEIGHT / 2 ? 30 : 0;
    void onDrop(taskId, hour, minute);
    onAfterDrop();
  }, [hour, onDrop, onAfterDrop]);
  const style: CSSProperties = {
    position: 'absolute', top: topPx, left: 0, right: 0,
    height: SLOT_HEIGHT, borderBottom: '1px solid var(--ink-tint-04)',
    display: 'flex', alignItems: 'flex-start', paddingLeft: 56,
    fontSize: 10, color: 'var(--ink-40)',
  };
  return (
    <div data-hour={hour} onDragOver={handleDragOver} onDrop={handleDrop} style={style}>
      <span style={SLOT_HOUR_LABEL_STYLE}>{pad(hour)}:00</span>
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
}: ScheduledBlockProps): JSX.Element {
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

  const handleUnschedule = useCallback(() => {
    void onUnschedule(task.id);
  }, [task.id, onUnschedule]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    // Capture the block element synchronously; e.currentTarget is nulled
    // by React's event-pool before onMove fires.
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
    position: 'absolute',
    top: topPx,
    left: 64,
    right: 16,
    height: Math.max(heightPx - 2, 24),
    background: 'var(--ink-tint-06)',
    border: '1px solid var(--ink-tint-12)',
    borderRadius: 6,
    padding: '6px 10px',
    fontSize: 12,
    cursor: 'grab',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    userSelect: 'none',
  };

  const handleStyle: CSSProperties = {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 6, cursor: 'ns-resize',
    background: resizing ? 'rgb(var(--ink-rgb) / 0.18)' : 'transparent',
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      style={blockStyle}
    >
      <div style={BLOCK_TITLE_ROW_STYLE}>
        <span style={BLOCK_TITLE_STYLE}>{task.title}</span>
        <button
          onClick={handleUnschedule}
          style={BLOCK_UNSCHEDULE_BTN_STYLE}
          aria-label="Unschedule"
        >
          ×
        </button>
      </div>
      <div style={BLOCK_DURATION_STYLE}>{durationMin}m</div>
      <div
        role="separator"
        aria-orientation="horizontal"
        onMouseDown={handleResizeMouseDown}
        style={handleStyle}
      />
    </div>
  );
});

export function SchedulePage(): JSX.Element {
  const t = useT();
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<Date>(() => localDayStart(new Date()));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Live «now» line — rerender each minute.
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listTasks();
      setTasks(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    trackEvent('schedule_page_open');
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
      const startIso = isoFromSlot(day, hour, minute);
      try {
        const updated = await scheduleTask(taskId, startIso, 60);
        setTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)));
        trackEvent('schedule_task_set', { hour, minute, duration_min: 60 });
      } catch {
        /* leave UI as-is; toast not wired here to keep page lean */
      }
    },
    [day],
  );

  const handleUnschedule = useCallback(async (taskId: string) => {
    try {
      const updated = await unscheduleTask(taskId);
      setTasks((prev) => prev.map((tk) => (tk.id === updated.id ? updated : tk)));
      trackEvent('schedule_task_clear');
    } catch {
      /* swallow */
    }
  }, []);

  const handleResize = useCallback(
    async (block: Block, newMin: number) => {
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
    },
    [],
  );

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

  const slotsContainerStyle: CSSProperties = { position: 'relative', minHeight: (DAY_END_HOUR - DAY_START_HOUR) * SLOT_HEIGHT };

  const nowLineStyle: CSSProperties = {
    position: 'absolute',
    top: nowOffsetPx,
    left: 56,
    right: 16,
    height: 0,
    borderTop: '1.5px solid #FF3B30',
    pointerEvents: 'none',
    zIndex: 3,
  };

  return (
    <div className="motion-page-in" style={PAGE_STYLE}>
      {/* Backlog rail */}
      <div style={BACKLOG_RAIL_STYLE}>
        <div style={BACKLOG_HEADER_STYLE}>
          BACKLOG · {backlog.length}
        </div>
        {loading && <div style={LOADING_STYLE}>{t('common.loading')}</div>}
        {!loading && backlog.length === 0 && (
          <div style={LOADING_STYLE}>
            No unscheduled tasks. Add tasks in TaskBoard.
          </div>
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
      </div>

      {/* Timeline */}
      <div style={TIMELINE_WRAP_STYLE}>
        <div style={TIMELINE_HEADER_STYLE}>
          <div style={TIMELINE_NAV_STYLE}>
            <button onClick={goPrevDay} style={NAV_BTN_STYLE}>‹</button>
            <button onClick={goToday} style={NAV_BTN_SM_STYLE}>today</button>
            <button onClick={goNextDay} style={NAV_BTN_STYLE}>›</button>
            <div style={DAY_LABEL_STYLE}>{dayLabel}</div>
          </div>
          <div style={TOTAL_STYLE} data-testid="schedule-total">
            {(totalScheduledMin / 60).toFixed(1)}h scheduled
          </div>
        </div>

        <div ref={timelineRef} style={TIMELINE_BODY_STYLE}>
          <div style={slotsContainerStyle}>
            {hourSlots.map((hour, i) => (
              <HourSlot
                key={hour}
                hour={hour}
                topPx={i * SLOT_HEIGHT}
                onDrop={handleDropOnSlot}
                onAfterDrop={onDragEnd}
              />
            ))}

            {/* Now-line — current time indicator (the only red accent here). */}
            {nowOffsetPx >= 0 && (
              <div style={nowLineStyle}>
                <span style={NOW_LINE_DOT_STYLE} />
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
      </div>
    </div>
  );
}
