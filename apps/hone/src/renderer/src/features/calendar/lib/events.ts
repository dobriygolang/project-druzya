import type { GoogleCalendarEvent } from '@features/calendar/api/calendarClient';
import type { TaskCard } from '@features/tasks/api/tasks';
import {
  buildDefaultScheduleDate,
  defaultDurationMin,
  parseDayKey,
  resolveScheduleStart,
  startOfLocalDay,
  taskDayKey,
  taskScheduleStart,
  toDayKey,
} from '@pages/TaskBoard/lib/dates';

export type CalendarEntrySource = 'task' | 'google';

export interface CalendarEntry {
  id: string;
  source: CalendarEntrySource;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  taskId?: string;
  taskStatus?: TaskCard['status'];
  googleEventId?: string;
}

export const CALENDAR_GRID_START_HOUR = 6;
/** Exclusive end hour — labels run through 11 PM (matches task board timeline). */
export const CALENDAR_GRID_END_HOUR = 24;
export const CALENDAR_HOUR_HEIGHT_PX = 52;

const VISIBLE_TASK_STATUSES = new Set(['todo', 'in_progress', 'in_review', 'done']);

export function startOfWeekMonday(d: Date): Date {
  const date = startOfLocalDay(d);
  const diff = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

export interface WeekDay {
  dayKey: string;
  date: Date;
}

export function buildWeekDays(weekStart: Date): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return { dayKey: toDayKey(date), date };
  });
}

