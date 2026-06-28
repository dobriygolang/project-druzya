import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ExcalidrawSceneAPI } from '@/components/system-design/ExcalidrawCanvas'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { createRoom } from '@/lib/api/rooms'
import { getTask } from '@/lib/api/content'
import { getAttempt, getCurrentSessionState } from '@/lib/api/interview'
import {
  getSystemDesignWorkspace,
  patchSystemDesignWorkspace,
  postSystemDesignTurn,
  requestSystemDesignCheckpoint,
  SD_PHASES,
  submitSystemDesign,
  type SystemDesignPhase,
  type SystemDesignTurn,
  type SystemDesignWorkspace,
} from '@/lib/api/systemDesign'
import {
  clearSDDraft,
  flushPendingSDPatches,
  loadSDDraft,
  queueSDPatch,
  saveSDDraft,
} from '@/lib/systemDesign/offlineStore'
import { useI18n } from '@/lib/i18n'
import { exportDiagramPngBase64 } from '@/components/system-design/ExcalidrawCanvas'

const ExcalidrawCanvas = lazy(() =>
  import('@/components/system-design/ExcalidrawCanvas').then((m) => ({ default: m.ExcalidrawCanvas })),
)

function phaseLabel(phase: SystemDesignPhase, t: (k: string) => string): string {
  const item = SD_PHASES.find((p) => p.id === phase)
  return item ? t(`sdRoom.phases.${item.key}`) : phase
}

