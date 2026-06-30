import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';

import { CanvasBg, type CanvasMode, type ThemeId } from '@widgets/CanvasBg';
import { Wordmark, HONE_HEADER_H } from '@widgets/Chrome';
import { TrafficLightsHover } from '@widgets/TrafficLightsHover';
import { Dock } from '@widgets/Dock';
import { LoginScreen } from '@widgets/LoginScreen';
import { AnimatedStatsOverlay } from '@widgets/AnimatedStatsOverlay';
import { type PageId, type PaletteAction } from '@widgets/Palette';
import { OfflineBanner } from '@widgets/OfflineBanner';
import { createTask, scheduleTask } from '@features/tasks/api/tasks';
import { parseDayKey, toDayKey } from '@pages/TaskBoard/lib/dates';
import { HomePage } from '@pages/Home';
import { readStoredTheme, readPomodoroSeconds } from '@shared/model/prefs';
import { useSessionStore } from '@shared/model/session';
import { startFocusSession, endFocusSession } from '@features/focus/api/focusClient';
import { notify } from '@shared/api/notifications';
import { PageSkeleton } from '@shared/ui/Skeleton';
import { useGlobalHotkeys } from '@shared/hooks/useGlobalHotkeys';
import { HONE_EVENTS } from '@shared/lib/custom-events';

const TaskBoardPage = lazy(() => import('@pages/TaskBoard').then((m) => ({ default: m.TaskBoardPage })));
const NotesPage = lazy(() => import('@pages/Notes').then((m) => ({ default: m.NotesPage })));
const SettingsPage = lazy(() => import('@pages/Settings').then((m) => ({ default: m.SettingsPage })));
const Palette = lazy(() =>
  import('@widgets/Palette').then((m) => ({ default: m.Palette })),
);

const PageSuspense = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
);

export interface StartFocusArgs {
  planItemId?: string;
  pinnedTitle?: string;
}

const NAV_PAGES = new Set<PageId>(['home', 'today', 'notes', 'settings']);

