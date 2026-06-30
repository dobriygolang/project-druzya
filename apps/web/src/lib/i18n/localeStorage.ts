export type Locale = 'en' | 'ru'

export const LOCALE_STORAGE_KEY = 'druzya_locale'

export function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en'
  try {
    const v = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (v === 'en' || v === 'ru') return v
  } catch {
    /* ignore */
  }
  return 'en'
}

export function writeStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}
