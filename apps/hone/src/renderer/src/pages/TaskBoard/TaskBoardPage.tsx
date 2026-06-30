import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useT } from '@d9-i18n';

import {
  listTasks,
  moveTaskStatus,
  scheduleTask,
  renameTask,
  reorderTasks,
  type TaskCard,
} from '@features/tasks/api/tasks';
import { HONE_HEADER_H } from '@widgets/Chrome';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import { DayColumn } from './DayColumn';
import { useDayTaskDrag } from './useDayTaskDrag';
import { useInfiniteDayScroll } from './useInfiniteDayScroll';
import { DayTimeline } from './DayTimeline';
import {
  applyTimeFromDay,
  buildDefaultScheduleDate,
  defaultDurationMin,
  parseDayKey,
  resolveScheduleStart,
  taskDayKey,
  taskScheduleStart,
  toDayKey,
} from './lib/dates';

const VISIBLE = new Set(['todo', 'in_progress', 'in_review', 'done']);

export function TaskBoardPage(): JSX.Element {
  const t = useT();
  const today = useMemo(() => new Date(), []);
  const todayKey = toDayKey(today);
  const { days, scrollRef, showBackToToday, scrollToToday, ensureDayVisible, expandRangeForDayKeys } =
    useInfiniteDayScroll(today);
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [selectedDay, setSelectedDay] = useState(() => todayKey);
  const [editRequest, setEditRequest] = useState<{ taskId: string; key: number } | null>(null);
  const didExpandTasksRef = useRef(false);

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
    const onSync = () => void refresh();
    window.addEventListener(HONE_EVENTS.tasksChanged, onTasksChanged);
    window.addEventListener(HONE_EVENTS.syncChanged, onSync);
    return () => {
      window.removeEventListener(HONE_EVENTS.tasksChanged, onTasksChanged);
      window.removeEventListener(HONE_EVENTS.syncChanged, onSync);
    };
  }, [refresh]);

  useEffect(() => {
    if (tasks.length === 0 || didExpandTasksRef.current) return;
    didExpandTasksRef.current = true;
    const keys = tasks
      .filter((task) => VISIBLE.has(task.status))
      .map((task) => (task.scheduledStart ? taskDayKey(task) : todayKey));
    expandRangeForDayKeys(keys);
  }, [tasks, todayKey, expandRangeForDayKeys]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskCard[]>();
    for (const d of days) map.set(d.key, []);
    for (const task of tasks) {
      if (!VISIBLE.has(task.status)) continue;
      const key = task.scheduledStart ? taskDayKey(task) : todayKey;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const aDone = a.status === 'done' ? 1 : 0;
        const bDone = b.status === 'done' ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        const aOrder = a.order ?? taskScheduleStart(a)?.getTime() ?? new Date(a.createdAt).getTime();
        const bOrder = b.order ?? taskScheduleStart(b)?.getTime() ?? new Date(b.createdAt).getTime();
        return aOrder - bOrder;
      });
    }
    return map;
  }, [tasks, days, todayKey]);

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

      const existing = taskScheduleStart(task);
      const start = existing
        ? applyTimeFromDay(parseDayKey(dayKey), existing)
        : buildDefaultScheduleDate(parseDayKey(dayKey));
      const resolved = resolveScheduleStart(dayKey, tasks, start, taskId);
      const startIso = resolved.toISOString();
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
        const updated = await scheduleTask(task.id, resolved, duration);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      } catch {
        void refresh();
      }
    },
    [tasks, findTaskColumnKey, refresh],
  );

  const handleReorder = useCallback(
    async (taskId: string, targetTaskId: string) => {
      const sourceKey = findTaskColumnKey(taskId);
      if (!sourceKey) return;
      const list = tasksByDay.get(sourceKey);
      if (!list) return;
      const fromIdx = list.findIndex((t) => t.id === taskId);
      const toIdx = list.findIndex((t) => t.id === targetTaskId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

      const next = list.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const reordered = next.map((t, i) => ({ ...t, order: i }));

      setTasks((prev) =>
        prev.map((t) => {
          const r = reordered.find((w) => w.id === t.id);
          return r ? { ...t, order: r.order } : t;
        }),
      );
      try {
        await reorderTasks(reordered);
      } catch {
        void refresh();
      }
    },
    [findTaskColumnKey, tasksByDay, refresh],
  );

  const handleDrop = useCallback(
    (taskId: string, dayKey: string, targetTaskId: string | null) => {
      const sourceKey = findTaskColumnKey(taskId);
      if (targetTaskId && targetTaskId !== taskId && sourceKey === dayKey) {
        void handleReorder(taskId, targetTaskId);
        return;
      }
      void handleMoveToDay(taskId, dayKey);
    },
    [findTaskColumnKey, handleReorder, handleMoveToDay],
  );

  const handleTaskTap = useCallback((taskId: string) => {
    setEditRequest((prev) => ({ taskId, key: (prev?.key ?? 0) + 1 }));
  }, []);

  const { draggingId, dropDay, dropTaskId, onPointerDragStart } = useDayTaskDrag(
    handleDrop,
    handleTaskTap,
  );

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

  const handleTitleChange = useCallback(
    async (task: TaskCard, title: string) => {
      const next = title.trim();
      if (!next || next === task.title) return;
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, title: next } : t)));
      try {
        const updated = await renameTask(task.id, next);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
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
        const dayKey = toDayKey(columnDate);
        const start = taskScheduleStart(task) ?? buildDefaultScheduleDate(columnDate);
        const resolved = resolveScheduleStart(dayKey, tasks, start, task.id);
        const updated = await scheduleTask(task.id, resolved, clamped);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      } catch {
        void refresh();
      }
    },
    [tasks, refresh],
  );

  // Drag-to-reschedule from the calendar / timeline: place the task at the exact
  // dropped time (no conflict-nudging — the user is positioning it deliberately).
  const handleReschedule = useCallback(
    async (task: TaskCard, start: Date) => {
      const duration = Math.max(15, defaultDurationMin(task));
      const startIso = start.toISOString();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, scheduledStart: startIso, scheduledDurationMin: duration } : t,
        ),
      );
      try {
        const updated = await scheduleTask(task.id, start, duration);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      } catch {
        void refresh();
      }
    },
    [refresh],
  );

  const handleBackToToday = useCallback(() => {
    scrollToToday();
    setSelectedDay(todayKey);
  }, [scrollToToday, todayKey]);

  useEffect(() => {
    const onOpen = (e: Event): void => {
      const taskId = (e as CustomEvent<{ taskId?: string }>).detail?.taskId;
      if (!taskId) return;
      const task = tasks.find((item) => item.id === taskId);
      if (!task) return;
      const key = taskDayKey(task);
      setSelectedDay(key);
      ensureDayVisible(key);
    };
    window.addEventListener(HONE_EVENTS.openTask, onOpen);
    return () => window.removeEventListener(HONE_EVENTS.openTask, onOpen);
  }, [tasks, ensureDayVisible]);

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
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <div
          ref={scrollRef}
          className="hone-hide-scrollbar hone-task-board-scroll"
          style={{
            width: '100%',
            height: '100%',
            minHeight: 0,
            overflowX: 'auto',
            overflowY: 'hidden',
            display: 'flex',
            alignItems: 'stretch',
            gap: 10,
            WebkitAppRegion: 'no-drag',
          }}
        >
          {days.map((d) => (
            <DayColumn
              key={d.key}
              dayKey={d.key}
              date={d.date}
              today={today}
              draggingId={draggingId}
              dropHighlight={dropDay === d.key && draggingId !== null}
              dropTaskId={dropDay === d.key ? dropTaskId : null}
              editRequest={editRequest}
              tasks={tasksByDay.get(d.key) ?? []}
              selected={selectedDay === d.key}
              onSelect={() => setSelectedDay(d.key)}
              onAddClick={() => openAddTask(d.key)}
              onToggleDone={(task) => void handleToggleDone(task)}
              onDurationChange={(task, min) => void handleDurationChange(task, min, d.date)}
              onTitleChange={(task, title) => void handleTitleChange(task, title)}
              onPointerDragStart={onPointerDragStart}
            />
          ))}
        </div>
      </div>

      <DayTimeline
        date={selectedDate}
        tasks={tasks}
        onReschedule={(task, start) => void handleReschedule(task, start)}
      />

      {showBackToToday && (
        <div className="hone-back-to-today-anchor">
          <button
            type="button"
            onClick={handleBackToToday}
            className="mono fadein hone-pill-btn"
            aria-label={t('hone.taskboard.back_to_today')}
            style={{ fontSize: 11, WebkitAppRegion: 'no-drag' }}
          >
            {t('hone.taskboard.back_to_today')}
          </button>
        </div>
      )}
    </div>
  );
}
