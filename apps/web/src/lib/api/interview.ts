import { api } from '@/lib/apiClient'
import type {
  Attempt,
  EvaluationResult,
  Progress,
  RetryItem,
  Session,
  SessionMode,
  SessionSection,
  SessionTask,
} from '@/lib/types'

export function startSession(templateId: string, mode: SessionMode = 'SESSION_MODE_COMPANY_INTERVIEW') {
  return api<{
    session: Session
    sections: SessionSection[]
    tasks: SessionTask[]
    progress: Progress
  }>('/interview/sessions', {
    method: 'POST',
    body: JSON.stringify({ template_id: templateId, mode }),
  })
}

export function getSession(sessionId: string) {
  return api<{
    session: Session
    sections: SessionSection[]
    tasks: SessionTask[]
    progress: Progress
  }>(`/interview/sessions/${sessionId}`)
}

export function getCurrentSessionState(sessionId: string) {
  return api<{
    session: Session
    current_section?: SessionSection
    current_task?: SessionTask
    progress: Progress
  }>(`/interview/sessions/${sessionId}/current`)
}

export function getSessionResults(sessionId: string) {
  return api<{
    session: Session
    sections: SessionSection[]
    tasks: SessionTask[]
    evaluations: EvaluationResult[]
    progress: Progress
  }>(`/interview/sessions/${sessionId}/results`)
}

export function cancelSession(sessionId: string) {
  return api<{ session: Session }>(`/interview/sessions/${sessionId}/cancel`, {
    method: 'POST',
    body: '{}',
  })
}

export function submitAttempt(input: {
  sessionTaskId: string
  answerText?: string
  code?: string
  language?: string
}) {
  return api<{ attempt: Attempt }>(`/interview/session-tasks/${input.sessionTaskId}/attempts`, {
    method: 'POST',
    body: JSON.stringify({
      session_task_id: input.sessionTaskId,
      answer_text: input.answerText,
      code: input.code,
      language: input.language,
    }),
  })
}

export function skipTask(sessionTaskId: string) {
  return api<{ task: SessionTask; progress: Progress }>(
    `/interview/session-tasks/${sessionTaskId}/skip`,
    { method: 'POST', body: '{}' },
  )
}

export function getAttempt(attemptId: string) {
  return api<{ attempt: Attempt }>(`/interview/attempts/${attemptId}`)
}

export function listRetryItems() {
  return api<{ items: RetryItem[] }>('/interview/retry-items')
}

export function dismissRetryItem(retryItemId: string) {
  return api<{ item: RetryItem }>(`/interview/retry-items/${retryItemId}/dismiss`, {
    method: 'POST',
    body: '{}',
  })
}

export function startRetrySession(retryItemIds: string[]) {
  return api<{
    session: Session
    sections: SessionSection[]
    tasks: SessionTask[]
    progress: Progress
  }>('/interview/retry-sessions', {
    method: 'POST',
    body: JSON.stringify({ retry_item_ids: retryItemIds }),
  })
}
