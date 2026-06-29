// Daily planner — horizontal day columns + timeline (Winter-style).
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listTasks,
  createTask,
  moveTaskStatus,
  scheduleTask,
  type TaskCard,
} from '../../api/tasks';
import { useSessionStore } from '../../stores/session';
import { DayColumn } from './DayColumn';
import { TimelinePanel } from './TimelinePanel';
import {
  addDays,
  DAY_COLUMN_COUNT,
  isoAtLocalTime,
  localDayStart,
  tasksForDay,
} from './lib/dates';

export function DailyPlannerPage(): JSX.Element {
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => localDayStart(new Date()));
  const today = useMemo(() => localDayStart(new Date()), []);

  const accessToken = useSessionStore((s) => s.accessToken);

  const days = useMemo(
    () => Array.from({ length: DAY_COLUMN_COUNT }, (_, i) => addDays(today, i)),
    [today],
  );

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
    } catch {
      /* keep stale */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    void refresh();
  }, [accessToken, refresh]);

  const scheduleOnDay = useCallback(
    async (taskId: string, day: Date, durationMin: number, hour = 6, minute = 0) => {
      const updated = await scheduleTask(taskId, isoAtLocalTime(day, hour, minute), durationMin);
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      return updated;
    },
    [],
  );

  const handleAdd = useCallback(
    async (day: Date, title: string) => {
      try {
        const created = await createTask({ kind: 'custom', title });
        await scheduleOnDay(created.id, day, 30);
      } catch {
        /* swallow */
      }
    },
    [scheduleOnDay],
  );

  const handleToggleDone = useCallback(async (taskId: string, done: boolean) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: done ? 'done' : 'todo' } : t)),
    );
    try {
      await moveTaskStatus(taskId, done ? 'done' : 'todo');
    } catch {
      void refresh();
    }
  }, [refresh]);

  const handleDuration = useCallback(
    async (taskId: string, durationMin: number) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const day = task.scheduledStart ? localDayStart(new Date(task.scheduledStart)) : today;
      let hour = 6;
      let minute = 0;
      if (task.scheduledStart) {
        const start = new Date(task.scheduledStart);
        hour = start.getHours();
        minute = start.getMinutes();
      }
      try {
        await scheduleOnDay(taskId, day, durationMin, hour, minute);
      } catch {
        void refresh();
      }
    },
    [scheduleOnDay, tasks, today, refresh],
  );

  return (
    <div className="dp-page fadein">
      <div className="dp-board">
        <div className="dp-columns-scroll">
          {loading && <p className="dp-loading">Loading…</p>}
          {!loading &&
            days.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                tasks={tasksForDay(tasks, day, today)}
                selected={day.toDateString() === selectedDay.toDateString()}
                onSelect={() => setSelectedDay(day)}
                onAdd={(title) => handleAdd(day, title)}
                onToggleDone={handleToggleDone}
                onDuration={handleDuration}
              />
            ))}
        </div>
        <TimelinePanel day={selectedDay} tasks={tasks} onTasksChange={setTasks} />
      </div>
    </div>
  );
}
