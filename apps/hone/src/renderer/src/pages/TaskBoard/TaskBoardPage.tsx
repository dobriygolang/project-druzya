import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createTask,
  deleteTask,
  listTasks,
  moveTaskStatus,
  scheduleTask,
  type TaskCard,
} from '@features/tasks/api/tasks';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import { DayColumn } from './DayColumn';
import { DayTimeline } from './DayTimeline';
import { buildDayWindow, parseDayKey, taskDayKey, toDayKey } from './lib/dates';

const ACTIVE = new Set(['todo', 'in_progress', 'in_review']);

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
      if (!ACTIVE.has(task.status)) continue;
      const key = task.scheduledStart ? taskDayKey(task) : toDayKey(today);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [tasks, days, today]);

  const selectedDate = useMemo(
    () => days.find((d) => d.key === selectedDay)?.date ?? today,
    [days, selectedDay, today],
  );

  const handleCreate = useCallback(
    async (dayKey: string, title: string) => {
      try {
        let created = await createTask({ title });
        if (dayKey !== toDayKey(today)) {
          const start = parseDayKey(dayKey);
          start.setHours(9, 0, 0, 0);
          created = await scheduleTask(created.id, start.toISOString(), 30);
        }
        setTasks((prev) => [created, ...prev]);
        setSelectedDay(dayKey);
      } catch {
        /* silent */
      }
    },
    [today],
  );

  const handleToggleDone = useCallback(async (task: TaskCard) => {
    const next = task.status === 'done' ? 'todo' : 'done';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: next } : t)));
    try {
      await moveTaskStatus(task.id, next);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const handleDelete = useCallback(async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteTask(taskId);
    } catch {
      void refresh();
    }
  }, [refresh]);

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
      className="fadein"
      style={{
        position: 'absolute',
        inset: 0,
        padding: '72px 20px 88px',
        display: 'flex',
        gap: 12,
        minHeight: 0,
      }}
    >
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          gap: 10,
          paddingBottom: 8,
          scrollSnapType: 'x proximity',
        }}
      >
        {days.map((d) => (
          <div key={d.key} style={{ scrollSnapAlign: 'start' }}>
            <DayColumn
              date={d.date}
              today={today}
              tasks={tasksByDay.get(d.key) ?? []}
              selected={selectedDay === d.key}
              onSelect={() => setSelectedDay(d.key)}
              onCreate={(title) => void handleCreate(d.key, title)}
              onToggleDone={(task) => void handleToggleDone(task)}
              onDelete={(id) => void handleDelete(id)}
            />
          </div>
        ))}
      </div>

      <DayTimeline date={selectedDate} tasks={tasks} />
    </div>
  );
}
