import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ErrorMessage } from '@/components/ErrorMessage'
import { getSessionResults } from '@/lib/api/interview'
import type { EvaluationResult, SessionSection } from '@/lib/types'

export default function SessionResultsPage() {
  const { sessionId = '' } = useParams()

  const resultsQ = useQuery({
    queryKey: ['session-results', sessionId],
    queryFn: () => getSessionResults(sessionId),
    enabled: !!sessionId,
  })

  if (resultsQ.isLoading) return <p className="text-sm text-muted">Загрузка результатов…</p>
  if (resultsQ.isError) {
    return (
      <ErrorMessage
        message={resultsQ.error instanceof Error ? resultsQ.error.message : 'Ошибка'}
        onRetry={() => void resultsQ.refetch()}
      />
    )
  }

  const results = resultsQ.data
  if (!results) return <p className="text-sm text-muted">Результаты не найдены.</p>

  const { session, sections, evaluations, progress } = results

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Результаты интервью</h1>
        <p className="mt-1 text-sm text-muted">
          Статус: {session.status.replace('SESSION_STATUS_', '').toLowerCase()}
          {session.total_score ? ` · score ${session.total_score}` : ''}
        </p>
        <p className="mt-1 text-sm text-muted">
          {progress.evaluated_tasks} оценено · {progress.skipped_tasks} пропущено ·{' '}
          {progress.total_tasks} всего
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Секции</h2>
        {sections
          .slice()
          .sort((a: SessionSection, b: SessionSection) => a.position - b.position)
          .map((s: SessionSection) => (
            <div key={s.id} className="rounded-xl border border-border bg-surface-1 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="font-medium">
                  {s.position}. {s.title}
                </span>
                <span className="text-muted">
                  {s.status.replace('SECTION_STATUS_', '').toLowerCase()}
                  {s.score ? ` · ${s.score}` : ''}
                </span>
              </div>
            </div>
          ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">Оценки</h2>
        {evaluations.length === 0 ? (
          <p className="text-sm text-muted">Оценок пока нет — возможно, задачи были пропущены.</p>
        ) : (
          evaluations.map((ev: EvaluationResult) => (
            <article key={ev.summary.id} className="rounded-xl border border-border bg-surface-1 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-xs text-muted">{ev.task_id.slice(0, 8)}…</span>
                <span className={ev.summary.passed ? 'text-ink font-medium' : 'text-danger'}>
                  {ev.summary.score} · {ev.summary.passed ? 'pass' : 'fail'}
                </span>
              </div>
              {ev.summary.summary ? (
                <p className="mt-2 text-sm leading-relaxed">{ev.summary.summary}</p>
              ) : null}
            </article>
          ))
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/dashboard"
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white"
        >
          На главную
        </Link>
        <Link
          to="/interview"
          className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface-2"
        >
          Новое интервью
        </Link>
      </div>
    </div>
  )
}
