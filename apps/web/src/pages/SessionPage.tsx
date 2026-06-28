import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CodeEditorPanel } from '@/components/CodeEditorPanel'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { SectionCard } from '@/components/SectionCard'
import { getTask } from '@/lib/api/content'
import { createRoom } from '@/lib/api/rooms'
import { submitAttemptFromCodeRun } from '@/lib/api/sandbox'
import {
  cancelSession,
  getAttempt,
  getCurrentSessionState,
  skipTask,
  submitAttempt,
} from '@/lib/api/interview'
import { isCodeTask } from '@/lib/interview/taskKind'
import {
  initialEditorSolution,
  mergeEditorPreset,
  taskRequiresSandboxVerify,
} from '@/lib/interview/editorPreset'
import { SessionSectionsProgress } from '@/components/session/SessionSectionsProgress'
import { useI18n } from '@/lib/i18n'
import { useDomainLabels } from '@/lib/labels'

export default function SessionPage() {
  const { t } = useI18n()
  const labels = useDomainLabels()
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [answer, setAnswer] = useState('')
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('go')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [verifiedSubmitRunId, setVerifiedSubmitRunId] = useState<string | null>(null)

  const stateQ = useQuery({
    queryKey: ['session-current', sessionId],
    queryFn: () => getCurrentSessionState(sessionId),
    enabled: !!sessionId,
    refetchInterval: attemptId ? 2000 : false,
  })

  const taskId = stateQ.data?.current_task?.task_id
  const sessionTaskId = stateQ.data?.current_task?.id
  const taskQ = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => getTask(taskId!),
    enabled: !!taskId,
  })

  const attemptQ = useQuery({
    queryKey: ['attempt', attemptId],
    queryFn: () => getAttempt(attemptId!),
    enabled: !!attemptId,
    refetchInterval: (query) => {
      const status = query.state.data?.attempt.status
      if (
        status === 'ATTEMPT_STATUS_EVALUATED' ||
        status === 'ATTEMPT_STATUS_FAILED' ||
        status === 'ATTEMPT_STATUS_CANCELLED'
      ) {
        return false
      }
      return 2000
    },
  })

  useEffect(() => {
    const status = attemptQ.data?.attempt.status
    if (status === 'ATTEMPT_STATUS_EVALUATED' || status === 'ATTEMPT_STATUS_FAILED') {
      setAttemptId(null)
      setAnswer('')
      setCode('')
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

  useEffect(() => {
    setVerifiedSubmitRunId(null)
  }, [sessionTaskId])

  useEffect(() => {
    const meta = taskQ.data?.task.metadata
    if (!meta || !taskId) return
    setCode(initialEditorSolution(meta, language))
    setVerifiedSubmitRunId(null)
  }, [taskId, language, taskQ.data?.task.metadata])

  const submitM = useMutation({
    mutationFn: async () => {
      if (!sessionTaskId) throw new Error('no current task')
      const isCode = isCodeTask(stateQ.data?.current_task?.task_type ?? taskQ.data?.task.type)
      const meta = taskQ.data?.task.metadata
      const requiresVerify = taskRequiresSandboxVerify(meta)
      if (isCode) {
        if (requiresVerify) {
          if (!verifiedSubmitRunId) {
            throw new Error(t('session.editorSubmitNeedsVerify'))
          }
          const result = await submitAttemptFromCodeRun(verifiedSubmitRunId, sessionTaskId)
          return {
            attempt: {
              id: result.attempt_id,
              status: result.status,
            },
          }
        }
        const merged = mergeEditorPreset(meta, language, code)
        return submitAttempt({
          sessionTaskId,
          code: merged,
          language,
        })
      }
      return submitAttempt({
        sessionTaskId,
        answerText: answer,
      })
    },
    onSuccess: (data) => {
      setAttemptId(data.attempt.id)
      setVerifiedSubmitRunId(null)
    },
  })

  const skipM = useMutation({
    mutationFn: () => {
      if (!sessionTaskId) throw new Error('no current task')
      return skipTask(sessionTaskId)
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['session-current', sessionId] }),
  })

  const cancelM = useMutation({
    mutationFn: () => cancelSession(sessionId),
    onSuccess: () => navigate(`/interview/session/${sessionId}/results`, { replace: true }),
  })

  const collabM = useMutation({
    mutationFn: () =>
      createRoom({
        room_type: 'interview',
        task_id: taskId,
        language,
        session_id: sessionId,
      }),
    onSuccess: (room) => {
      const qs = sessionTaskId ? `?sessionTaskId=${encodeURIComponent(sessionTaskId)}` : ''
      window.open(`/live/${room.id}${qs}`, '_blank', 'noopener,noreferrer')
    },
  })

  if (stateQ.isLoading) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">{t('session.loading')}</p>
      </PageContent>
    )
  }
  if (stateQ.isError) {
    return (
      <PageContent>
        <ErrorMessage
          message={stateQ.error instanceof Error ? stateQ.error.message : t('session.error')}
          onRetry={() => void stateQ.refetch()}
        />
      </PageContent>
    )
  }

  const state = stateQ.data
  if (!state) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">{t('session.notFound')}</p>
      </PageContent>
    )
  }

  const { session, current_section, current_task, progress } = state
  const sections = stateQ.data?.sections ?? []

  if (!current_task) {
    return (
      <PageContent>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold leading-tight">{t('session.completed')}</h1>
          <p className="text-[14px] text-text-secondary">{t('session.completedBody')}</p>
        </header>
        <Button onClick={() => navigate(`/interview/session/${sessionId}/results`)}>
          {t('session.viewResults')}
        </Button>
      </PageContent>
    )
  }

  const task = taskQ.data?.task
  const evaluating = !!attemptId
  const codeTask = isCodeTask(current_task.task_type ?? task?.type)

  const attemptStatus = attemptQ.data?.attempt.status ?? 'ATTEMPT_STATUS_SUBMITTED'

  return (
    <PageContent className="gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
            {t('session.eyebrow')}
          </p>
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            {current_section?.title ?? t('session.taskFallback')}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {t('session.progress', {
              done: progress.evaluated_tasks + progress.skipped_tasks,
              total: progress.total_tasks,
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => cancelM.mutate()}
          className="text-sm text-text-muted underline transition-colors hover:text-text-primary"
        >
          {t('session.cancel')}
        </button>
      </header>

      <SessionSectionsProgress
        sections={sections}
        currentSectionId={current_section?.id}
        progress={progress}
      />

      {taskQ.isLoading ? (
        <p className="text-sm text-text-muted">{t('session.loadingTask')}</p>
      ) : task || current_task.task_title ? (
        <SectionCard title={task?.title ?? current_task.task_title ?? t('session.taskFallback')}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="mono rounded bg-surface-2 px-2 py-0.5">
              {labels.taskType(task?.type ?? current_task.task_type ?? '')}
            </span>
            {task?.difficulty ? <span>{labels.difficulty(task.difficulty)}</span> : null}
            {task?.estimated_minutes ? <span>{task.estimated_minutes} min</span> : null}
          </div>
          {task?.description ? (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
              {task.description}
            </p>
          ) : taskQ.isLoading ? (
            <p className="text-sm text-text-muted">{t('session.loadingTask')}</p>
          ) : null}
        </SectionCard>
      ) : null}

      {evaluating ? (
        <Card elevation="e2">
          <p className="text-sm font-medium">{t('session.evaluating')}</p>
          <p className="mt-1 text-sm text-text-muted">
            {t('session.evaluatingHint', { status: labels.attemptStatus(attemptStatus) })}
          </p>
        </Card>
      ) : codeTask && taskId && sessionTaskId ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-text-secondary">{t('session.codeHint')}</p>
            <Button
              variant="secondary"
              size="sm"
              loading={collabM.isPending}
              onClick={() => collabM.mutate()}
            >
              {t('session.liveRoom')}
            </Button>
          </div>
          {collabM.isError ? (
            <ErrorMessage
              message={
                collabM.error instanceof Error ? collabM.error.message : t('session.roomError')
              }
            />
          ) : null}
          <CodeEditorPanel
            taskId={taskId}
            sessionTaskId={sessionTaskId}
            taskMetadata={task?.metadata}
            language={language}
            onLanguageChange={setLanguage}
            code={code}
            onCodeChange={setCode}
            verifiedSubmitRunId={verifiedSubmitRunId}
            onVerifiedSubmitRunChange={setVerifiedSubmitRunId}
            onSubmit={() => submitM.mutate()}
            submitPending={submitM.isPending}
          />
          {submitM.isError ? (
            <ErrorMessage
              message={
                submitM.error instanceof Error ? submitM.error.message : t('session.submitError')
              }
            />
          ) : null}
        </>
      ) : (
        <SectionCard title={t('session.answer')}>
          <textarea
            id="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-border-strong"
            placeholder={t('session.answerPlaceholder')}
          />

          {(submitM.isError || skipM.isError) && (
            <ErrorMessage
              message={
                (submitM.error ?? skipM.error) instanceof Error
                  ? (submitM.error ?? skipM.error)!.message
                  : t('session.submitError')
              }
            />
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              loading={submitM.isPending}
              disabled={!answer.trim()}
              onClick={() => submitM.mutate()}
            >
              {t('session.submit')}
            </Button>
            <Button variant="ghost" loading={skipM.isPending} onClick={() => skipM.mutate()}>
              {t('session.skip')}
            </Button>
          </div>
        </SectionCard>
      )}

      {codeTask && !evaluating ? (
        <div className="flex justify-end">
          <Button variant="ghost" loading={skipM.isPending} onClick={() => skipM.mutate()}>
            {t('session.skipTask')}
          </Button>
        </div>
      ) : null}

      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
        {t('session.sessionMeta', {
          id: session.id.slice(0, 8),
          mode: labels.sessionMode(session.mode),
        })}
      </p>
    </PageContent>
  )
}
