import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useT, useLocale, type Locale } from '@d9-i18n';

import {
  listGoogleCalendarEvents,
  type GoogleCalendarEvent,
} from '@features/calendar/api/calendarClient';
import {
  buildMonthGrid,
  buildWeekDays,
  calendarHourLabels,
  entriesForDay,
  entriesForWeek,
  entriesForYear,
  eventBlockLayout,
  formatDayHeader,
  formatHourLabel,
  formatWeekHeaderMonth,
  mergeCalendarEntries,
  startOfWeekMonday,
  weekRange,
  yearRange,
  CALENDAR_GRID_END_HOUR,
  CALENDAR_GRID_START_HOUR,
  CALENDAR_HOUR_HEIGHT_PX,
  type CalendarEntry,
} from '@features/calendar/lib/events';
import { listTasks, type TaskCard } from '@features/tasks/api/tasks';
import { SegmentedControl } from '@pages/Settings/primitives/SegmentedControl';
import { toDayKey } from '@pages/TaskBoard/lib/dates';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import { formatLocaleDate, formatTimeZoneLabel, getUserTimeZone } from '@shared/lib/localeFormat';
import { zIndex } from '@shared/lib/z-index';
import { Icon } from '@shared/ui/primitives/Icon';
import { LOCAL_ONLY } from '@app/config/features';

type ViewMode = 'week' | 'year';

interface CalendarModalProps {
  onClose: () => void;
  closing?: boolean;
}

