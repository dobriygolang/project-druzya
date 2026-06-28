import { api } from '@/lib/apiClient'
import type { Attempt } from '@/lib/types'

export type SystemDesignPhase =
  | 'SYSTEM_DESIGN_PHASE_BRIEF'
  | 'SYSTEM_DESIGN_PHASE_CLARIFICATION'
  | 'SYSTEM_DESIGN_PHASE_NFR'
  | 'SYSTEM_DESIGN_PHASE_DIAGRAM'
  | 'SYSTEM_DESIGN_PHASE_API'
  | 'SYSTEM_DESIGN_PHASE_DATA_MODEL'
  | 'SYSTEM_DESIGN_PHASE_DEEP_DIVE'
  | 'SYSTEM_DESIGN_PHASE_WRAP_UP'
  | 'SYSTEM_DESIGN_PHASE_SUBMITTED'

export type SystemDesignTurnRole =
  | 'SYSTEM_DESIGN_TURN_ROLE_USER'
  | 'SYSTEM_DESIGN_TURN_ROLE_INTERVIEWER'
  | 'SYSTEM_DESIGN_TURN_ROLE_SYSTEM'

export type SystemDesignWorkspace = {
  session_task_id: string
  phase: SystemDesignPhase
  functional_context?: Record<string, unknown>
  nfr?: Record<string, unknown>
  diagram?: Record<string, unknown>
  api_spec?: Record<string, unknown>
  data_model?: Record<string, unknown>
  infrastructure?: Record<string, unknown>
  wrap_up?: string
  version: number
  updated_at?: string
}

export type SystemDesignTurn = {
  id: string
  session_task_id: string
  phase: SystemDesignPhase
  role: SystemDesignTurnRole
  content: string
  metadata?: Record<string, unknown>
  created_at?: string
}

export function getSystemDesignWorkspace(sessionTaskId: string) {
  return api<{
    workspace: SystemDesignWorkspace
    recent_turns?: SystemDesignTurn[]
  }>(`/interview/session-tasks/${sessionTaskId}/system-design/workspace`)
}

export function patchSystemDesignWorkspace(input: {
  sessionTaskId: string
  expectedVersion: number
  phase?: SystemDesignPhase
  functional_context?: Record<string, unknown>
  nfr?: Record<string, unknown>
  diagram?: Record<string, unknown>
  api_spec?: Record<string, unknown>
  data_model?: Record<string, unknown>
  infrastructure?: Record<string, unknown>
  wrap_up?: string
}) {
  return api<{ workspace: SystemDesignWorkspace }>(
    `/interview/session-tasks/${input.sessionTaskId}/system-design/workspace`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        session_task_id: input.sessionTaskId,
        expected_version: input.expectedVersion,
        phase: input.phase,
        functional_context: input.functional_context,
        nfr: input.nfr,
        diagram: input.diagram,
        api_spec: input.api_spec,
        data_model: input.data_model,
        infrastructure: input.infrastructure,
        wrap_up: input.wrap_up,
      }),
    },
  )
}

export function postSystemDesignTurn(sessionTaskId: string, content: string) {
  return api<{ user_turn: SystemDesignTurn; interviewer_turn: SystemDesignTurn }>(
    `/interview/session-tasks/${sessionTaskId}/system-design/turns`,
    {
      method: 'POST',
      body: JSON.stringify({ session_task_id: sessionTaskId, content }),
    },
  )
}

export function requestSystemDesignCheckpoint(sessionTaskId: string, diagramPngBase64?: string) {
  return api<{ system_turn: SystemDesignTurn }>(
    `/interview/session-tasks/${sessionTaskId}/system-design/checkpoint`,
    {
      method: 'POST',
      body: JSON.stringify({
        session_task_id: sessionTaskId,
        diagram_png_base64: diagramPngBase64,
      }),
    },
  )
}

export function submitSystemDesign(sessionTaskId: string, diagramPngBase64?: string) {
  return api<{ attempt: Attempt }>(
    `/interview/session-tasks/${sessionTaskId}/system-design/submit`,
    {
      method: 'POST',
      body: JSON.stringify({
        session_task_id: sessionTaskId,
        diagram_png_base64: diagramPngBase64,
      }),
    },
  )
}

export const SD_PHASES: { id: SystemDesignPhase; key: string }[] = [
  { id: 'SYSTEM_DESIGN_PHASE_BRIEF', key: 'brief' },
  { id: 'SYSTEM_DESIGN_PHASE_CLARIFICATION', key: 'clarification' },
  { id: 'SYSTEM_DESIGN_PHASE_NFR', key: 'nfr' },
  { id: 'SYSTEM_DESIGN_PHASE_DIAGRAM', key: 'diagram' },
  { id: 'SYSTEM_DESIGN_PHASE_API', key: 'api' },
  { id: 'SYSTEM_DESIGN_PHASE_DATA_MODEL', key: 'data_model' },
  { id: 'SYSTEM_DESIGN_PHASE_DEEP_DIVE', key: 'deep_dive' },
  { id: 'SYSTEM_DESIGN_PHASE_WRAP_UP', key: 'wrap_up' },
]
