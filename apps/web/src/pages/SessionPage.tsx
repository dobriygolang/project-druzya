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
import {
  cancelSession,
  getAttempt,
  getCurrentSessionState,
  getSession,
  skipTask,
  submitAttempt,
} from '@/lib/api/interview'
import { isCodeTask } from '@/lib/interview/taskKind'
import { SessionSectionsProgress } from '@/components/session/SessionSectionsProgress'

export default function SessionPage() {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [answer, setAnswer] = useState('')
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('go')
  const [attemptId, setAttemptId] = useState<string | null>(null)

  const stateQ = useQuery({
    queryKey: ['session-current', sessionId],
    queryFn: () => getCurrentSessionState(sessionId),
    enabled: !!sessionId,
    refetchInterval: attemptId ? 2000 : false,
  })

  const sessionQ = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => getSession(sessionId),
    enabled: !!sessionId,
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

  const submitM = useMutation({
    mutationFn: () => {
      if (!sessionTaskId) throw new Error('no current task')
      const isCode = isCodeTask(taskQ.data?.task.type)
      return submitAttempt({
        sessionTaskId,
        answerText: isCode ? undefined : answer,
        code: isCode ? code : undefined,
        language: isCode ? language : undefined,
      })
    },
    onSuccess: (data) => setAttemptId(data.attempt.id),
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
      window.open(`/live/${room.id}`, '_blank', 'noopener,noreferrer')
    },
  })

  if (stateQ.isLoading) {
    return (
      <PageContent wide>
        <p className="text-sm text-text-muted">Загрузка сессии…</p>
      </PageContent>
    )
  }
  if (stateQ.isError) {
    return (
      <PageContent wide>
        <ErrorMessage
          message={stateQ.error instanceof Error ? stateQ.error.message : 'Ошибка сессии'}
          onRetry={() => void stateQ.refetch()}
        />
      </PageContent>
    )
  }

  const state = stateQ.data
  if (!state) {
    return (
      <PageContent wide>
        <p className="text-sm text-text-muted">Сессия не найдена.</p>
      </PageContent>
    )
  }

  const { session, current_section, current_task, progress } = state
  const sections = sessionQ.data?.sections ?? []
  const task = taskQ.data?.task
  const evaluating = !!attemptId
  const codeTask = isCodeTask(task?.type)

  if (!current_task) {
    return (
      <PageContent wide>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold leading-tight">Сессия завершена</h1>
          <p className="text-[14px] text-text-secondary">Все задачи пройдены или пропущены.</p>
        </header>
        <Button onClick={() => navigate(`/interview/session/${sessionId}/results`)}>
          Смотреть результаты
        </Button>
      </PageContent>
    )
  }

  return (
    <PageContent wide className="gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
            Mock-интервью
          </p>
          <h1 className="font-display text-2xl font-bold leading-tight sm:text-3xl">
            {current_section?.title ?? 'Задача'}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            Прогресс: {progress.evaluated_tasks + progress.skipped_tasks}/{progress.total_tasks}{' '}
            задач
          </p>
        </div>
        <button
          type="button"
          onClick={() => cancelM.mutate()}
          className="text-sm text-text-muted underline transition-colors hover:text-text-primary"
        >
          Отменить сессию
        </button>
      </header>

      <SessionSectionsProgress
        sections={sections}
        currentSectionId={current_section?.id}
        progress={progress}
      />

      {taskQ.isLoading ? (
        <p className="text-sm text-text-muted">Загрузка задачи…</p>
      ) : task ? (
        <SectionCard title={task.title}>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="mono rounded bg-surface-2 px-2 py-0.5">{task.type}</span>
            <span>{task.difficulty}</span>
            {task.estimated_minutes ? <span>{task.estimated_minutes} min</span> : null}
          </div>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-secondary">
            {task.description}
          </p>
        </SectionCard>
      ) : null}

      {evaluating ? (
        <Card elevation="e2">
          <p className="text-sm font-medium">Оцениваем ответ…</p>
          <p className="mt-1 text-sm text-text-muted">
            Статус: {attemptQ.data?.attempt.status ?? 'ATTEMPT_STATUS_SUBMITTED'}
          </p>
        </Card>
      ) : codeTask && taskId && sessionTaskId ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-text-secondary">
              Решай solo или открой live-комнату для парного coding с интервьюером.
            </p>
            <Button
              variant="secondary"
              size="sm"
              loading={collabM.isPending}
              onClick={() => collabM.mutate()}
            >
              Live-комната
            </Button>
          </div>
          {collabM.isError ? (
            <ErrorMessage
              message={
                collabM.error instanceof Error ? collabM.error.message : 'Не удалось создать комнату'
              }
            />
          ) : null}
          <CodeEditorPanel
            taskId={taskId}
            sessionTaskId={sessionTaskId}
            language={language}
            onLanguageChange={setLanguage}
            code={code}
            onCodeChange={setCode}
            onSubmit={() => submitM.mutate()}
            submitPending={submitM.isPending}
          />
          {submitM.isError ? (
            <ErrorMessage
              message={
                submitM.error instanceof Error ? submitM.error.message : 'Ошибка отправки'
              }
            />
          ) : null}
        </>
      ) : (
        <SectionCard title="Ответ">
          <textarea
            id="answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-border-strong"
            placeholder="Опиши свой опыт и подход…"
          />

          {(submitM.isError || skipM.isError) && (
            <ErrorMessage
              message={
                (submitM.error ?? skipM.error) instanceof Error
                  ? (submitM.error ?? skipM.error)!.message
                  : 'Ошибка отправки'
              }
            />
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              loading={submitM.isPending}
              disabled={!answer.trim()}
              onClick={() => submitM.mutate()}
            >
              Отправить
            </Button>
            <Button variant="ghost" loading={skipM.isPending} onClick={() => skipM.mutate()}>
              Пропустить
            </Button>
          </div>
        </SectionCard>
      )}

      {codeTask && !evaluating ? (
        <div className="flex justify-end">
          <Button variant="ghost" loading={skipM.isPending} onClick={() => skipM.mutate()}>
            Пропустить задачу
          </Button>
        </div>
      ) : null}

      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
        Session {session.id.slice(0, 8)}… · {session.mode.replace('SESSION_MODE_', '').toLowerCase()}
      </p>
    </PageContent>
  )
}
