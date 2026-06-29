import { PREFS_KEYS, clampInt } from '../../../stores/prefs';

export interface HoneSettings {
  pomodoroMinutes: number;
  dailyGoalMin: number;
  defaultVolume: number;
  notifications: boolean;
  ambientMusic: boolean;
  // askResistanceBeforeFocus — показывать ли pre-focus прорезонансу journal
  // modal перед стартом сессии. Default: true.
  askResistanceBeforeFocus: boolean;
}

export const SETTINGS_KEY = PREFS_KEYS.SETTINGS_KEY;
export const THEME_KEY = PREFS_KEYS.THEME_KEY;

export const DEFAULTS: HoneSettings = {
  pomodoroMinutes: 25,
  dailyGoalMin: 120,
  defaultVolume: 40,
  notifications: true,
  ambientMusic: true,
  askResistanceBeforeFocus: true,
};

export function readSettings(): HoneSettings {
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
      askResistanceBeforeFocus:
        typeof parsed?.askResistanceBeforeFocus === 'boolean'
          ? parsed.askResistanceBeforeFocus
          : DEFAULTS.askResistanceBeforeFocus,
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
