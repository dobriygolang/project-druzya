import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import { en } from './locales/en'

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
  locale: 'en'
  t: (key: string, vars?: Record<string, string | number>) => string
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = 'en'
  }, [])

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const dict = en as unknown as Record<string, unknown>
    const text = getByPath(dict, key) ?? key
    return interpolate(text, vars)
  }, [])

  const formatDate = useCallback(
    (date: Date, options?: Intl.DateTimeFormatOptions) => date.toLocaleDateString('en-US', options),
    [],
  )

  const value = useMemo(() => ({ locale: 'en' as const, t, formatDate }), [t, formatDate])

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
