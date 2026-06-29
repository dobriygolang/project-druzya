// prefs — synchronous localStorage readers used at boot before the
// (lazy) Settings page module loads. Extracted so App.tsx can hydrate
// theme/pomodoro/dailyGoal without pulling in the whole 1400-line
// Settings page (vault, devices, resource library) on first paint.
//
// The Settings page itself re-uses the same SETTINGS_KEY / THEME_KEY
// strings, so writes from there are visible to these readers without
// any sync wiring.
import { STORAGE_KEYS } from '../lib/storage-keys';
import { THEME_IDS, type ThemeId } from '../components/CanvasBg';

const SETTINGS_KEY: string = STORAGE_KEYS.settings;
const THEME_KEY: string = STORAGE_KEYS.theme;
const FOCUS_MODE_KEY = 'hone:focusMode';

/**
 * FocusMode — 6 timer modes. Mirrors backend hone_focus_mode_valid CHECK
 * (migration 00067):
 *  pomodoro  — 25-min cycles, post-finish reflection
 *  stopwatch — count up без cap
 *  free      — no timer, just session tracking (manual stop)
 *  plan      — multi-block sequence (50 min focus + 10 break × 3 для MVP)
 *  pinned    — pinned task → focus tied to task; ends when task marked done
 *  countdown — fixed minutes (configured pomodoroMinutes)
 */
export const FOCUS_MODES = [
  'pomodoro',
  'stopwatch',
  'free',
  'plan',
  'pinned',
  'countdown',
] as const;
export type FocusMode = (typeof FOCUS_MODES)[number];

interface HoneSettings {
  pomodoroMinutes: number;
  dailyGoalMin: number;
  defaultVolume: number;
  notifications: boolean;
  ambientMusic: boolean;
}

const DEFAULTS: HoneSettings = {
  pomodoroMinutes: 25,
  dailyGoalMin: 120,
  defaultVolume: 40,
  notifications: true,
  ambientMusic: true,
};

export function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function readSettings(): HoneSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      pomodoroMinutes: clampInt(parsed?.pomodoroMinutes, 5, 90, DEFAULTS.pomodoroMinutes),
      dailyGoalMin: clampInt(parsed?.dailyGoalMin, 15, 480, DEFAULTS.dailyGoalMin),
      defaultVolume: clampInt(parsed?.defaultVolume, 0, 100, DEFAULTS.defaultVolume),
      notifications: typeof parsed?.notifications === 'boolean' ? parsed.notifications : DEFAULTS.notifications,
      ambientMusic: typeof parsed?.ambientMusic === 'boolean' ? parsed.ambientMusic : DEFAULTS.ambientMusic,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Read the stored pomodoro duration in seconds (clamped 5–90 min). */
export function readPomodoroSeconds(): number {
  return readSettings().pomodoroMinutes * 60;
}

/** Read the stored daily focus goal in minutes (default 120). */
export function readDailyGoalMin(): number {
  return readSettings().dailyGoalMin;
}

export function readStoredTheme(): ThemeId {
  if (typeof window === 'undefined') return 'winter';
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v && (THEME_IDS as readonly string[]).includes(v)) return v as ThemeId;
  } catch {
    /* ignore */
  }
  return 'winter';
}

/** Read the persisted focus mode. Falls back to 'pomodoro' (= legacy
 *  'countdown' default). */
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

export const PREFS_KEYS = { SETTINGS_KEY, THEME_KEY, FOCUS_MODE_KEY } as const;