export function CalendarModal({ onClose, closing = false }: CalendarModalProps): JSX.Element {
  const t = useT();
  const [locale] = useLocale();
  const todayKey = toDayKey(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date(), locale));
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const refreshTasks = useCallback(async () => {
    try {
      setTasks(await listTasks());
    } catch {
      /* keep stale */
    }
  }, []);

  const refreshGoogle = useCallback(async () => {
    if (LOCAL_ONLY) {
      setGoogleEvents([]);
      setGoogleError(null);
      return;
    }
    const { start, end } =
      viewMode === 'week' ? weekRange(weekStart) : yearRange(viewYear);
    const padStart = new Date(start);
    padStart.setDate(padStart.getDate() - 1);
    const padEnd = new Date(end);
    padEnd.setDate(padEnd.getDate() + 1);
    try {
      setGoogleEvents(await listGoogleCalendarEvents(padStart, padEnd));
      setGoogleError(null);
    } catch {
      setGoogleError(t('hone.calendar.google_error'));
    }
  }, [viewMode, weekStart, viewYear, t]);

  useEffect(() => {
    if (viewMode === 'year') setViewYear(weekStart.getFullYear());
  }, [viewMode, weekStart]);

  useEffect(() => {
    void refreshTasks();
  }, [refreshTasks]);

  useEffect(() => {
    void refreshGoogle();
  }, [refreshGoogle]);

  useEffect(() => {
    setWeekStart((prev) => startOfWeekMonday(prev, locale));
  }, [locale]);

  useEffect(() => {
    const onTasks = () => void refreshTasks();
    const onSync = () => {
      void refreshTasks();
      void refreshGoogle();
    };
    window.addEventListener(HONE_EVENTS.tasksChanged, onTasks);
    window.addEventListener(HONE_EVENTS.syncChanged, onSync);
    return () => {
      window.removeEventListener(HONE_EVENTS.tasksChanged, onTasks);
      window.removeEventListener(HONE_EVENTS.syncChanged, onSync);
    };
  }, [refreshTasks, refreshGoogle]);

  const entries = useMemo(
    () => mergeCalendarEntries(tasks, googleEvents),
    [tasks, googleEvents],
  );

  const weekDays = useMemo(() => buildWeekDays(weekStart), [weekStart]);
  const weekEntries = useMemo(() => entriesForWeek(entries, weekStart), [entries, weekStart]);
  const yearEntries = useMemo(() => entriesForYear(entries, viewYear), [entries, viewYear]);
  const hours = useMemo(() => calendarHourLabels(), []);

  const weekScrollRef = useRef<HTMLDivElement>(null);

  // Fit the hour grid exactly into the scroll container — measure the real
  // flex slot (not window.innerHeight) and drop the old 60px cap that forced
  // an 18×60 = 1080px grid taller than the modal.
  const gridSpan = CALENDAR_GRID_END_HOUR - CALENDAR_GRID_START_HOUR;
  const [hourHeight, setHourHeight] = useState(CALENDAR_HOUR_HEIGHT_PX);
  useLayoutEffect(() => {
    if (viewMode !== 'week') return;
    const el = weekScrollRef.current;
    if (!el) return;
    const recompute = () => {
      const slot = el.clientHeight;
      if (slot <= 0) return;
      const h = Math.floor(slot / gridSpan);
      setHourHeight(Math.max(1, h));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [gridSpan, viewMode]);
  const gridHeight = gridSpan * hourHeight;

  const headerLabel =
    viewMode === 'week'
      ? formatWeekHeaderMonth(weekStart, locale)
      : String(viewYear);

  const timeZoneLabel = useMemo(
    () => formatTimeZoneLabel(getUserTimeZone(), locale),
    [locale],
  );

  const shiftPeriod = (delta: number) => {
    if (viewMode === 'week') {
      setWeekStart((prev) => {
        const next = new Date(prev);
        next.setDate(prev.getDate() + delta * 7);
        return next;
      });
      return;
    }
    setViewYear((y) => y + delta);
  };

  const openTask = (taskId: string) => {
    onClose();
    window.dispatchEvent(new CustomEvent(HONE_EVENTS.navOpenTask, { detail: { taskId } }));
  };

  const viewOptions = useMemo(
    () => [
      { value: 'week' as const, label: t('hone.calendar.view_week') },
      { value: 'year' as const, label: t('hone.calendar.view_year') },
    ],
    [t],
  );

  return (
    <div
      className="hone-calendar-backdrop fadein"
      data-closing={closing ? 'true' : undefined}
      style={{ zIndex: zIndex.modal }}
      onClick={onClose}
    >
      <div
        className={`hone-calendar-modal motion-modal-in ${closing ? 'slide-to-right' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('hone.calendar.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="hone-calendar-toolbar">
          <div className="hone-calendar-toolbar__left">
            <h2 className="hone-calendar-toolbar__title">{headerLabel}</h2>
            <div className="hone-calendar-toolbar__nav">
              <button
                type="button"
                className="hone-calendar-nav-btn focus-ring"
                onClick={() => shiftPeriod(-1)}
                aria-label={
                  viewMode === 'week'
                    ? t('hone.calendar.prev_week')
                    : t('hone.calendar.prev_year')
                }
              >
                <Icon name="chevron-left" size={14} />
              </button>
              <button
                type="button"
                className="hone-calendar-nav-btn focus-ring"
                onClick={() => shiftPeriod(1)}
                aria-label={
                  viewMode === 'week' ? t('hone.calendar.next_week') : t('hone.calendar.next_year')
                }
              >
                <Icon name="chevron-right" size={14} />
              </button>
            </div>
          </div>
          <SegmentedControl
            ariaLabel={t('hone.calendar.view_mode')}
            value={viewMode}
            options={viewOptions}
            onChange={setViewMode}
          />
        </header>

        {viewMode === 'week' ? (
          <div className="hone-calendar-week">
            <div className="hone-calendar-week__head">
              <div className="hone-calendar-week__gutter" aria-hidden />
              {weekDays.map(({ date, dayKey }) => (
                <div
                  key={dayKey}
                  className="hone-calendar-week__dayhead"
                  data-today={dayKey === todayKey ? 'true' : undefined}
                >
                  {formatDayHeader(date, locale)}
                </div>
              ))}
            </div>

            <div ref={weekScrollRef} className="hone-calendar-week__scroll">
              <div className="hone-calendar-week__body" style={{ height: gridHeight }}>
                <div className="hone-calendar-week__times" style={{ height: gridHeight }}>
                  {hours.map((hour) => (
                    <span
                      key={hour}
                      className="hone-calendar-week__time"
                      style={{ height: hourHeight }}
                    >
                      {formatHourLabel(hour, locale)}
                    </span>
                  ))}
                </div>

                <div className="hone-calendar-week__grid" style={{ height: gridHeight }}>
                  {weekDays.map(({ dayKey }) => (
                    <div key={dayKey} className="hone-calendar-week__col">
                      {hours.map((hour) => (
                        <div
                          key={hour}
                          className="hone-calendar-week__cell"
                          style={{ height: hourHeight }}
                        />
                      ))}
                      {weekEntries
                        .filter((e) => toDayKey(e.start) === dayKey)
                        .map((entry) => {
                          const layout = eventBlockLayout(entry, hourHeight);
                          if (!layout) return null;
                          return (
                            <CalendarEventBlock
                              key={entry.id}
                              entry={entry}
                              top={layout.top}
                              height={layout.height}
                              onOpenTask={openTask}
                            />
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <YearGrid
            year={viewYear}
            entries={yearEntries}
            todayKey={todayKey}
            locale={locale}
            onPickMonth={(monthIndex) => {
              setWeekStart(startOfWeekMonday(new Date(viewYear, monthIndex, 1), locale));
              setViewMode('week');
            }}
          />
        )}

        <p className="hone-calendar-footnote mono">
          {t('hone.calendar.timezone', { zone: timeZoneLabel })}
        </p>
        {googleError && !LOCAL_ONLY && (
          <p className="hone-calendar-footnote mono">{googleError}</p>
        )}
      </div>
    </div>
  );
}

function CalendarEventBlock({
  entry,
  top,
  height,
  onOpenTask,
}: {
  entry: CalendarEntry;
  top: number;
  height: number;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  const done = entry.taskStatus === 'done';
  const style = { top, height };

  if (entry.source === 'task' && entry.taskId) {
    return (
      <button
        type="button"
        className="hone-calendar-event focus-ring"
        data-source="task"
        data-done={done ? 'true' : undefined}
        style={style}
        onClick={() => onOpenTask(entry.taskId!)}
        title={entry.title}
      >
        <span className="hone-calendar-event__title">{entry.title}</span>
      </button>
    );
  }

  return (
    <div
      className="hone-calendar-event"
      data-source="google"
      style={style}
      title={entry.title}
    >
      <span className="hone-calendar-event__title">{entry.title}</span>
    </div>
  );
}

function YearGrid({
  year,
  entries,
  todayKey,
  locale,
  onPickMonth,
}: {
  year: number;
  entries: CalendarEntry[];
  todayKey: string;
  locale: Locale;
  onPickMonth: (monthIndex: number) => void;
}): JSX.Element {
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => {
        const viewMonth = new Date(year, monthIndex, 1);
        const grid = buildMonthGrid(viewMonth, locale);
        return { monthIndex, viewMonth, grid };
      }),
    [year, locale],
  );

  return (
    <div className="hone-calendar-year">
      {months.map(({ monthIndex, viewMonth, grid }) => {
        const label = formatLocaleDate(viewMonth, locale, { month: 'long' });
        return (
          <button
            key={monthIndex}
            type="button"
            className="hone-calendar-year__month focus-ring"
            onClick={() => onPickMonth(monthIndex)}
          >
            <span className="hone-calendar-year__label">{label}</span>
            <div className="hone-calendar-year__grid">
              {grid.map((cell) => {
                const dayEntries = entriesForDay(entries, cell.dayKey);
                const hasTask = dayEntries.some((e) => e.source === 'task');
                const hasGoogle = dayEntries.some((e) => e.source === 'google');
                return (
                  <span
                    key={cell.dayKey}
                    className="hone-calendar-year__cell"
                    data-outside={cell.inMonth ? undefined : 'true'}
                    data-today={cell.dayKey === todayKey ? 'true' : undefined}
                    data-busy={hasTask || hasGoogle ? 'true' : undefined}
                  >
                    {cell.inMonth ? cell.date.getDate() : ''}
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
