import { PREFS_KEYS, clampInt } from '@shared/model/prefs';

export interface HoneSettings {
  pomodoroMinutes: number;
  notifications: boolean;
}

export const SETTINGS_KEY = PREFS_KEYS.SETTINGS_KEY;
export const THEME_KEY = PREFS_KEYS.THEME_KEY;

export const DEFAULTS: HoneSettings = {
  pomodoroMinutes: 25,
  notifications: true,
};

export function readSettings(): HoneSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      pomodoroMinutes: clampInt(parsed?.pomodoroMinutes, 5, 90, DEFAULTS.pomodoroMinutes),
      notifications: typeof parsed?.notifications === 'boolean' ? parsed.notifications : DEFAULTS.notifications,
    };
  } catch {
    return DEFAULTS;
  }
}

export { clampInt };

export function labelFor(id: string): string {
  switch (id) {
    case 'winter':
      return 'Winter';
    case 'aurora':
      return 'Aurora';
    case 'grid-rain':
      return 'Grid rain';
    case 'particles':
      return 'Particles';
    case 'abyss':
      return 'Abyss';
    case 'cosmic':
      return 'Cosmic';
    default:
      return id;
  }
}
