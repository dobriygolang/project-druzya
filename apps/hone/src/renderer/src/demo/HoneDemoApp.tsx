/**
 * Real Hone signed-in shell for the marketing embed — same UI as desktop, local-only (IndexedDB).
 */
import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';

import { CanvasBg, type ThemeId } from '@widgets/CanvasBg';
import { Wordmark } from '@widgets/Chrome';
import { Dock } from '@widgets/Dock';
import { AnimatedStatsOverlay } from '@widgets/AnimatedStatsOverlay';
import { AnimatedCalendarOverlay } from '@widgets/AnimatedCalendarOverlay';
import { PomodoroController } from '@widgets/PomodoroController';
import { type PageId, type PaletteAction } from '@widgets/Palette';
import { HomePage } from '@pages/Home';
import { createTask, listTasks, scheduleTask } from '@features/tasks/api/tasks';
import {
  parseDayKey,
  resolveScheduleStart,
  toDayKey,
} from '@pages/TaskBoard/lib/dates';
import { readStoredTheme } from '@shared/model/prefs';
import { applyTheme } from '@shared/lib/applyTheme';
import { usePomodoroStore, type PomodoroStartArgs } from '@shared/model/pomodoro';
import { useSessionStore } from '@shared/model/session';
import { applyTextScale, readTextScale } from '@shared/model/accessibility';
import { PageStack } from '@shared/ui/PageStack';
import { useGlobalHotkeys } from '@shared/hooks/useGlobalHotkeys';
import { migrateLocalStorageIfNeeded } from '@shared/sync/migrateLocalStorage';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import { ErrorBoundary } from '@shared/ui/ErrorBoundary';

import { DEMO_USER_ID } from './constants';
import { seedDemoData } from './seedDemoData';
import { DemoEmbedFrame } from './DemoEmbedFrame';

const TaskBoardPage = lazy(() => import('@pages/TaskBoard').then((m) => ({ default: m.TaskBoardPage })));
const NotesPage = lazy(() => import('@pages/Notes').then((m) => ({ default: m.NotesPage })));
const SettingsPage = lazy(() => import('@pages/Settings').then((m) => ({ default: m.SettingsPage })));
const WhiteboardPage = lazy(() =>
  import('@pages/Whiteboard').then((m) => ({ default: m.WhiteboardPage })),
);
const Palette = lazy(() => import('@widgets/Palette').then((m) => ({ default: m.Palette })));

const PALETTE_UNMOUNT_DELAY_MS = 260;

export type StartFocusArgs = PomodoroStartArgs;

export interface HoneDemoAppProps {
  compact?: boolean;
  /** Maps web site light/dark to Hone canvas theme when set. */
  siteTheme?: 'dark' | 'light';
}

function bootstrapDemoSession(): void {
  useSessionStore.getState().hydrate({
    userId: DEMO_USER_ID,
    accessToken: 'demo-local',
  });
}

function themeForSite(siteTheme: 'dark' | 'light' | undefined, stored: ThemeId): ThemeId {
  if (!siteTheme) return stored;
  if (siteTheme === 'light') return stored === 'debris' || stored === 'launch' ? stored : 'drift';
  return stored === 'winter' || stored === 'particles' ? stored : 'particles';
}

