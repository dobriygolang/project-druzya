import type { SessionMode } from '@/lib/types'

const MODE_LABELS: Partial<Record<SessionMode, string>> = {
  SESSION_MODE_COMPANY_INTERVIEW: 'Mock под компанию',
  SESSION_MODE_ALGORITHMS_TRAINING: 'Algo training',
  SESSION_MODE_LIVE_CODING_TRAINING: 'Coding training',
  SESSION_MODE_SYSTEM_DESIGN_TRAINING: 'System Design training',
  SESSION_MODE_BEHAVIORAL_TRAINING: 'Behavioral training',
  SESSION_MODE_SQL_TRAINING: 'SQL training',
  SESSION_MODE_RETRY_MISTAKES: 'Retry mistakes',
}

export function sessionModeLabel(mode?: SessionMode | string): string {
  if (!mode) return 'Interview session'
  return MODE_LABELS[mode as SessionMode] ?? String(mode).replace(/^SESSION_MODE_/, '').replace(/_/g, ' ')
}

export function isActiveSessionConflict(message: string): boolean {
  return /active session already exists/i.test(message)
}

import { formatApiError } from '@/lib/apiClient'

export function formatInterviewError(err: unknown, fallback = 'Не удалось выполнить запрос'): string {
  const raw = err instanceof Error || typeof err === 'object' ? formatApiError(err) : String(err ?? fallback)
  if (isActiveSessionConflict(raw)) {
    return 'У вас уже есть активная сессия — продолжите её или завершите ниже.'
  }
  return raw || fallback
}
