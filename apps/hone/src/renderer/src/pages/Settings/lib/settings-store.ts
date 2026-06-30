import { PREFS_KEYS, clampInt } from '@shared/model/prefs';

export type TextScale = 'normal' | 'large' | 'xlarge';

export interface HoneSettings {
  pomodoroMinutes: number;
  notifications: boolean;
  textScale: TextScale;
}

export const SETTINGS_KEY = PREFS_KEYS.SETTINGS_KEY;
export const THEME_KEY = PREFS_KEYS.THEME_KEY;

export const TEXT_SCALES: TextScale[] = ['normal', 'large', 'xlarge'];

export const DEFAULTS: HoneSettings = {
  pomodoroMinutes: 25,
  notifications: true,
  textScale: 'normal',
};

function parseTextScale(v: unknown): TextScale {
  if (v === 'large' || v === 'xlarge') return v;
  return 'normal';
}

export function readSettings(): HoneSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      pomodoroMinutes: clampInt(parsed?.pomodoroMinutes, 5, 90, DEFAULTS.pomodoroMinutes),
      notifications: typeof parsed?.notifications === 'boolean' ? parsed.notifications : DEFAULTS.notifications,
      textScale: parseTextScale(parsed?.textScale),
    };
  } catch {
    return DEFAULTS;
  }
}

export { clampInt };

export function themeLabelKey(id: string): string {
  switch (id) {
    case 'drift':
      return 'hone.theme.drift';
    case 'visor':
      return 'hone.theme.visor';
    case 'winter':
      return 'hone.theme.winter';
    case 'birthday':
      return 'hone.theme.birthday';
    case 'birthday-light':
      return 'hone.theme.birthday-light';
    case 'particles':
      return 'hone.theme.particles';
    case 'debris':
      return 'hone.theme.debris';
    case 'launch':
      return 'hone.theme.launch';
    default:
      return 'hone.theme.winter';
  }
}