function HoneDemoShell({ siteTheme }: { siteTheme?: 'dark' | 'light' }) {
  const [page, setPageRaw] = useState<PageId>('home');
  const [statsOpen, setStatsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMounted, setPaletteMounted] = useState(false);
  const [paletteClosing, setPaletteClosing] = useState(false);
  const [paletteTaskDate, setPaletteTaskDate] = useState<Date | null>(null);
  const [theme, setTheme] = useState<ThemeId>(() => themeForSite(siteTheme, readStoredTheme()));
  const [ready, setReady] = useState(false);

  const setPage = useCallback((next: PageId | ((p: PageId) => PageId)) => {
    setPageRaw((current) => (typeof next === 'function' ? next(current) : next));
  }, []);

  const navigateTo = useCallback(
    (id: PageId) => {
      if (id === page) return;
      setStatsOpen(false);
      setCalendarOpen(false);
      setPage(id);
    },
    [page, setPage],
  );

  useLayoutEffect(() => {
    bootstrapDemoSession();
    applyTextScale(readTextScale());
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (siteTheme === undefined) return;
    setTheme((cur) => themeForSite(siteTheme, cur));
  }, [siteTheme]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await migrateLocalStorageIfNeeded(DEMO_USER_ID);
      await seedDemoData();
      if (cancelled) return;
      setReady(true);
      void import('@pages/TaskBoard');
      void import('@pages/Notes');
      void import('@pages/Settings');
      void import('@pages/Whiteboard');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startFocus = useCallback(
    (args?: StartFocusArgs) => {
      usePomodoroStore.getState().start(args);
      navigateTo('home');
    },
    [navigateTo],
  );

  const openStats = useCallback(() => {
    setCalendarOpen(false);
    navigateTo('home');
    setStatsOpen(true);
  }, [navigateTo]);

  const closeStats = useCallback(() => setStatsOpen(false), []);

  const openCalendar = useCallback(() => {
    setStatsOpen(false);
    setCalendarOpen(true);
  }, []);

  const closeCalendar = useCallback(() => setCalendarOpen(false), []);

  const openImpl = useCallback(
    (id: PaletteAction, args?: StartFocusArgs) => {
      if (args) {
        startFocus(args);
        return;
      }
      if (id === 'stats') {
        openStats();
        return;
      }
      if (id === 'calendar') {
        openCalendar();
        return;
      }
      navigateTo(id as PageId);
    },
    [startFocus, navigateTo, openStats, openCalendar],
  );

  const openPalette = useCallback((taskDate?: Date | null) => {
    setPaletteTaskDate(taskDate ?? null);
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    setPaletteTaskDate(null);
  }, []);

  useEffect(() => {
    if (paletteOpen) {
      setPaletteMounted(true);
      setPaletteClosing(false);
      return;
    }
    if (!paletteMounted) return;
    setPaletteClosing(true);
    const t = window.setTimeout(() => {
      setPaletteMounted(false);
      setPaletteClosing(false);
    }, PALETTE_UNMOUNT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [paletteOpen, paletteMounted]);

  const handlePaletteCreateTask = useCallback(
    async (title: string, date: Date) => {
      const dayKey = toDayKey(date);
      try {
        const existing = await listTasks();
        let created = await createTask({ title });
        const start = resolveScheduleStart(dayKey, existing, date);
        created = await scheduleTask(created.id, start, 30);
        window.dispatchEvent(new CustomEvent(HONE_EVENTS.tasksChanged));
        navigateTo('today');
      } catch {
        /* silent */
      }
    },
    [navigateTo],
  );

  const goHome = useCallback(() => {
    setStatsOpen(false);
    setCalendarOpen(false);
    navigateTo('home');
  }, [navigateTo]);

  useEffect(() => {
    const onAddTask = (e: Event) => {
      const dayKey = (e as CustomEvent<{ dayKey?: string }>).detail?.dayKey;
      const todayKey = toDayKey(new Date());
      const date = dayKey && dayKey !== todayKey ? parseDayKey(dayKey) : new Date();
      openPalette(date);
    };
    window.addEventListener(HONE_EVENTS.openPaletteAddTask, onAddTask);
    return () => window.removeEventListener(HONE_EVENTS.openPaletteAddTask, onAddTask);
  }, [openPalette]);

  useGlobalHotkeys({
    page,
    paletteOpen,
    statsOpen,
    calendarOpen,
    setPaletteOpen: (fn) => {
      const next = fn(paletteOpen);
      if (next) openPalette();
      else closePalette();
    },
    goHome,
    openStats,
    closeStats,
    openCalendar,
    closeCalendar,
    open: (id) => openImpl(id),
  });

  const renderPage = useMemo(
    () =>
      function renderPage(id: PageId) {
        switch (id) {
          case 'home':
            return <HomePage />;
          case 'today':
            return <TaskBoardPage />;
          case 'notes':
            return <NotesPage />;
          case 'whiteboard':
            return <WhiteboardPage theme={theme} />;
          case 'settings':
            return (
              <SettingsPage
                theme={theme}
                onThemeChange={setTheme}
                onPomoChange={(secs) => usePomodoroStore.getState().setDurationSec(secs)}
              />
            );
          default:
            return null;
        }
      },
    [theme],
  );

  if (!ready) {
    return (
      <div
        className="hone-demo-shell hone-demo-shell--loading"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--bg)',
          color: 'var(--ink-40)',
          display: 'grid',
          placeItems: 'center',
          fontSize: 13,
        }}
      />
    );
  }

  return (
    <div className="hone-demo-shell" style={{ position: 'absolute', inset: 0, background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="hone-canvas-shell" data-visible={page === 'home' ? 'true' : 'false'}>
        <CanvasBg mode={page === 'home' ? 'full' : 'void'} theme={theme} />
      </div>

      <div className="hone-chrome-shell" data-visible={page === 'home' ? 'true' : 'false'}>
        <Wordmark />
      </div>

      <PageStack page={page}>{renderPage}</PageStack>

      {page === 'home' && <AnimatedStatsOverlay open={statsOpen} onClose={closeStats} />}
      <AnimatedCalendarOverlay open={calendarOpen} onClose={closeCalendar} />

      <PomodoroController />

      <Dock onMenu={() => openPalette()} />

      {paletteMounted && (
        <Suspense fallback={null}>
          <Palette
            onClose={closePalette}
            onOpen={(id) => {
              closePalette();
              window.setTimeout(() => openImpl(id), 40);
            }}
            taskDate={paletteTaskDate}
            onCreateTask={handlePaletteCreateTask}
            closing={paletteClosing}
          />
        </Suspense>
      )}
    </div>
  );
}

export function HoneDemoApp({ compact = false, siteTheme }: HoneDemoAppProps) {
  return (
    <ErrorBoundary section="Hone demo">
      <DemoEmbedFrame compact={compact}>
        <HoneDemoShell siteTheme={siteTheme} />
      </DemoEmbedFrame>
    </ErrorBoundary>
  );
}