export function weekRange(weekStart: Date): { start: Date; end: Date } {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function yearRange(year: number): { start: Date; end: Date } {
  return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}

function taskEntry(task: TaskCard, start: Date): CalendarEntry {
  const mins = defaultDurationMin(task);
  return {
    id: `task:${task.id}`,
    source: 'task',
    title: task.title || 'Untitled',
    start,
    end: new Date(start.getTime() + mins * 60_000),
    allDay: false,
    taskId: task.id,
    taskStatus: task.status,
    googleEventId: task.googleEventId,
  };
}

export interface PlannedTaskBlock {
  task: TaskCard;
  start: Date;
  end: Date;
}

/** Same day + time placement as task board columns and modal calendar. */
export function tasksPlannedForDay(
  dayKey: string,
  tasks: TaskCard[],
  now = new Date(),
): PlannedTaskBlock[] {
  const todayKey = toDayKey(now);
  const day = parseDayKey(dayKey);
  const dayTasks = tasks.filter((task) => {
    if (!VISIBLE_TASK_STATUSES.has(task.status)) return false;
    const key = task.scheduledStart ? taskDayKey(task) : todayKey;
    return key === dayKey;
  });

  const sorted = [...dayTasks].sort((a, b) => {
    const aDone = a.status === 'done' ? 1 : 0;
    const bDone = b.status === 'done' ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    const aStart = taskScheduleStart(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bStart = taskScheduleStart(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aStart - bStart;
  });

  const out: PlannedTaskBlock[] = [];
  let preferred = buildDefaultScheduleDate(day, now);
  for (const task of sorted) {
    const scheduled = taskScheduleStart(task);
    const start =
      scheduled && toDayKey(scheduled) === dayKey
        ? scheduled
        : resolveScheduleStart(dayKey, sorted, preferred, task.id);
    const mins = defaultDurationMin(task);
    out.push({
      task,
      start,
      end: new Date(start.getTime() + mins * 60_000),
    });
    if (!scheduled || toDayKey(scheduled) !== dayKey) {
      preferred = new Date(start.getTime() + mins * 60_000 + 5 * 60_000);
    }
  }
  return out;
}

export function tasksToCalendarEntries(tasks: TaskCard[], now = new Date()): CalendarEntry[] {
  const todayKey = toDayKey(now);
  const visible = tasks.filter((task) => VISIBLE_TASK_STATUSES.has(task.status));
  const dayKeys = new Set<string>();
  for (const task of visible) {
    dayKeys.add(task.scheduledStart ? taskDayKey(task) : todayKey);
  }
  const out: CalendarEntry[] = [];
  for (const dayKey of dayKeys) {
    for (const block of tasksPlannedForDay(dayKey, tasks, now)) {
      out.push(taskEntry(block.task, block.start));
    }
  }
  return out;
}

export function googleToCalendarEntries(
  events: GoogleCalendarEvent[],
  linkedGoogleIds: Set<string>,
): CalendarEntry[] {
  const out: CalendarEntry[] = [];
  for (const ev of events) {
    if (linkedGoogleIds.has(ev.id)) continue;
    const start = new Date(ev.start);
    const end = ev.end ? new Date(ev.end) : new Date(start.getTime() + 60 * 60_000);
    if (Number.isNaN(start.getTime())) continue;
    out.push({
      id: `google:${ev.id}`,
      source: 'google',
      title: ev.title,
      start,
      end: Number.isNaN(end.getTime()) ? new Date(start.getTime() + 60 * 60_000) : end,
      allDay: ev.allDay,
      googleEventId: ev.id,
    });
  }
  return out;
}

export function mergeCalendarEntries(
  tasks: TaskCard[],
  googleEvents: GoogleCalendarEvent[],
  now = new Date(),
): CalendarEntry[] {
  const taskEntries = tasksToCalendarEntries(tasks, now);
  const linked = new Set(
    taskEntries.map((e) => e.googleEventId).filter((id): id is string => Boolean(id)),
  );
  const googleEntries = googleToCalendarEntries(googleEvents, linked);
  return [...taskEntries, ...googleEntries].sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function entriesForDay(entries: CalendarEntry[], dayKey: string): CalendarEntry[] {
  return entries.filter((e) => toDayKey(e.start) === dayKey);
}

export function entriesForWeek(entries: CalendarEntry[], weekStart: Date): CalendarEntry[] {
  const keys = new Set(buildWeekDays(weekStart).map((d) => d.dayKey));
  return entries.filter((e) => keys.has(toDayKey(e.start)));
}

export function entriesForYear(entries: CalendarEntry[], year: number): CalendarEntry[] {
  return entries.filter((e) => e.start.getFullYear() === year);
}

export function eventBlockLayout(
  entry: CalendarEntry,
  hourHeight = CALENDAR_HOUR_HEIGHT_PX,
): { top: number; height: number } | null {
  if (entry.allDay) return { top: 0, height: hourHeight * 0.75 };

  const startH = entry.start.getHours() + entry.start.getMinutes() / 60;
  let endH = entry.end.getHours() + entry.end.getMinutes() / 60;
  if (toDayKey(entry.end) !== toDayKey(entry.start) || endH <= startH) {
    endH = startH + Math.max(0.5, (entry.end.getTime() - entry.start.getTime()) / 3_600_000);
  }

  const gridSpan = CALENDAR_GRID_END_HOUR - CALENDAR_GRID_START_HOUR;
  const maxTop = gridSpan * hourHeight;
  let top = (startH - CALENDAR_GRID_START_HOUR) * hourHeight;
  let height = Math.max((endH - startH) * hourHeight, 22);

  if (top < 0) {
    height += top;
    top = 0;
  }
  if (top >= maxTop) {
    top = Math.max(0, maxTop - 22);
    height = 22;
  } else if (top + height > maxTop) {
    height = Math.max(22, maxTop - top);
  }

  return { top, height };
}

export function calendarHourLabels(): number[] {
  const out: number[] = [];
  for (let h = CALENDAR_GRID_START_HOUR; h < CALENDAR_GRID_END_HOUR; h++) out.push(h);
  return out;
}

export function formatHourLabel(hour: number, locale: string): string {
  const d = new Date(2000, 0, 1, hour, 0);
  return d.toLocaleTimeString(locale, { hour: 'numeric', hour12: true });
}

export function formatWeekHeaderMonth(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
}

export function formatDayHeader(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
}

export function monthRange(viewMonth: Date): { start: Date; end: Date } {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 1);
  return { start, end };
}

export function buildMonthGrid(viewMonth: Date): { dayKey: string; date: Date; inMonth: boolean }[] {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(y, m, 1 - startOffset);
  const cells: { dayKey: string; date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    cells.push({ dayKey: toDayKey(date), date, inMonth: date.getMonth() === m });
  }
  return cells;
}

export function formatEntryTime(entry: CalendarEntry, locale: string): string {
  if (entry.allDay) return 'All day';
  return entry.start.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
