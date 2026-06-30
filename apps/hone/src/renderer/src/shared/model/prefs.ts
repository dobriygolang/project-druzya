import { STORAGE_KEYS } from '@shared/lib/storage-keys';
import { THEME_IDS, type ThemeId } from '@widgets/CanvasBg';

const SETTINGS_KEY: string = STORAGE_KEYS.settings;
const THEME_KEY: string = STORAGE_KEYS.theme;

interface HoneSettings {
  pomodoroMinutes: number;
  notifications: boolean;
  dailyGoalMin: number;
}

const DEFAULTS: HoneSettings = {
  pomodoroMinutes: 25,
  notifications: true,
  dailyGoalMin: 120,
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
      notifications: typeof parsed?.notifications === 'boolean' ? parsed.notifications : DEFAULTS.notifications,
      dailyGoalMin: clampInt(parsed?.dailyGoalMin, 15, 720, DEFAULTS.dailyGoalMin),
    };
  } catch {
    return DEFAULTS;
  }
}

export function readPomodoroSeconds(): number {
  return readSettings().pomodoroMinutes * 60;
}

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

export const PREFS_KEYS = { SETTINGS_KEY, THEME_KEY } as const;
