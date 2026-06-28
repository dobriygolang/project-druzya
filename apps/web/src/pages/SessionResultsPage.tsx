import { useQueries, useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { SectionCard } from '@/components/SectionCard'
import { getTask } from '@/lib/api/content'
import { getSessionResults, listRetryItems } from '@/lib/api/interview'
import { getDashboard } from '@/lib/api/recommendation'
import { formatSessionMode, formatSessionStatus, formatSectionStatus } from '@/lib/interview/labels'
import { useI18n } from '@/lib/i18n'
import type { EvaluationResult, SessionSection } from '@/lib/types'

export default function SessionResultsPage() {
  const { t } = useI18n()
  const { sessionId = '' } = useParams()

  const resultsQ = useQuery({
    queryKey: ['session-results', sessionId],
    queryFn: () => getSessionResults(sessionId),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      const pending =
        data.progress.evaluated_tasks > data.evaluations.length &&
        data.session.status === 'SESSION_STATUS_COMPLETED'
      return pending ? 2000 : false
    },
  })

  const dashboardQ = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    enabled: resultsQ.isSuccess,
  })

  const retryQ = useQuery({
    queryKey: ['retry-items'],
    queryFn: listRetryItems,
    enabled: resultsQ.isSuccess,
  })

  const results = resultsQ.data
  const evaluations = results?.evaluations ?? []
  const taskIds = [...new Set(evaluations.map((e) => e.task_id))]

  const taskQueries = useQueries({
    queries: taskIds.map((id) => ({
      queryKey: ['task', id],
      queryFn: () => getTask(id),
      enabled: !!id && resultsQ.isSuccess,
    })),
  })

  const taskTitles = new Map(
    taskQueries
      .map((q, i) => (q.data?.task ? [taskIds[i], q.data.task.title] as const : null))
      .filter(Boolean) as [string, string][],
  )

  if (resultsQ.isLoading) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">{t('results.loading')}</p>
      </PageContent>
    )
  }
  if (resultsQ.isError) {
    return (
      <PageContent>
        <ErrorMessage
          message={resultsQ.error instanceof Error ? resultsQ.error.message : t('common.error')}
          onRetry={() => void resultsQ.refetch()}
        />
      </PageContent>
    )
  }

  if (!results) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">{t('results.notFound')}</p>
      </PageContent>
    )
  }

  const { session, sections, progress } = results
  const passed = evaluations.filter((e) => e.summary.passed).length
  const failed = evaluations.length - passed
  const pendingEvaluations =
    progress.evaluated_tasks > evaluations.length &&
    session.status === 'SESSION_STATUS_COMPLETED'
  const pendingRetries = (retryQ.data?.items ?? []).filter(
    (i) => i.status === 'RETRY_ITEM_STATUS_PENDING',
  )
  const recommendations = dashboardQ.data?.recommendations ?? []
  const weaknesses = dashboardQ.data?.weaknesses ?? []

  return (
    <PageContent>
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
          {formatSessionMode(session.mode)}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">{t('results.title')}</h1>
        <p className="text-[14px] text-text-secondary">
          {formatSessionStatus(session.status)}
          {session.total_score ? t('results.totalScore', { score: session.total_score }) : ''}
        </p>
        <p className="text-[13px] text-text-muted">
          {t('results.stats', {
            evaluated: progress.evaluated_tasks,
            skipped: progress.skipped_tasks,
            total: progress.total_tasks,
          })}
          {evaluations.length > 0
            ? t('results.statsWithPass', { passed, failed })
            : ''}
        </p>
        {pendingEvaluations ? (
          <p className="text-[13px] text-text-secondary">{t('results.pendingEval')}</p>
        ) : null}
      </header>

      <SectionCard title={t('results.sections')}>
        <ul className="space-y-3">
          {[...sections]
            .sort((a: SessionSection, b: SessionSection) => a.position - b.position)
            .map((s) => (
              <li
                key={s.id}
                className="flex justify-between gap-4 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
              >
                <span className="font-medium">
                  {s.position}. {s.title}
                </span>
                <span className="text-text-muted">
                  {formatSectionStatus(s.status)}
                  {s.score ? ` · ${s.score}` : ''}
                </span>
              </li>
            ))}
        </ul>
      </SectionCard>

      <SectionCard title={t('results.evaluations')}>
        {evaluations.length === 0 ? (
          <p className="text-[13px] text-text-muted">
            {pendingEvaluations ? t('results.evalPending') : t('results.evalEmpty')}
          </p>
        ) : (
          <ul className="space-y-4">
            {evaluations.map((ev: EvaluationResult) => (
              <EvaluationRow
                key={ev.summary.id}
                ev={ev}
                title={taskTitles.get(ev.task_id)}
                t={t}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      {dashboardQ.isSuccess && (recommendations.length > 0 || weaknesses.length > 0) ? (
        <SectionCard title={t('results.next')}>
          <p className="mb-3 flex items-center gap-2 text-[13px] text-text-secondary">
            <Sparkles className="h-4 w-4 shrink-0" />
            {t('results.nextHint')}
          </p>
          {dashboardQ.data?.readiness_score != null ? (
            <p className="mb-3 text-sm">
              {t('results.readiness')}{' '}
              <span className="font-semibold tabular-nums">{dashboardQ.data.readiness_score}</span>
            </p>
          ) : null}
          {recommendations.length > 0 ? (
            <ul className="space-y-2">
              {recommendations.slice(0, 3).map((r) => (
                <li key={r.id} className="rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.description ? (
                    <p className="mt-1 text-xs text-text-secondary">{r.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {weaknesses.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {weaknesses.slice(0, 4).map((w) => (
                <li
                  key={w.skill_key}
                  className="rounded-full border border-border px-3 py-1 font-mono text-[11px] text-text-secondary"
                >
                  {w.skill_key} · {w.score}%
                </li>
              ))}
            </ul>
          ) : null}
          <Link to="/today" className="mt-4 inline-block text-sm underline">
            {t('results.openToday')}
          </Link>
        </SectionCard>
      ) : null}

      {pendingRetries.length > 0 ? (
        <SectionCard title={t('results.retryTitle')}>
          <p className="text-[13px] text-text-secondary">
            {t('results.retryPending', { count: pendingRetries.length })}
          </p>
          <Link to="/today" className="mt-3 inline-block">
            <Button variant="ghost" size="sm" icon={<RefreshCw className="h-4 w-4" />}>
              {t('results.goRetry')}
            </Button>
          </Link>
        </SectionCard>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link to="/today">
          <Button icon={<ArrowRight className="h-4 w-4" />}>{t('results.toToday')}</Button>
        </Link>
        <Link to="/mock">
          <Button variant="secondary">{t('results.newInterview')}</Button>
        </Link>
      </div>
    </PageContent>
  )
}

function EvaluationRow({
  ev,
  title,
  t,
}: {
  ev: EvaluationResult
  title?: string
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const feedbackText =
    typeof ev.summary.feedback === 'object' && ev.summary.feedback !== null
      ? (ev.summary.feedback as { text?: string }).text
      : undefined

  return (
    <li className="border-b border-border pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-text-primary">
            {title ?? t('results.taskFallback', { id: ev.task_id.slice(0, 8) })}
          </p>
          <p className="font-mono text-[10px] text-text-muted">{ev.task_id.slice(0, 8)}…</p>
        </div>
        <span className={ev.summary.passed ? 'font-medium text-text-primary' : 'text-danger'}>
          {ev.summary.score} · {ev.summary.passed ? t('common.pass') : t('common.fail')}
        </span>
      </div>
      {ev.summary.summary ? (
        <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">{ev.summary.summary}</p>
      ) : null}
      {feedbackText ? (
        <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{feedbackText}</p>
      ) : null}
    </li>
  )
}
