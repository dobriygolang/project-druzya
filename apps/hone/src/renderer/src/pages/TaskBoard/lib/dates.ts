const DAY_MS = 24 * 60 * 60 * 1000;

export interface DayKey {
  /** YYYY-MM-DD in local timezone */
  key: string;
  date: Date;
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(base: Date, offset: number): Date {
  const d = startOfLocalDay(base);
  d.setDate(d.getDate() + offset);
  return d;
}

/** Window of days centered on today (inclusive). */
export function buildDayWindow(center: Date, before: number, after: number): DayKey[] {
  const out: DayKey[] = [];
  for (let i = -before; i <= after; i++) {
    const date = addDays(center, i);
    out.push({ key: toDayKey(date), date });
  }
  return out;
}

export function formatWhenChip(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatColumnHeader(date: Date, today: Date): { weekday: string; label: string; isToday: boolean } {
  const isToday = toDayKey(date) === toDayKey(today);
  const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
  const label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { weekday, label, isToday };
}

export function formatTimelineHeader(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function taskDayKey(task: { scheduledStart?: string; createdAt: string }): string {
  if (task.scheduledStart) {
    const d = new Date(task.scheduledStart);
    if (!Number.isNaN(d.getTime())) return toDayKey(d);
  }
  const created = new Date(task.createdAt);
  if (!Number.isNaN(created.getTime())) return toDayKey(created);
  return toDayKey(new Date());
}

export function defaultDurationMin(task: { scheduledDurationMin?: number }): number {
  return task.scheduledDurationMin && task.scheduledDurationMin > 0 ? task.scheduledDurationMin : 30;
}

export function sumDurationMin(tasks: Array<{ scheduledDurationMin?: number }>): number {
  return tasks.reduce((acc, t) => acc + defaultDurationMin(t), 0);
}

export function formatDuration(totalMin: number): string {
  if (totalMin <= 0) return '0m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Compact label for task row / duration menu (30m, 1h, 2h). */
export function formatDurationShort(totalMin: number): string {
  if (totalMin <= 0) return '0m';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export { DAY_MS };
