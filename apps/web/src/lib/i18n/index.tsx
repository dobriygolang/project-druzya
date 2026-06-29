import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { readStoredLocale, writeStoredLocale, type Locale } from './localeStorage'
import { en } from './locales/en'
import { ru, type Messages } from './locales/ru'

export type { Locale } from './localeStorage'
export { readStoredLocale } from './localeStorage'

const dictionaries: Record<Locale, Messages> = { ru, en }

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

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale())

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next)
    writeStoredLocale(next)
    document.documentElement.lang = next
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = dictionaries[locale] as unknown as Record<string, unknown>
      const text = getByPath(dict, key) ?? getByPath(dictionaries.ru as unknown as Record<string, unknown>, key) ?? key
      return interpolate(text, vars)
    },
    [locale],
  )

  const formatDate = useCallback(
    (date: Date, options?: Intl.DateTimeFormatOptions) =>
      date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', options),
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
