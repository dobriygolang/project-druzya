const SETTINGS_KEY = 'hone:settings:v1';
const FOCUS_MODE_KEY = 'hone:focusMode';

export const FOCUS_MODES = ['pomodoro', 'stopwatch'] as const;
export type FocusMode = (typeof FOCUS_MODES)[number];

interface HoneSettings {
  pomodoroMinutes: number;
}

const DEFAULTS: HoneSettings = {
  pomodoroMinutes: 25,
};

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function readSettings(): HoneSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<HoneSettings>;
    return {
      pomodoroMinutes: clampInt(parsed?.pomodoroMinutes, 5, 90, DEFAULTS.pomodoroMinutes),
    };
  } catch {
    return DEFAULTS;
  }
}

export function readPomodoroSeconds(): number {
  return readSettings().pomodoroMinutes * 60;
}

export function readFocusMode(): FocusMode {
  if (typeof window === 'undefined') return 'pomodoro';
  try {
    const v = window.localStorage.getItem(FOCUS_MODE_KEY);
    if (v && (FOCUS_MODES as readonly string[]).includes(v)) return v as FocusMode;
  } catch {
    /* ignore */
  }
  return 'pomodoro';
}

export function writeFocusMode(mode: FocusMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FOCUS_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export { SETTINGS_KEY };
