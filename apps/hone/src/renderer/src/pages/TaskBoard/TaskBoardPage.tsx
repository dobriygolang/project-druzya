import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  listTasks,
  moveTaskStatus,
  scheduleTask,
  type TaskCard,
} from '@features/tasks/api/tasks';
import { HONE_HEADER_H } from '@widgets/Chrome';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import { DayColumn, useDayTaskDrag } from './DayColumn';
import { DayTimeline } from './DayTimeline';
import {
  buildDayWindow,
  defaultDurationMin,
  parseDayKey,
  taskDayKey,
  toDayKey,
} from './lib/dates';

const VISIBLE = new Set(['todo', 'in_progress', 'in_review', 'done']);

export function TaskBoardPage(): JSX.Element {
  const today = useMemo(() => new Date(), []);
  const days = useMemo(() => buildDayWindow(today, 14, 21), [today]);
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [selectedDay, setSelectedDay] = useState(() => toDayKey(today));
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
    } catch {
      /* keep stale list */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onTasksChanged = () => void refresh();
    window.addEventListener(HONE_EVENTS.tasksChanged, onTasksChanged);
    return () => window.removeEventListener(HONE_EVENTS.tasksChanged, onTasksChanged);
  }, [refresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const todayIdx = days.findIndex((d) => d.key === toDayKey(today));
    if (todayIdx < 0) return;
    const colWidth = 264;
    el.scrollLeft = Math.max(0, todayIdx * colWidth - el.clientWidth * 0.35);
  }, [days, today]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskCard[]>();
    for (const d of days) map.set(d.key, []);
    for (const task of tasks) {
      if (!VISIBLE.has(task.status)) continue;
      const key = task.scheduledStart ? taskDayKey(task) : toDayKey(today);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const aDone = a.status === 'done' ? 1 : 0;
        const bDone = b.status === 'done' ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return 0;
      });
    }
    return map;
  }, [tasks, days, today]);

  const selectedDate = useMemo(
    () => days.find((d) => d.key === selectedDay)?.date ?? today,
    [days, selectedDay, today],
  );

  const findTaskColumnKey = useCallback(
    (taskId: string): string | null => {
      for (const [key, list] of tasksByDay) {
        if (list.some((t) => t.id === taskId)) return key;
      }
      return null;
    },
    [tasksByDay],
  );

  const handleMoveToDay = useCallback(
    async (taskId: string, dayKey: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const sourceKey = findTaskColumnKey(taskId);
      if (sourceKey === dayKey) return;

      const start = parseDayKey(dayKey);
      start.setHours(9, 0, 0, 0);
      const startIso = start.toISOString();
      const duration = Math.max(15, defaultDurationMin(task));

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, scheduledStart: startIso, scheduledDurationMin: duration }
            : t,
        ),
      );
      setSelectedDay(dayKey);

      try {
        const updated = await scheduleTask(task.id, startIso, duration);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      } catch {
        void refresh();
      }
    },
    [tasks, findTaskColumnKey, refresh],
  );

  const { draggingId, dropDay, onPointerDragStart } = useDayTaskDrag(handleMoveToDay);

  const openAddTask = useCallback((dayKey: string) => {
    window.dispatchEvent(
      new CustomEvent(HONE_EVENTS.openPaletteAddTask, { detail: { dayKey } }),
    );
  }, []);

  const handleToggleDone = useCallback(
    async (task: TaskCard) => {
      const next = task.status === 'done' ? 'todo' : 'done';
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
      try {
        await moveTaskStatus(task.id, next);
      } catch {
        void refresh();
      }
    },
    [refresh],
  );

  const handleDurationChange = useCallback(
    async (task: TaskCard, durationMin: number, columnDate: Date) => {
      const clamped = Math.max(15, durationMin);
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, scheduledDurationMin: clamped } : t)),
      );
      try {
        let startIso: string;
        if (task.scheduledStart) {
          startIso = task.scheduledStart;
        } else {
          const start = new Date(columnDate);
          start.setHours(9, 0, 0, 0);
          startIso = start.toISOString();
        }
        const updated = await scheduleTask(task.id, startIso, clamped);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      } catch {
        void refresh();
      }
    },
    [refresh],
  );

  useEffect(() => {
    const onOpen = (e: Event): void => {
      const taskId = (e as CustomEvent<{ taskId?: string }>).detail?.taskId;
      if (!taskId) return;
      const task = tasks.find((t) => t.id === taskId);
      if (task) setSelectedDay(taskDayKey(task));
    };
    window.addEventListener(HONE_EVENTS.openTask, onOpen);
    return () => window.removeEventListener(HONE_EVENTS.openTask, onOpen);
  }, [tasks]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: `${HONE_HEADER_H}px 20px 88px`,
        display: 'flex',
        gap: 12,
        minHeight: 0,
        WebkitAppRegion: 'no-drag',
      }}
    >
      <div
        ref={scrollRef}
        className="hone-hide-scrollbar"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          height: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'stretch',
          gap: 10,
          scrollSnapType: 'x proximity',
          WebkitAppRegion: 'no-drag',
        }}
      >
        {days.map((d) => (
          <DayColumn
            key={d.key}
            dayKey={d.key}
            date={d.date}
            today={today}
            tasks={tasksByDay.get(d.key) ?? []}
            selected={selectedDay === d.key}
            dropHighlight={dropDay === d.key && draggingId !== null}
            onSelect={() => setSelectedDay(d.key)}
            onAddClick={() => openAddTask(d.key)}
            onToggleDone={(task) => void handleToggleDone(task)}
            onDurationChange={(task, min) => void handleDurationChange(task, min, d.date)}
            onPointerDragStart={(taskId, e) => onPointerDragStart(taskId, e)}
          />
        ))}
      </div>

      <DayTimeline date={selectedDate} tasks={tasks} />
    </div>
  );
}
