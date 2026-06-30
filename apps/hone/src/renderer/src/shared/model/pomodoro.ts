import { create } from 'zustand';

import { readPomodoroSeconds } from '@shared/model/prefs';

export type FocusTimerMode = 'pomodoro' | 'stopwatch';

const FOCUS_TIMER_MODES: FocusTimerMode[] = ['pomodoro', 'stopwatch'];

export interface PomodoroStartArgs {
  planItemId?: string;
  pinnedTitle?: string;
}

interface PomodoroState {
  mode: FocusTimerMode;
  remain: number;
  elapsed: number;
  running: boolean;
  durationSec: number;
  pinnedTitle: string | null;
  pinnedPlanItemId: string | null;
  resetToken: number;
  setMode: (mode: FocusTimerMode) => void;
  cycleMode: () => void;
  setDurationSec: (sec: number) => void;
  hydrate: (valueSec: number, running: boolean, mode?: FocusTimerMode) => void;
  toggle: () => void;
  reset: () => void;
  start: (args?: PomodoroStartArgs) => void;
  tick: () => void;
  complete: () => void;
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  mode: 'pomodoro',
  remain: readPomodoroSeconds(),
  elapsed: 0,
  running: false,
  durationSec: readPomodoroSeconds(),
  pinnedTitle: null,
  pinnedPlanItemId: null,
  resetToken: 0,

  setMode: (mode) => {
    if (get().mode === mode) return;
    set((s) => ({
      mode,
      running: false,
      remain: s.durationSec,
      elapsed: 0,
      resetToken: s.resetToken + 1,
    }));
  },

  cycleMode: () => {
    const { mode } = get();
    const idx = FOCUS_TIMER_MODES.indexOf(mode);
    const next = FOCUS_TIMER_MODES[(idx + 1) % FOCUS_TIMER_MODES.length] ?? 'pomodoro';
    get().setMode(next);
  },

  setDurationSec: (sec) => {
    const clamped = Math.max(60, sec);
    set({ durationSec: clamped });
    if (!get().running && get().mode === 'pomodoro') set({ remain: clamped });
  },

  hydrate: (valueSec, running, mode) => {
    const nextMode = mode ?? get().mode;
    if (nextMode === 'stopwatch') {
      set({ mode: nextMode, elapsed: Math.max(0, valueSec), running });
      return;
    }
    set({
      mode: nextMode,
      remain: Math.max(0, valueSec),
      running: running && valueSec > 0,
    });
  },

  toggle: () => {
    set((s) => ({ running: !s.running }));
  },

  reset: () => {
    set((s) => ({
      running: false,
      remain: s.durationSec,
      elapsed: 0,
      resetToken: s.resetToken + 1,
    }));
  },

  start: (args) => {
    const mode = get().mode;
    set({
      running: true,
      remain: mode === 'pomodoro' ? get().durationSec : get().remain,
      elapsed: mode === 'stopwatch' ? 0 : get().elapsed,
      pinnedPlanItemId: args?.planItemId ?? null,
      pinnedTitle: args?.pinnedTitle ?? null,
    });
  },

  tick: () => {
    const { running, mode, remain, elapsed } = get();
    if (!running) return;
    if (mode === 'pomodoro') {
      if (remain <= 0) return;
      set({ remain: remain - 1 });
      return;
    }
    set({ elapsed: elapsed + 1 });
  },

  complete: () => {
    set({ running: false, remain: get().durationSec, elapsed: 0 });
  },
}));
