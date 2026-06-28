import { useMemo } from 'react'
import type { SessionMode } from '@/lib/types'
import { formatApiError } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'
import { sessionModeLabel as resolveSessionModeLabel } from '@/lib/labels/domainLabels'

type TFn = (key: string, vars?: Record<string, string | number>) => string

export function sessionModeLabelWith(t: TFn, mode?: SessionMode | string): string {
  return resolveSessionModeLabel(t, mode)
}

export function isActiveSessionConflict(message: string): boolean {
  return /active session already exists/i.test(message)
}

export function formatInterviewErrorWith(
  t: TFn,
  err: unknown,
  fallback?: string,
): string {
  const fb = fallback ?? t('interview.requestFailed')
  const raw = err instanceof Error || typeof err === 'object' ? formatApiError(err) : String(err ?? fb)
  if (isActiveSessionConflict(raw)) {
    return t('interview.activeConflict')
  }
  return raw || fb
}

export function useInterviewLabels() {
  const { t } = useI18n()
  return useMemo(
    () => ({
      sessionModeLabel: (mode?: SessionMode | string) => sessionModeLabelWith(t, mode),
      formatInterviewError: (err: unknown, fallback?: string) =>
        formatInterviewErrorWith(t, err, fallback),
    }),
    [t],
  )
}

/** @deprecated use useInterviewLabels */
export function sessionModeLabel(mode?: SessionMode | string): string {
  if (!mode) return 'Interview session'
  return String(mode).replace(/^SESSION_MODE_/, '').replace(/_/g, ' ').toLowerCase()
}

/** @deprecated use useInterviewLabels */
export function formatInterviewError(err: unknown, fallback = 'Не удалось выполнить запрос'): string {
  const raw = err instanceof Error || typeof err === 'object' ? formatApiError(err) : String(err ?? fallback)
  if (isActiveSessionConflict(raw)) {
    return 'У вас уже есть активная сессия — продолжите её или завершите ниже.'
  }
  return raw || fallback
}