export default function App() {
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const hydrate = useSessionStore((s) => s.hydrate);
  const clear = useSessionStore((s) => s.clear);

  const PAGE_STORAGE_KEY = 'hone:lastPage:v1';
  const readStoredPage = (): PageId => {
    if (typeof window === 'undefined') return 'home';
    try {
      const v = window.sessionStorage.getItem(PAGE_STORAGE_KEY);
      if (v === 'stats') return 'home';
      if (v && NAV_PAGES.has(v as PageId)) return v as PageId;
    } catch {
      /* sessionStorage may be unavailable */
    }
    return 'home';
  };

  const [page, setPageRaw] = useState<PageId>(() => readStoredPage());
  const [statsOpen, setStatsOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.sessionStorage.getItem(PAGE_STORAGE_KEY) === 'stats';
    } catch {
      return false;
    }
  });

  const setPage = useCallback((next: PageId | ((p: PageId) => PageId)) => {
    const update = () => {
      setPageRaw((current) => {
        const resolved = typeof next === 'function' ? next(current) : next;
        try {
          window.sessionStorage.setItem(PAGE_STORAGE_KEY, resolved);
        } catch {
          /* ignore */
        }
        return resolved;
      });
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === 'function') {
      doc.startViewTransition(update);
    } else {
      update();
    }
  }, []);

  const navigateTo = useCallback(
    (id: PageId) => {
      if (id === page) return;
      setStatsOpen(false);
      setPage(id);
    },
    [page, setPage],
  );

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteTaskDate, setPaletteTaskDate] = useState<Date | null>(null);
  const [theme, setTheme] = useState<ThemeId>(() => readStoredTheme());
  const pomodoroSecsRef = useRef(readPomodoroSeconds());
  const [remain, setRemain] = useState(pomodoroSecsRef.current);
  const [running, setRunning] = useState(false);
  const [vol, setVol] = useState(40);
  const [pinnedTitle, setPinnedTitle] = useState<string | null>(null);
  const [pinnedPlanItemId, setPinnedPlanItemId] = useState<string | null>(null);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    void import('@features/focus/audio/ambient-music').then((m) => m.setAmbientVolume((vol / 100) * 0.5));
  }, [vol]);

  useEffect(() => {
    void import('@features/focus/audio/ambient-music').then((m) => m.bootstrapAmbient());
  }, []);

  useEffect(() => {
    void bootstrap();
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (!bridge) return;

    void bridge.pomodoro.load().then((snap) => {
      if (!snap) return;
      const elapsedMs = Date.now() - snap.savedAt;
      if (snap.running && elapsedMs >= snap.remainSec * 1000) {
        setRemain(0);
        setRunning(false);
        return;
      }
      const adjusted = snap.running
        ? Math.max(0, snap.remainSec - Math.floor(elapsedMs / 1000))
        : snap.remainSec;
      setRemain(adjusted);
      setRunning(false);
    });

    const offAuth = bridge.on('authChanged', (session) => {
      if (session) {
        hydrate({
          userId: session.userId,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
        });
      } else {
        void clear();
      }
    });

    const offDeep = bridge.on('deepLink', ({ url }) => {
      try {
        const u = new URL(url);
        const host = u.host.toLowerCase();
        if (host === 'focus' || host === 'focus.start') {
          startFocus({
            planItemId: u.searchParams.get('task') ?? undefined,
            pinnedTitle: u.searchParams.get('title') ?? undefined,
          });
          return;
        }
        if (host === 'task.open') {
          const taskId = u.searchParams.get('id') ?? u.searchParams.get('task');
          if (taskId) {
            setStatsOpen(false);
            navigateTo('today');
            window.dispatchEvent(new CustomEvent(HONE_EVENTS.openTask, { detail: { taskId } }));
          }
          return;
        }
        if (host === 'note.open') {
          const noteId = u.searchParams.get('id') ?? u.searchParams.get('note');
          if (noteId) {
            setStatsOpen(false);
            navigateTo('notes');
            window.dispatchEvent(new CustomEvent(HONE_EVENTS.openNote, { detail: { noteId } }));
          }
        }
      } catch {
        /* ignore malformed */
      }
    });

    return () => {
      offAuth();
      offDeep();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== 'signed_in') return;
    void import('@shared/api/device').then(({ ensureDevice }) => {
      void ensureDevice({ appVersion: '0.0.1' }).catch(() => {
        /* silent */
      });
    });
  }, [status]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemain((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const lastSavedRef = useRef(0);
  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (!bridge) return;
    const now = Date.now();
    if (now - lastSavedRef.current < 5000 && remain > 0) return;
    lastSavedRef.current = now;
    void bridge.pomodoro.save({ remainSec: remain, running, savedAt: now });
  }, [remain, running]);

  const lastTrayMinuteRef = useRef<number | null>(null);
  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (!bridge) return;
    if (!running) {
      lastTrayMinuteRef.current = null;
      void bridge.tray.update('', 'Hone');
      return;
    }
    const m = Math.floor(Math.max(0, remain) / 60);
    if (lastTrayMinuteRef.current === m) return;
    lastTrayMinuteRef.current = m;
    const title = `${String(m).padStart(2, '0')}:00`;
    const tooltip = pinnedTitle ? `Hone — ${pinnedTitle}` : 'Hone — focus session';
    void bridge.tray.update(title, tooltip);
  }, [remain, running, pinnedTitle]);

  useEffect(() => {
    if (!running || sessionRef.current) return;
    const planItemId = pinnedPlanItemId ?? undefined;
    const pinned = pinnedTitle ?? undefined;
    startFocusSession({ planItemId, pinnedTitle: pinned, mode: 'pomodoro' })
      .then((s) => {
        sessionRef.current = s.id;
      })
      .catch(() => {
        /* silent */
      });
  }, [running, pinnedPlanItemId, pinnedTitle]);

  const finishSession = useCallback(async () => {
    const id = sessionRef.current;
    if (!id) return;
    const secondsFocused = Math.max(0, pomodoroSecsRef.current - remain);
    const pomodorosCompleted = remain === 0 ? 1 : 0;
    sessionRef.current = null;
    try {
      await endFocusSession({
        sessionId: id,
        pomodorosCompleted,
        secondsFocused,
        reflection: '',
      });
    } catch {
      /* silent */
    }
  }, [remain]);

  useEffect(() => {
    if (!running || remain !== 0) return;
    setRunning(false);
    void finishSession();
    void notify('Focus session complete', 'Pomodoro finished — take a break.');
    setRemain(pomodoroSecsRef.current);
  }, [remain, running, finishSession]);

  const resetTimer = useCallback(() => {
    void finishSession();
    setRunning(false);
    setRemain(pomodoroSecsRef.current);
  }, [finishSession]);

  const startFocus = useCallback(
    (args?: StartFocusArgs) => {
      setPinnedPlanItemId(args?.planItemId ?? null);
      setPinnedTitle(args?.pinnedTitle ?? null);
      setRemain(pomodoroSecsRef.current);
      setRunning(true);
      navigateTo('home');
    },
    [navigateTo],
  );

  const openStats = useCallback(() => {
    navigateTo('home');
    setStatsOpen(true);
  }, [navigateTo]);

  const closeStats = useCallback(() => {
    setStatsOpen(false);
  }, []);

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
      navigateTo(id as PageId);
    },
    [startFocus, navigateTo, openStats],
  );

  const openPalette = useCallback((taskDate?: Date | null) => {
    setPaletteTaskDate(taskDate ?? null);
    setPaletteOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    setPaletteTaskDate(null);
  }, []);

  const handlePaletteCreateTask = useCallback(
    async (title: string, date: Date) => {
      const dayKey = toDayKey(date);
      const todayKey = toDayKey(new Date());
      try {
        let created = await createTask({ title });
        if (dayKey !== todayKey) {
          const start = parseDayKey(dayKey);
          start.setHours(9, 0, 0, 0);
          created = await scheduleTask(created.id, start.toISOString(), 30);
        }
        window.dispatchEvent(new CustomEvent(HONE_EVENTS.tasksChanged));
        navigateTo('today');
      } catch {
        /* silent */
      }
    },
    [navigateTo],
  );

  useEffect(() => {
    const onAddTask = (e: Event) => {
      const dayKey = (e as CustomEvent<{ dayKey?: string }>).detail?.dayKey;
      const date = dayKey ? parseDayKey(dayKey) : new Date();
      openPalette(date);
    };
    window.addEventListener(HONE_EVENTS.openPaletteAddTask, onAddTask);
    return () => window.removeEventListener(HONE_EVENTS.openPaletteAddTask, onAddTask);
  }, [openPalette]);

  const goHome = useCallback(() => {
    setStatsOpen(false);
    navigateTo('home');
  }, [navigateTo]);

  useEffect(() => {
    const onNavHome = () => goHome();
    window.addEventListener(HONE_EVENTS.navHome, onNavHome);
    return () => window.removeEventListener(HONE_EVENTS.navHome, onNavHome);
  }, [goHome]);

  useGlobalHotkeys({
    page,
    paletteOpen,
    statsOpen,
    setPaletteOpen: (fn) => {
      const next = fn(paletteOpen);
      if (next) openPalette();
      else closePalette();
    },
    goHome,
    openStats,
    closeStats,
    open: (id) => openImpl(id),
  });

  const canvasMode: CanvasMode = page === 'home' && !statsOpen ? 'full' : 'void';

  if (status === 'unknown') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', color: 'var(--ink-40)', display: 'grid', placeItems: 'center', fontSize: 13 }}>
        Hone…
      </div>
    );
  }

  if (status === 'guest') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg)', overflow: 'hidden' }}>
        <CanvasBg mode="full" theme={theme} />
        <LoginScreen />
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      {page === 'home' && <CanvasBg mode={canvasMode} theme={theme} />}

      <div
        data-tauri-drag-region
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: HONE_HEADER_H,
          zIndex: 8,
          // @ts-expect-error — Tauri/Electron drag region
          WebkitAppRegion: 'drag',
        }}
      />

      <TrafficLightsHover />
      {page === 'home' && <Wordmark />}

      {page === 'home' && (
        <div key="home" className="hone-page-layer motion-page-in">
          <HomePage />
        </div>
      )}
      <PageSuspense>
        {page === 'today' && (
          <div key="today" className="hone-page-layer motion-page-in">
            <TaskBoardPage />
          </div>
        )}
        {page === 'notes' && (
          <div key="notes" className="hone-page-layer motion-page-in">
            <NotesPage />
          </div>
        )}
      </PageSuspense>
      <PageSuspense>
        {page === 'settings' && (
          <div key="settings" className="hone-page-layer motion-page-in">
            <SettingsPage
              theme={theme}
              onThemeChange={setTheme}
              onPomoChange={(secs) => {
                pomodoroSecsRef.current = secs;
                if (!running) setRemain(secs);
              }}
            />
          </div>
        )}
      </PageSuspense>

      {page === 'home' && <AnimatedStatsOverlay open={statsOpen} onClose={closeStats} />}

      <Dock
        onMenu={() => openPalette()}
        running={running}
        onToggle={() => setRunning((r) => !r)}
        remain={remain}
        onReset={resetTimer}
        vol={vol}
        onVol={setVol}
      />

      {paletteOpen && (
        <Suspense fallback={null}>
          <Palette
            onClose={closePalette}
            onOpen={(id) => {
              closePalette();
              window.setTimeout(() => openImpl(id), 40);
            }}
            taskDate={paletteTaskDate}
            onCreateTask={handlePaletteCreateTask}
          />
        </Suspense>
      )}
      <OfflineBanner />
    </div>
  );
}
