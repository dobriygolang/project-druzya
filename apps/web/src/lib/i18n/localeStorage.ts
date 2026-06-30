export type Locale = 'en'

export const LOCALE_STORAGE_KEY = 'druzya_locale'

export function readStoredLocale(): Locale {
  return 'en'
}

export function writeStoredLocale(_locale: Locale): void {
  /* English-only site */
}
