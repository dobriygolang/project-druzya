export type Locale = 'ru' | 'en'

export const LOCALE_STORAGE_KEY = 'druzya_locale'

export function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (raw === 'en' || raw === 'ru') return raw
  } catch {
    /* noop */
  }
  return 'ru'
}

export function writeStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* noop */
  }
}