export default function SystemDesignRoomPage() {
  const { t } = useI18n()
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [chatInput, setChatInput] = useState('')
  const [turns, setTurns] = useState<SystemDesignTurn[]>([])
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [offlineNote, setOfflineNote] = useState<string | null>(null)
  const saveTimer = useRef<number | null>(null)
  const excalidrawApi = useRef<ExcalidrawSceneAPI | null>(null)

  const stateQ = useQuery({
    queryKey: ['session-current', sessionId],
    queryFn: () => getCurrentSessionState(sessionId),
    enabled: !!sessionId,
  })

  const sessionTaskId = stateQ.data?.current_task?.id
  const taskId = stateQ.data?.current_task?.task_id

  const taskQ = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId!),
    enabled: !!taskId,
  })

  const workspaceQ = useQuery({
    queryKey: ['sd-workspace', sessionTaskId],
    queryFn: async () => {
      const res = await getSystemDesignWorkspace(sessionTaskId!)
      setTurns(res.recent_turns ?? [])
      const draft = await loadSDDraft(sessionTaskId!)
      if (draft && draft.version > res.workspace.version) {
        setOfflineNote(t('sdRoom.restoredDraft'))
        return draft
      }
      return res.workspace
    },
    enabled: !!sessionTaskId,
  })

  useEffect(() => {
    if (!sessionTaskId) return
    const onOnline = () => {
      void flushPendingSDPatches(sessionTaskId, async (payload) => {
        await patchSystemDesignWorkspace({
          sessionTaskId,
          expectedVersion: Number(payload.expected_version),
          ...(payload as Omit<Parameters<typeof patchSystemDesignWorkspace>[0], 'sessionTaskId' | 'expectedVersion'>),
        })
      }).then(() => setOfflineNote(null))
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [sessionTaskId, t])

  const [localWS, setLocalWS] = useState<SystemDesignWorkspace | null>(null)
  useEffect(() => {
    if (workspaceQ.data) setLocalWS(workspaceQ.data)
  }, [workspaceQ.data])

  const attemptQ = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => getAttempt(attemptId!),
    enabled: !!attemptId,
    refetchInterval: (query) => {
      const status = query.state.data?.attempt.status
      if (status === 'ATTEMPT_STATUS_EVALUATED' || status === 'ATTEMPT_STATUS_FAILED') return false
      return 2000
    },
  })

  useEffect(() => {
    const status = attemptQ.data?.attempt.status
    if (status === 'ATTEMPT_STATUS_EVALUATED' || status === 'ATTEMPT_STATUS_FAILED') {
      setAttemptId(null)
      void qc.invalidateQueries({ queryKey: ['session-current', sessionId] })
    }
  }, [attemptQ.data?.attempt.status, qc, sessionId])

  useEffect(() => {
    if (
      stateQ.data?.session.status === 'SESSION_STATUS_COMPLETED' ||
      stateQ.data?.session.status === 'SESSION_STATUS_CANCELLED'
    ) {
      navigate(`/interview/session/${sessionId}/results`, { replace: true })
    }
  }, [stateQ.data?.session.status, navigate, sessionId])

  const patchM = useMutation({
    mutationFn: patchSystemDesignWorkspace,
    onSuccess: (res) => {
      setLocalWS(res.workspace)
      qc.setQueryData(['sd-workspace', sessionTaskId], res.workspace)
      if (sessionTaskId) void saveSDDraft(sessionTaskId, res.workspace)
      setOfflineNote(null)
    },
    onError: async (err, vars) => {
      if (!sessionTaskId) return
      if (!navigator.onLine) {
        await queueSDPatch(sessionTaskId, {
          expected_version: vars.expectedVersion,
          phase: vars.phase,
          functional_context: vars.functional_context,
          nfr: vars.nfr,
          diagram: vars.diagram,
          api_spec: vars.api_spec,
          data_model: vars.data_model,
          infrastructure: vars.infrastructure,
          wrap_up: vars.wrap_up,
        })
        setOfflineNote(t('sdRoom.savedOffline'))
        return
      }
      if (err instanceof Error && err.message.includes('409')) {
        setOfflineNote(t('sdRoom.versionConflict'))
      }
    },
  })

  const scheduleSave = useCallback(
    (next: Partial<SystemDesignWorkspace>) => {
      if (!localWS || !sessionTaskId) return
      const merged = { ...localWS, ...next }
      setLocalWS(merged)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        if (sessionTaskId) void saveSDDraft(sessionTaskId, merged)
        patchM.mutate({
          sessionTaskId,
          expectedVersion: merged.version,
          phase: merged.phase,
          functional_context: merged.functional_context,
          nfr: merged.nfr,
          diagram: merged.diagram,
          api_spec: merged.api_spec,
          data_model: merged.data_model,
          infrastructure: merged.infrastructure,
          wrap_up: merged.wrap_up,
        })
      }, 800)
    },
    [localWS, patchM, sessionTaskId],
  )

  const chatM = useMutation({
    mutationFn: (content: string) => postSystemDesignTurn(sessionTaskId!, content),
    onSuccess: (res) => {
      setTurns((prev) => [...prev, res.user_turn, res.interviewer_turn])
      setChatInput('')
    },
  })

  const checkpointM = useMutation({
    mutationFn: async () => {
      const png = await exportDiagramPngBase64(excalidrawApi.current)
      return requestSystemDesignCheckpoint(sessionTaskId!, png)
    },
    onSuccess: (res) => setTurns((prev) => [...prev, res.system_turn]),
  })

  const collabM = useMutation({
    mutationFn: () =>
      createRoom({
        room_type: 'system_design',
        task_id: taskId,
        language: 'diagram',
        session_id: sessionId,
      }),
    onSuccess: (room) => {
      const qs = sessionTaskId ? `?sessionTaskId=${encodeURIComponent(sessionTaskId)}` : ''
      window.open(`/live/${room.id}${qs}`, '_blank', 'noopener,noreferrer')
    },
  })

  const submitM = useMutation({
    mutationFn: async () => {
      const png = await exportDiagramPngBase64(excalidrawApi.current)
      return submitSystemDesign(sessionTaskId!, png)
    },
    onSuccess: async (res) => {
      setAttemptId(res.attempt.id)
      if (sessionTaskId) await clearSDDraft(sessionTaskId)
    },
  })

  const panelField = useMemo(
    () =>
      ({
        nfr: 'nfr',
        api: 'api_spec',
        data_model: 'data_model',
        deep_dive: 'infrastructure',
        wrap_up: 'wrap_up',
      }) as const,
    [],
  )

  if (stateQ.isLoading || workspaceQ.isLoading) {
    return (
      <PageContent>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </PageContent>
    )
  }

  if (stateQ.error || workspaceQ.error || !localWS || !sessionTaskId) {
    return (
      <PageContent>
        <ErrorMessage message={t('sdRoom.loadError')} />
      </PageContent>
    )
  }

  const task = taskQ.data?.task
  const currentPhase = localWS.phase

  return (
    <PageContent className="max-w-7xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{task?.title ?? t('sdRoom.title')}</h1>
          <p className="text-sm text-muted-foreground">{phaseLabel(currentPhase, t)}</p>
          {offlineNote ? <p className="text-xs text-amber-600">{offlineNote}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={collabM.isPending}
            onClick={() => collabM.mutate()}
          >
            {t('sdRoom.liveRoom')}
          </Button>
          <Button variant="secondary" onClick={() => checkpointM.mutate()} disabled={checkpointM.isPending}>
            {t('sdRoom.checkpoint')}
          </Button>
          <Button onClick={() => submitM.mutate()} disabled={submitM.isPending || !!attemptId}>
            {attemptId ? t('sdRoom.evaluating') : t('sdRoom.submit')}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {SD_PHASES.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={currentPhase === p.id ? 'primary' : 'secondary'}
            onClick={() => scheduleSave({ phase: p.id, version: localWS.version })}
          >
            {t(`sdRoom.phases.${p.key}`)}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {(currentPhase === 'SYSTEM_DESIGN_PHASE_BRIEF' ||
            currentPhase === 'SYSTEM_DESIGN_PHASE_CLARIFICATION') && (
            <Card className="p-4">
              <h2 className="mb-2 font-medium">{t('sdRoom.brief')}</h2>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{task?.description}</p>
            </Card>
          )}

          {currentPhase === 'SYSTEM_DESIGN_PHASE_DIAGRAM' && (
            <Card className="h-[420px] overflow-hidden p-0">
              <Suspense
                fallback={<p className="p-4 text-sm">{t('common.loading')}</p>}
                // preload export helper alongside canvas
              >
                <ExcalidrawCanvas
                  initialData={localWS.diagram}
                  onChange={(diagram) => scheduleSave({ diagram, version: localWS.version })}
                  onApiReady={(api) => {
                    excalidrawApi.current = api
                  }}
                />
              </Suspense>
            </Card>
          )}

          {(currentPhase === 'SYSTEM_DESIGN_PHASE_NFR' ||
            currentPhase === 'SYSTEM_DESIGN_PHASE_API' ||
            currentPhase === 'SYSTEM_DESIGN_PHASE_DATA_MODEL' ||
            currentPhase === 'SYSTEM_DESIGN_PHASE_DEEP_DIVE' ||
            currentPhase === 'SYSTEM_DESIGN_PHASE_WRAP_UP') && (
            <Card className="p-4">
              <label className="mb-2 block font-medium">
                {currentPhase === 'SYSTEM_DESIGN_PHASE_WRAP_UP'
                  ? t('sdRoom.wrapUp')
                  : t(`sdRoom.phases.${SD_PHASES.find((p) => p.id === currentPhase)?.key ?? 'nfr'}`)}
              </label>
              {currentPhase === 'SYSTEM_DESIGN_PHASE_WRAP_UP' ? (
                <textarea
                  className="min-h-[200px] w-full rounded-md border bg-background p-3 text-sm"
                  value={localWS.wrap_up ?? ''}
                  onChange={(e) => scheduleSave({ wrap_up: e.target.value, version: localWS.version })}
                />
              ) : (
                <textarea
                  className="min-h-[200px] w-full rounded-md border bg-background p-3 text-sm font-mono"
                  value={JSON.stringify(
                    (localWS[
                      panelField[
                        SD_PHASES.find((p) => p.id === currentPhase)?.key as keyof typeof panelField
                      ] as keyof SystemDesignWorkspace
                    ] as Record<string, unknown> | undefined) ?? { notes: '' },
                    null,
                    2,
                  )}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value) as Record<string, unknown>
                      const key = SD_PHASES.find((p) => p.id === currentPhase)?.key
                      if (key === 'nfr') scheduleSave({ nfr: parsed, version: localWS.version })
                      if (key === 'api') scheduleSave({ api_spec: parsed, version: localWS.version })
                      if (key === 'data_model') scheduleSave({ data_model: parsed, version: localWS.version })
                      if (key === 'deep_dive') scheduleSave({ infrastructure: parsed, version: localWS.version })
                    } catch {
                      /* ignore invalid JSON while typing */
                    }
                  }}
                />
              )}
            </Card>
          )}
        </div>

        <Card className="flex max-h-[560px] flex-col p-4">
          <h2 className="mb-2 font-medium">{t('sdRoom.interviewer')}</h2>
          <div className="mb-3 flex-1 space-y-2 overflow-y-auto text-sm">
            {turns.length === 0 && (
              <p className="text-muted-foreground">{t('sdRoom.chatEmpty')}</p>
            )}
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={
                  turn.role === 'SYSTEM_DESIGN_TURN_ROLE_USER'
                    ? 'rounded-md bg-primary/10 p-2'
                    : turn.role === 'SYSTEM_DESIGN_TURN_ROLE_SYSTEM'
                      ? 'rounded-md border border-dashed p-2 text-muted-foreground'
                      : 'rounded-md bg-muted p-2'
                }
              >
                <p className="whitespace-pre-wrap">{turn.content}</p>
              </div>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!chatInput.trim()) return
              chatM.mutate(chatInput.trim())
            }}
          >
            <input
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={t('sdRoom.chatPlaceholder')}
            />
            <Button type="submit" disabled={chatM.isPending}>
              {t('sdRoom.send')}
            </Button>
          </form>
        </Card>
      </div>

      {collabM.isError ? (
        <div className="mt-4">
          <ErrorMessage
            message={
              collabM.error instanceof Error ? collabM.error.message : t('session.roomError')
            }
          />
        </div>
      ) : null}

      {(patchM.isError || chatM.isError || submitM.isError) && (
        <div className="mt-4">
          <ErrorMessage
            message={
              patchM.error instanceof Error
                ? patchM.error.message
                : chatM.error instanceof Error
                  ? chatM.error.message
                  : submitM.error instanceof Error
                    ? submitM.error.message
                    : 'Something went wrong'
            }
          />
        </div>
      )}
    </PageContent>
  )
}
