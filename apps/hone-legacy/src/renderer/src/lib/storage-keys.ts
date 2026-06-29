// Centralized localStorage keys для Hone desktop.
//
// Используется для keys, читаемых/записываемых в 3+ местах — чтобы typo
// в одной из ссылок не привела к беззвучному state-mismatch'у.
//
// Single-use keys остаются inline в своих модулях — централизация даёт
// только overhead без пользы.

export const STORAGE_KEYS = {
  /** Device id для X-Device-ID header (см api/device.ts). */
  deviceId: 'hone:device-id',
  /** Onboarding completion gate. App.tsx читает на mount; Settings даёт reset. */
  onboardedV2: 'hone:onboarded:v2',
  /** Settings JSON blob (pomodoro / dailyGoal / volume / notifications). */
  settings: 'hone:settings',
  /** Theme id ('winter' | 'spring' | ...). */
  theme: 'hone:theme',
  /** Profile JSON ({ stack, mode, savedAt }). */
  profileV2: 'hone:profile:v2',
} as const;

