import { useCallback, useEffect, useState } from 'react';

import { Dock, type PageId } from './components/Dock';
import { FocusDock } from './components/FocusDock';
import { LoginScreen } from './components/LoginScreen';
import { useFocusSession } from './hooks/useFocusSession';
import { HomePage } from './pages/Home';
import { NotesPage } from './pages/Notes';
import { SettingsPage } from './pages/Settings';
import { StatsPage } from './pages/Stats';
import { TaskBoardPage } from './pages/TaskBoard';
import { useSessionStore } from './stores/session';

const VALID_PAGES = new Set<PageId>([
  'home', 'today', 'notes', 'stats', 'schedule', 'settings',
]);

function readStoredPage(): PageId {
  try {
    const v = window.sessionStorage.getItem('hone:lastPage:v1');
    if (v && VALID_PAGES.has(v as PageId)) return v as PageId;
  } catch {
    /* ignore */
  }
  return 'home';
}

function parseDeepLinkRoute(url: string): PageId | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'task' || u.hostname === 'task.open') return 'today';
    if (u.hostname === 'note' || u.hostname === 'note.open') return 'notes';
    if (u.hostname === 'focus' || u.hostname === 'focus.start') return 'home';
  } catch {
    /* ignore */
  }
  return null;
}

export default function App() {
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);
  const hydrate = useSessionStore((s) => s.hydrate);

  const [page, setPage] = useState<PageId>(() => readStoredPage());
  const [pendingNoteId, setPendingNoteId] = useState<string | null>(null);
  const focus = useFocusSession();

  const setPagePersist = useCallback((next: PageId) => {
    setPage(next);
    try {
      window.sessionStorage.setItem('hone:lastPage:v1', next);
    } catch {
      /* ignore */
    }
  }, []);

  const focusStart = focus.start;

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const bridge = window.hone;
    if (!bridge) return;

    const offDeepLink = bridge.on('deepLink', ({ url }) => {
      try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();

        if (host === 'focus' || host === 'focus.start') {
          focusStart({
            planItemId: u.searchParams.get('task') ?? undefined,
            pinnedTitle: u.searchParams.get('title') ?? undefined,
          });
          setPagePersist('home');
          return;
        }

        if (host === 'task.open') {
          const taskId = u.searchParams.get('id') ?? u.searchParams.get('task');
          if (taskId) {
            setPagePersist('today');
          }
          return;
        }

        if (host === 'note.open') {
          const noteId = u.searchParams.get('id') ?? u.searchParams.get('note');
          if (noteId) {
            setPendingNoteId(noteId);
            setPagePersist('notes');
          }
          return;
        }
      } catch {
        /* ignore */
      }

      const route = parseDeepLinkRoute(url);
      if (route) setPagePersist(route);

      if (url.includes('auth') || url.includes('token=')) {
        try {
          const u = new URL(url);
          const token = u.searchParams.get('token') ?? u.searchParams.get('access_token');
          const userId = u.searchParams.get('user_id') ?? u.searchParams.get('userId');
          if (token && userId) {
            void bridge.auth.persist({
              userId,
              accessToken: token,
              refreshToken: u.searchParams.get('refresh_token') ?? '',
              expiresAt: Number(u.searchParams.get('expires_at') ?? 0),
            });
            hydrate({
              userId,
              accessToken: token,
              refreshToken: u.searchParams.get('refresh_token') ?? undefined,
              expiresAt: Number(u.searchParams.get('expires_at') ?? 0) || undefined,
            });
          }
        } catch {
          /* ignore malformed deep links */
        }
      }
    });

    const offAuth = bridge.on('authChanged', (session) => {
      if (session?.accessToken) {
        hydrate({
          userId: session.userId,
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
        });
      } else {
        void useSessionStore.getState().clear();
      }
    });

    return () => {
      offDeepLink();
      offAuth();
    };
  }, [focusStart, hydrate, setPagePersist]);

  if (status === 'unknown') {
    return <div className="app-shell loading">Loading…</div>;
  }

  if (status === 'guest') {
    return (
      <div className="app-shell">
        <LoginScreen />
      </div>
    );
  }

  let content;
  switch (page) {
    case 'home':
      content = (
        <HomePage
          running={focus.running}
          remain={focus.remain}
          pinnedTitle={focus.pinnedTitle}
          reflectionPrompt={focus.reflectionPrompt}
          onStop={focus.stop}
          onSubmitReflection={focus.submitReflection}
          onDismissReflection={focus.dismissReflection}
        />
      );
      break;
    case 'today':
      content = <TaskBoardPage />;
      break;
    case 'notes':
      content = (
        <NotesPage
          initialNoteId={pendingNoteId}
          onConsumeInitial={() => setPendingNoteId(null)}
        />
      );
      break;
    case 'schedule':
      content = <TaskBoardPage />;
      break;
    case 'stats':
      content = <StatsPage />;
      break;
    case 'settings':
      content = <SettingsPage onSettingsChange={focus.refreshPomodoroDuration} />;
      break;
  }

  const mainClass =
    page === 'today' || page === 'notes' || page === 'schedule' || page === 'stats'
      ? 'app-main app-main--board'
      : 'app-main app-main--focus';

  return (
    <div className="app-shell app-shell--signed-in">
      <main className={mainClass}>{content}</main>
      <FocusDock
        running={focus.running}
        remain={focus.remain}
        mode={focus.mode}
        onToggle={focus.toggle}
        onReset={focus.reset}
        onToggleMode={focus.toggleMode}
      />
      <Dock page={page} onNavigate={setPagePersist} />
    </div>
  );
}
