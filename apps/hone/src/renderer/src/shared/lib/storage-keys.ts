// Centralized localStorage keys for Hone desktop.

export const STORAGE_KEYS = {
  /** Device id for X-Device-ID header (see api/device.ts). */
  deviceId: 'hone:device-id',
  /** Settings JSON blob (pomodoro / dailyGoal / volume / notifications). */
  settings: 'hone:settings',
  /** Theme id ('winter' | 'aurora' | ...). */
  theme: 'hone:theme',
  /** UI locale ('en' | 'ru'). */
  locale: 'hone:locale',
} as const;
