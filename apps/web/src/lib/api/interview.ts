import { api } from '@/lib/apiClient'
import {
  asArray,
  normalizeCurrentSessionState,
  normalizeSessionBundle,
  normalizeSessionResults,
} from '@/lib/api/normalize'
import type {
  Attempt,
  Progress,
  RetryItem,
  Session,
  SessionMode,
  SessionSection,
  SessionTask,
  EvaluationResult,
} from '@/lib/types'

export function startSession(templateId: string, mode: SessionMode = 'SESSION_MODE_COMPANY_INTERVIEW') {
  return api<{
    session: Session
    sections?: SessionSection[]
    tasks?: SessionTask[]
    progress?: Progress
  }>('/interview/sessions', {
    method: 'POST',
    body: JSON.stringify({ template_id: templateId, mode }),
  }).then(normalizeSessionBundle)
}

/** Start a single-section training session (no company template). */
export function startTrainingSession(mode: SessionMode) {
  return api<{
    session: Session
    sections?: SessionSection[]
    tasks?: SessionTask[]
    progress?: Progress
  }>('/interview/sessions', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  }).then(normalizeSessionBundle)
}

export function getSession(sessionId: string) {
  return api<{
    session: Session
    sections?: SessionSection[]
    tasks?: SessionTask[]
    progress?: Progress
  }>(`/interview/sessions/${sessionId}`).then(normalizeSessionBundle)
}

export function getCurrentSessionState(sessionId: string) {
  return api<{
    session: Session
    sections?: SessionSection[]
    current_section?: SessionSection
    current_task?: SessionTask
    progress?: Progress
  }>(`/interview/sessions/${sessionId}/current`).then(normalizeCurrentSessionState)
}

export function getSessionResults(sessionId: string) {
  return api<{
    session: Session
    sections?: SessionSection[]
    tasks?: SessionTask[]
    evaluations?: EvaluationResult[]
    progress?: Progress
  }>(`/interview/sessions/${sessionId}/results`).then(normalizeSessionResults)
}

export function cancelSession(sessionId: string) {
  return api<{ session: Session }>(`/interview/sessions/${sessionId}/cancel`, {
    method: 'POST',
    body: '{}',
  })
}

export function getActiveSession() {
  return api<{
    session?: Session
    progress?: Progress
  }>('/interview/sessions/active').then((res) => ({
    session: res.session ?? null,
    progress: res.progress ?? null,
  }))
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
  return api<{ task: SessionTask; progress?: Progress }>(
    `/interview/session-tasks/${sessionTaskId}/skip`,
    { method: 'POST', body: '{}' },
  ).then((res) => ({
    task: res.task,
    progress: res.progress ?? {
      total_tasks: 0,
      evaluated_tasks: 0,
      skipped_tasks: 0,
      total_sections: 0,
      done_sections: 0,
    },
  }))
}

export function getAttempt(attemptId: string) {
  return api<{ attempt: Attempt }>(`/interview/attempts/${attemptId}`)
}

export function listRetryItems() {
  return api<{ items?: RetryItem[] }>('/interview/retry-items').then((res) => ({
    items: asArray(res.items),
  }))
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
    sections?: SessionSection[]
    tasks?: SessionTask[]
    progress?: Progress
  }>('/interview/retry-sessions', {
    method: 'POST',
    body: JSON.stringify({ retry_item_ids: retryItemIds }),
  }).then(normalizeSessionBundle)
}
