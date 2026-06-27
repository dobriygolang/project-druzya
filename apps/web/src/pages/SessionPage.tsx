import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { CodeEditorPanel } from '@/components/CodeEditorPanel'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { getTask } from '@/lib/api/content'
import { createRoom } from '@/lib/api/rooms'
import {
  cancelSession,
  getAttempt,
  getCurrentSessionState,
  skipTask,
  submitAttempt,
} from '@/lib/api/interview'

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
      const isCode = taskQ.data?.task.type === 'algorithm'
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

  if (stateQ.isLoading) return <p className="text-sm text-text-muted">Загрузка сессии…</p>
  if (stateQ.isError) {
    return (
      <ErrorMessage
        message={stateQ.error instanceof Error ? stateQ.error.message : 'Ошибка сессии'}
        onRetry={() => void stateQ.refetch()}
      />
    )
  }

  const state = stateQ.data
  if (!state) return <p className="text-sm text-text-muted">Сессия не найдена.</p>

  const { session, current_section, current_task, progress } = state
  const task = taskQ.data?.task
  const evaluating = !!attemptId

  if (!current_task) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Сессия завершена</h1>
        <p className="text-sm text-text-muted">Все задачи пройдены или пропущены.</p>
        <Button onClick={() => navigate(`/interview/session/${sessionId}/results`)}>
          Смотреть результаты
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Mock-интервью</p>
          <h1 className="text-2xl font-semibold">{current_section?.title ?? 'Задача'}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Прогресс: {progress.evaluated_tasks + progress.skipped_tasks}/{progress.total_tasks}{' '}
            задач
          </p>
        </div>
        <button
          type="button"
          onClick={() => cancelM.mutate()}
          className="text-sm text-text-muted underline"
        >
          Отменить сессию
        </button>
      </div>

      {taskQ.isLoading ? (
        <p className="text-sm text-text-muted">Загрузка задачи…</p>
      ) : task ? (
        <Card as="article" elevation="e2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="mono rounded bg-surface-2 px-2 py-0.5">{task.type}</span>
            <span>{task.difficulty}</span>
            {task.estimated_minutes ? <span>{task.estimated_minutes} min</span> : null}
          </div>
          <h2 className="mt-3 text-lg font-medium">{task.title}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
            {task.description}
          </p>
        </Card>
      ) : null}

      {evaluating ? (
        <Card elevation="e1">
          <p className="text-sm font-medium">Оцениваем ответ…</p>
          <p className="mt-1 text-sm text-text-muted">
            Статус: {attemptQ.data?.attempt.status ?? 'ATTEMPT_STATUS_SUBMITTED'}
          </p>
        </Card>
      ) : task?.type === 'algorithm' && taskId && sessionTaskId ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
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
        <div className="space-y-4">
          <div>
            <label htmlFor="answer" className="block text-sm font-medium">
              Ответ
            </label>
            <textarea
              id="answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
              placeholder="Опиши свой опыт и подход…"
            />
          </div>

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
        </div>
      )}

      {task?.type === 'algorithm' && !evaluating ? (
        <div className="flex justify-end">
          <Button variant="ghost" loading={skipM.isPending} onClick={() => skipM.mutate()}>
            Пропустить задачу
          </Button>
        </div>
      ) : null}

      <p className="text-xs text-text-muted">
        Session {session.id.slice(0, 8)}… · {session.mode.replace('SESSION_MODE_', '').toLowerCase()}
      </p>
    </div>
  )
}
