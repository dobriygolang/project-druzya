import { useCallback, useEffect, useRef } from 'react';

import { translate } from '@d9-i18n';

import { endFocusSession, startFocusSession } from '@features/focus/api/focusClient';
import { notify } from '@shared/api/notifications';
import { usePomodoroStore, type FocusTimerMode } from '@shared/model/pomodoro';

function timerValueSec(mode: FocusTimerMode, remain: number, elapsed: number): number {
  return mode === 'pomodoro' ? remain : elapsed;
}

function formatTrayTime(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.max(0, sec) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Side effects for the dock timer — keeps App shell off the 1 Hz render path. */
export function PomodoroController(): null {
  const sessionRef = useRef<string | null>(null);
  const lastSavedRef = useRef(0);
  const lastTraySecondRef = useRef<number | null>(null);

  const finishSession = useCallback(async () => {
    const id = sessionRef.current;
    if (!id) return;
    const { remain, durationSec, mode, elapsed } = usePomodoroStore.getState();
    const secondsFocused =
      mode === 'pomodoro' ? Math.max(0, durationSec - remain) : Math.max(0, elapsed);
    const pomodorosCompleted = mode === 'pomodoro' && remain === 0 ? 1 : 0;
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
  }, []);

  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (!bridge) return;
    void bridge.pomodoro.load().then((snap) => {
      if (!snap) return;
      const mode: FocusTimerMode = snap.mode === 'stopwatch' ? 'stopwatch' : 'pomodoro';
      const elapsedMs = Date.now() - snap.savedAt;
      if (mode === 'pomodoro') {
        if (snap.running && elapsedMs >= snap.remainSec * 1000) {
          usePomodoroStore.getState().hydrate(0, false, mode);
          return;
        }
        const adjusted = snap.running
          ? Math.max(0, snap.remainSec - Math.floor(elapsedMs / 1000))
          : snap.remainSec;
        usePomodoroStore.getState().hydrate(adjusted, snap.running, mode);
        return;
      }
      const adjusted = snap.running
        ? Math.max(0, snap.remainSec + Math.floor(elapsedMs / 1000))
        : snap.remainSec;
      usePomodoroStore.getState().hydrate(adjusted, snap.running, mode);
    });
  }, []);

  useEffect(() => {
    let id: number | undefined;
    const syncInterval = () => {
      if (id !== undefined) window.clearInterval(id);
      id = undefined;
      if (usePomodoroStore.getState().running) {
        id = window.setInterval(() => usePomodoroStore.getState().tick(), 1000);
      }
    };
    syncInterval();
    const unsub = usePomodoroStore.subscribe((state, prev) => {
      if (state.running !== prev.running) syncInterval();
    });
    return () => {
      unsub();
      if (id !== undefined) window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    return usePomodoroStore.subscribe((state, prev) => {
      if (
        state.remain === prev.remain &&
        state.elapsed === prev.elapsed &&
        state.running === prev.running &&
        state.mode === prev.mode
      ) {
        return;
      }

      const bridge = typeof window !== 'undefined' ? window.hone : undefined;
      if (!bridge) return;

      const now = Date.now();
      const value = timerValueSec(state.mode, state.remain, state.elapsed);
      if (
        now - lastSavedRef.current >= 5000 ||
        value === 0 ||
        state.running !== prev.running ||
        state.mode !== prev.mode
      ) {
        lastSavedRef.current = now;
        void bridge.pomodoro.save({
          remainSec: value,
          running: state.running,
          savedAt: now,
          mode: state.mode,
        });
      }

      if (!state.running) {
        lastTraySecondRef.current = null;
        void bridge.tray.update('', 'Hone');
        return;
      }
      if (lastTraySecondRef.current === value) return;
      lastTraySecondRef.current = value;
      const title = formatTrayTime(value);
      const tooltip = state.pinnedTitle ? `Hone — ${state.pinnedTitle}` : translate('hone.app.tray_focus');
      void bridge.tray.update(title, tooltip);
    });
  }, []);

  useEffect(() => {
    return usePomodoroStore.subscribe((state, prev) => {
      if (state.running && !prev.running && !sessionRef.current) {
        startFocusSession({
          planItemId: state.pinnedPlanItemId ?? undefined,
          pinnedTitle: state.pinnedTitle ?? undefined,
          mode: state.mode,
        })
          .then((s) => {
            sessionRef.current = s.id;
          })
          .catch(() => {
            /* silent */
          });
      }
    });
  }, []);

  useEffect(() => {
    return usePomodoroStore.subscribe((state, prev) => {
      if (state.mode !== 'pomodoro') return;
      if (!state.running || state.remain !== 0 || prev.remain === 0) return;
      void finishSession();
      void notify(translate('hone.notify.session_title'), translate('hone.notify.session_body'));
      usePomodoroStore.getState().complete();
    });
  }, [finishSession]);

  useEffect(() => {
    return usePomodoroStore.subscribe((state, prev) => {
      if (state.resetToken !== prev.resetToken) void finishSession();
    });
  }, [finishSession]);

  useEffect(() => {
    return usePomodoroStore.subscribe((state, prev) => {
      if (state.mode === prev.mode) return;
      void finishSession();
    });
  }, [finishSession]);

  return null;
}
