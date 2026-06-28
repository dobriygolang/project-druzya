import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { SectionCard } from '@/components/SectionCard'
import { getSessionResults } from '@/lib/api/interview'
import type { EvaluationResult, SessionSection } from '@/lib/types'

export default function SessionResultsPage() {
  const { sessionId = '' } = useParams()

  const resultsQ = useQuery({
    queryKey: ['session-results', sessionId],
    queryFn: () => getSessionResults(sessionId),
    enabled: !!sessionId,
  })

  if (resultsQ.isLoading) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">Загрузка результатов…</p>
      </PageContent>
    )
  }
  if (resultsQ.isError) {
    return (
      <PageContent>
        <ErrorMessage
          message={resultsQ.error instanceof Error ? resultsQ.error.message : 'Ошибка'}
          onRetry={() => void resultsQ.refetch()}
        />
      </PageContent>
    )
  }

  const results = resultsQ.data
  if (!results) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">Результаты не найдены.</p>
      </PageContent>
    )
  }

  const { session, sections, evaluations, progress } = results

  return (
    <PageContent>
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
          Mock-интервью
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight">Результаты</h1>
        <p className="text-[14px] text-text-secondary">
          Статус: {session.status.replace('SESSION_STATUS_', '').toLowerCase()}
          {session.total_score ? ` · score ${session.total_score}` : ''}
        </p>
        <p className="text-[13px] text-text-muted">
          {progress.evaluated_tasks} оценено · {progress.skipped_tasks} пропущено ·{' '}
          {progress.total_tasks} всего
        </p>
      </header>

      <SectionCard title="Секции">
        <ul className="space-y-3">
          {sections
            .slice()
            .sort((a: SessionSection, b: SessionSection) => a.position - b.position)
            .map((s: SessionSection) => (
              <li
                key={s.id}
                className="flex justify-between gap-4 border-b border-border pb-3 text-sm last:border-0 last:pb-0"
              >
                <span className="font-medium">
                  {s.position}. {s.title}
                </span>
                <span className="text-text-muted">
                  {s.status.replace('SECTION_STATUS_', '').toLowerCase()}
                  {s.score ? ` · ${s.score}` : ''}
                </span>
              </li>
            ))}
        </ul>
      </SectionCard>

      <SectionCard title="Оценки">
        {evaluations.length === 0 ? (
          <p className="text-[13px] text-text-muted">
            Оценок пока нет — возможно, задачи были пропущены.
          </p>
        ) : (
          <ul className="space-y-4">
            {evaluations.map((ev: EvaluationResult) => (
              <li key={ev.summary.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-text-muted">{ev.task_id.slice(0, 8)}…</span>
                  <span className={ev.summary.passed ? 'font-medium text-text-primary' : 'text-danger'}>
                    {ev.summary.score} · {ev.summary.passed ? 'pass' : 'fail'}
                  </span>
                </div>
                {ev.summary.summary ? (
                  <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
                    {ev.summary.summary}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <div className="flex flex-wrap gap-3">
        <Link to="/dashboard">
          <Button icon={<ArrowRight className="h-4 w-4" />}>На главную</Button>
        </Link>
        <Link to="/interview">
          <Button variant="secondary">Новое интервью</Button>
        </Link>
      </div>
    </PageContent>
  )
}
