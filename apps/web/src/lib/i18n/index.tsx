import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { en } from './locales/en'
import { ru } from './locales/ru'
import { readStoredLocale, writeStoredLocale, type Locale } from './localeStorage'

export type { Locale } from './localeStorage'

const dictionaries = { en, ru } as const

function getByPath(obj: Record<string, unknown>, path: string): string | undefined {
  const val = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as object)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
  return typeof val === 'string' ? val : undefined
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(vars[key] ?? ''))
}

type I18nContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

let localeState: Locale = readStoredLocale()
const localeListeners = new Set<() => void>()

function subscribeLocale(listener: () => void): () => void {
  localeListeners.add(listener)
  return () => localeListeners.delete(listener)
}

function getLocaleSnapshot(): Locale {
  return localeState
}

function setLocaleState(locale: Locale): void {
  if (localeState === locale) return
  localeState = locale
  writeStoredLocale(locale)
  for (const listener of localeListeners) listener()
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, () => 'en' as Locale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[locale] as unknown as Record<string, unknown>
      const fallback = dictionaries.en as unknown as Record<string, unknown>
      const text = getByPath(dict, key) ?? getByPath(fallback, key) ?? key
      return interpolate(text, vars)
    },
    [locale],
  )

  const formatDate = useCallback(
    (date: Date, options?: Intl.DateTimeFormatOptions) =>
      date.toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-US', options),
    [locale],
  )

  const value = useMemo(
    () => ({ locale, setLocale, t, formatDate }),
    [locale, setLocale, t, formatDate],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useLocale(): [Locale, (locale: Locale) => void] {
  const { locale, setLocale } = useI18n()
  return [locale, setLocale]
}

export function liveWsStatusLabel(
  t: I18nContextValue['t'],
  status: string,
  frozen: boolean,
): string {
  if (frozen) return t('live.wsFrozen')
  switch (status) {
    case 'open':
      return t('live.wsLive')
    case 'failed':
      return t('live.wsOffline')
    case 'reconnecting':
      return t('live.wsReconnecting')
    case 'connecting':
      return t('live.wsConnecting')
    default:
      return status.toUpperCase()
  }
}
