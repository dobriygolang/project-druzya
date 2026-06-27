import { api } from '@/lib/apiClient'
import type { CodeRun } from '@/lib/types'

export type RunType = 'custom' | 'sample' | 'submit'

export function runCode(input: {
  taskId?: string
  sessionTaskId?: string
  language: string
  code: string
  stdin?: string
  runType: RunType
}) {
  return api<{ run: CodeRun }>('/sandbox/code-runs', {
    method: 'POST',
    body: JSON.stringify({
      task_id: input.taskId,
      session_task_id: input.sessionTaskId,
      language: input.language,
      code: input.code,
      stdin: input.stdin,
      run_type: input.runType,
    }),
  })
}

export function getCodeRun(id: string) {
  return api<{ run: CodeRun }>(`/sandbox/code-runs/${id}`)
}

export function submitAttemptFromCodeRun(codeRunId: string, sessionTaskId: string) {
  return api<{ attempt_id: string; status: string }>(
    `/sandbox/code-runs/${codeRunId}/submit-attempt`,
    {
      method: 'POST',
      body: JSON.stringify({ session_task_id: sessionTaskId }),
    },
  )
}

export function isTerminalRunStatus(status: string): boolean {
  return !['queued', 'running'].includes(status)
}
