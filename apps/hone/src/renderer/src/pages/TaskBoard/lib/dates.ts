import { type Locale } from '@d9-i18n';
import { formatLocaleDate, formatLocaleTime } from '@shared/lib/localeFormat';

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

export function formatWhenChip(date: Date, locale?: Locale): string {
  return formatLocaleDate(date, locale, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatColumnHeader(
  date: Date,
  today: Date,
  locale?: Locale,
): { weekday: string; label: string; isToday: boolean } {
  const isToday = toDayKey(date) === toDayKey(today);
  const weekday = formatLocaleDate(date, locale, { weekday: 'long' });
  const label = formatLocaleDate(date, locale, { month: 'short', day: 'numeric' });
  return { weekday, label, isToday };
}

export function formatTimelineHeader(date: Date, locale?: Locale): string {
  return formatLocaleDate(date, locale, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatWeekdayShort(iso: string, locale?: Locale): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return formatLocaleDate(d, locale, { weekday: 'short' });
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

export function roundToNearestMin(d: Date, step = 5): Date {
  const out = new Date(d);
  out.setMinutes(Math.round(out.getMinutes() / step) * step, 0, 0);
  return out;
}

/** Default start for scheduling on a day: now (rounded) for today, 9:00 for other days. */
export function buildDefaultScheduleDate(day: Date, now = new Date()): Date {
  const dayKey = toDayKey(day);
  const out = startOfLocalDay(day);
  if (dayKey === toDayKey(now)) {
    out.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
    return roundToNearestMin(out);
  }
  out.setHours(9, 0, 0, 0);
  return out;
}

/** Final schedule instant when creating a task from the palette. */
export function buildCreateScheduleDate(
  targetDay: Date,
  chosen: Date,
  timeCustomized: boolean,
  now = new Date(),
): Date {
  const day = startOfLocalDay(targetDay);
  if (timeCustomized) {
    return applyTimeFromDay(day, chosen);
  }
  return buildDefaultScheduleDate(day, now);
}

/** RFC3339 with explicit local UTC offset (wall clock the user sees). */
export function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const sec = pad(d.getSeconds());
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const oh = pad(Math.floor(Math.abs(offsetMin) / 60));
  const om = pad(Math.abs(offsetMin) % 60);
  return `${y}-${m}-${day}T${h}:${min}:${sec}${sign}${oh}:${om}`;
}

export function applyTimeToDay(day: Date, hours: number, minutes: number): Date {
  const out = startOfLocalDay(day);
  out.setHours(hours, minutes, 0, 0);
  return out;
}

/** Keep time-of-day from `source`, move to `targetDay` (local). */
export function applyTimeFromDay(targetDay: Date, source: Date): Date {
  return applyTimeToDay(targetDay, source.getHours(), source.getMinutes());
}

export function formatTimeShort(d: Date, locale?: Locale): string {
  return formatLocaleTime(d, locale);
}

export function formatWhenChipWithTime(date: Date, locale?: Locale): string {
  return `${formatWhenChip(date, locale)} · ${formatTimeShort(date, locale)}`;
}

export function taskScheduleStart(task: { scheduledStart?: string }): Date | null {
  if (!task.scheduledStart) return null;
  const d = new Date(task.scheduledStart);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface ScheduledBlock {
  startMs: number;
  endMs: number;
}

/** Nudge start forward until it no longer overlaps existing blocks on the same day. */
export function resolveScheduleStart(
  dayKey: string,
  tasks: Array<{ id?: string; scheduledStart?: string; scheduledDurationMin?: number }>,
  preferred: Date,
  excludeTaskId?: string,
): Date {
  const blocks: ScheduledBlock[] = tasks
    .filter((t) => {
      if (t.id === excludeTaskId || !t.scheduledStart) return false;
      const d = new Date(t.scheduledStart);
      return !Number.isNaN(d.getTime()) && toDayKey(d) === dayKey;
    })
    .map((t) => {
      const start = new Date(t.scheduledStart!);
      const dur = defaultDurationMin(t);
      return {
        startMs: start.getTime(),
        endMs: start.getTime() + dur * 60_000,
      };
    })
    .sort((a, b) => a.startMs - b.startMs);

  let candidate = new Date(preferred);
  for (let i = 0; i < 48; i++) {
    const candEnd = candidate.getTime() + defaultDurationMin({}) * 60_000;
    const conflict = blocks.some((b) => candidate.getTime() < b.endMs && candEnd > b.startMs);
    if (!conflict) return candidate;
    candidate = new Date(candidate.getTime() + 15 * 60_000);
  }
  return preferred;
}

export { DAY_MS };
