import { useCallback, useEffect, useRef, useState } from 'react';

import { endFocusSession, startFocusSession } from '../api/focusClient';
import { readFocusModeName } from '../lib/focus-settings';
import {
  FOCUS_MODES,
  readFocusMode,
  readPomodoroSeconds,
  writeFocusMode,
  type FocusMode,
} from '../stores/prefs';

export interface StartFocusArgs {
  planItemId?: string;
  pinnedTitle?: string;
}

export interface ReflectionPrompt {
  sessionId: string;
  secondsFocused: number;
  pomodorosCompleted: number;
}

function initialRemain(mode: FocusMode, pomodoroSecs: number): number {
  return mode === 'pomodoro' ? pomodoroSecs : 0;
}

function triggerMacFocus(start: boolean): void {
  const name = readFocusModeName();
  if (!name) return;
  const bridge = window.hone;
  if (!bridge) return;
  void (start ? bridge.focusMode.start(name) : bridge.focusMode.stop(name));
}

export function useFocusSession() {
  const pomodoroSecsRef = useRef(readPomodoroSeconds());
  const [remain, setRemain] = useState(() => initialRemain(readFocusMode(), pomodoroSecsRef.current));
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<FocusMode>(() => readFocusMode());
  const [pinnedTitle, setPinnedTitle] = useState<string | null>(null);
  const [pinnedPlanItemId, setPinnedPlanItemId] = useState<string | null>(null);
  const [reflectionPrompt, setReflectionPrompt] = useState<ReflectionPrompt | null>(null);

  const sessionRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<Date | null>(null);
  const lastSavedRef = useRef(0);
  const lastTrayMinuteRef = useRef<number | null>(null);

  useEffect(() => {
    const bridge = window.hone;
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
  }, []);

  const finishSession = useCallback(async () => {
    const id = sessionRef.current;
    if (!id) return;

    const pomodoroSecs = pomodoroSecsRef.current;
    const secondsFocused =
      mode === 'pomodoro'
        ? Math.max(0, pomodoroSecs - remain)
        : Math.max(0, remain);
    const pomodorosCompleted = mode === 'pomodoro' && remain === 0 ? 1 : 0;

    sessionRef.current = null;
    triggerMacFocus(false);

    try {
      await endFocusSession({
        sessionId: id,
        pomodorosCompleted,
        secondsFocused,
      });
    } catch {
      /* timer UX must not block on network */
    }
  }, [mode, remain]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemain((r) => {
        if (mode === 'pomodoro') return Math.max(0, r - 1);
        return r + 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, mode]);

  useEffect(() => {
    const bridge = window.hone;
    if (!bridge) return;
    const now = Date.now();
    if (now - lastSavedRef.current < 5000 && remain > 0) return;
    lastSavedRef.current = now;
    void bridge.pomodoro.save({ remainSec: remain, running, savedAt: now });
  }, [remain, running]);

  useEffect(() => {
    const bridge = window.hone;
    if (!bridge) return;
    if (!running) {
      lastTrayMinuteRef.current = null;
      void bridge.tray.update('', 'Hone');
      return;
    }
    const totalSec = Math.max(0, remain);
    const m = Math.floor(totalSec / 60);
    if (lastTrayMinuteRef.current === m) return;
    lastTrayMinuteRef.current = m;
    const title = `${String(m).padStart(2, '0')}:00`;
    const tooltip = pinnedTitle ? `Hone — ${pinnedTitle}` : 'Hone — focus session';
    void bridge.tray.update(title, tooltip);
  }, [remain, running, pinnedTitle]);

  useEffect(() => {
    if (!running || sessionRef.current) return;
    sessionStartedAtRef.current = new Date();
    triggerMacFocus(true);
    void startFocusSession({
      planItemId: pinnedPlanItemId ?? undefined,
      pinnedTitle: pinnedTitle ?? undefined,
      mode: mode === 'stopwatch' ? 'stopwatch' : 'pomodoro',
    })
      .then((s) => {
        sessionRef.current = s.id;
      })
      .catch(() => {
        /* silent */
      });
  }, [running, pinnedPlanItemId, pinnedTitle, mode]);

  useEffect(() => {
    if (mode !== 'pomodoro') return;
    if (!running || remain > 0) return;

    setRunning(false);
    const id = sessionRef.current;
    const seconds = pomodoroSecsRef.current;
    void finishSession();

    if (id) {
      setReflectionPrompt({
        sessionId: id,
        secondsFocused: seconds,
        pomodorosCompleted: 1,
      });
    }
    sessionStartedAtRef.current = null;
    setRemain(pomodoroSecsRef.current);
  }, [remain, running, mode, finishSession]);

  const start = useCallback((args?: StartFocusArgs) => {
    setPinnedPlanItemId(args?.planItemId ?? null);
    setPinnedTitle(args?.pinnedTitle ?? null);
    setReflectionPrompt(null);
    setRemain(initialRemain(mode, pomodoroSecsRef.current));
    setRunning(true);
  }, [mode]);

  const stop = useCallback(() => {
    if (!running && !sessionRef.current) return;
    setRunning(false);
    void finishSession();
    setRemain(initialRemain(mode, pomodoroSecsRef.current));
  }, [running, finishSession, mode]);

  const toggle = useCallback(() => {
    if (running) {
      stop();
      return;
    }
    start();
  }, [running, start, stop]);

  const reset = useCallback(() => {
    void finishSession();
    setRunning(false);
    setRemain(initialRemain(mode, pomodoroSecsRef.current));
  }, [finishSession, mode]);

  const toggleMode = useCallback(() => {
    void finishSession();
    setRunning(false);
    setMode((m) => {
      const idx = FOCUS_MODES.indexOf(m);
      const next = FOCUS_MODES[(idx + 1) % FOCUS_MODES.length];
      setRemain(initialRemain(next, pomodoroSecsRef.current));
      writeFocusMode(next);
      return next;
    });
  }, [finishSession]);

  const dismissReflection = useCallback(() => {
    setReflectionPrompt(null);
  }, []);

  const submitReflection = useCallback(async (_text: string, _grade: number) => {
    setReflectionPrompt(null);
  }, []);

  const refreshPomodoroDuration = useCallback(() => {
    pomodoroSecsRef.current = readPomodoroSeconds();
    if (!running && mode === 'pomodoro') {
      setRemain(pomodoroSecsRef.current);
    }
  }, [running, mode]);

  return {
    remain,
    running,
    mode,
    pinnedTitle,
    reflectionPrompt,
    start,
    stop,
    toggle,
    reset,
    toggleMode,
    dismissReflection,
    submitReflection,
    refreshPomodoroDuration,
  };
}
