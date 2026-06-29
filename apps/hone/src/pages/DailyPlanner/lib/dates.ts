import type { TaskCard } from '../../../api/tasks';

export const DAY_COLUMN_COUNT = 28;

export function localDayStart(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function addDays(d: Date, n: number): Date {
  return localDayStart(new Date(d.getTime() + n * 86_400_000));
}

export function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isoAtLocalTime(day: Date, hour: number, minute = 0): string {
  const d = new Date(day);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function taskPlanDay(task: TaskCard, today: Date): Date {
  if (task.scheduledStart) {
    return localDayStart(new Date(task.scheduledStart));
  }
  return today;
}

export function tasksForDay(tasks: TaskCard[], day: Date, today: Date): TaskCard[] {
  const key = day.toDateString();
  return tasks
    .filter((t) => t.status !== 'dismissed')
    .filter((t) => taskPlanDay(t, today).toDateString() === key)
    .sort((a, b) => {
      const ta = Date.parse(a.updatedAt || a.createdAt);
      const tb = Date.parse(b.updatedAt || b.createdAt);
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
}

export function columnTotalMin(dayTasks: TaskCard[]): number {
  return dayTasks.reduce((acc, t) => acc + (t.scheduledDurationMin ?? 30), 0);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  if (min % 60 === 0) return `${min / 60}h`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatColumnHeader(d: Date): { weekday: string; date: string } {
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: 'long' }),
    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };
}

export const DURATION_OPTIONS = [15, 20, 30, 45, 60, 120, 180, 240, 360, 480] as const;
