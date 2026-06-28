import { Gauge } from 'lucide-react'
import type { Dashboard } from '@/lib/types'

export function BackendReadinessCard({
  dashboard,
  loading,
  error,
}: {
  dashboard?: Dashboard | null
  loading?: boolean
  error?: boolean
}) {
  if (loading) {
    return (
      <section className="h-28 animate-pulse rounded-xl border border-border bg-surface-2" aria-hidden />
    )
  }

  if (error) {
    return (
      <section className="rounded-xl border border-border bg-surface-1 p-5">
        <p className="text-sm text-text-secondary">
          Не удалось загрузить readiness с backend. Проверь, что recommendation-service запущен.
        </p>
      </section>
    )
  }

  const score = dashboard?.readiness_score ?? 0
  const strengths = dashboard?.strengths ?? []

  return (
    <section className="rounded-xl border border-border bg-surface-1 p-5">
      <header className="mb-4 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-text-secondary" aria-hidden />
        <h2 className="font-display text-base font-bold">Readiness</h2>
      </header>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="font-display text-4xl font-bold tabular-nums">{score}</p>
          <p className="mt-1 text-xs text-text-muted">из 100 · recommendation service</p>
        </div>
        {strengths.length > 0 ? (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Сильные стороны</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {strengths.slice(0, 4).map((s) => (
                <li
                  key={s.skill_key}
                  className="rounded-full border border-border bg-surface-2 px-3 py-1 font-mono text-[11px] text-text-secondary"
                >
                  {s.skill_key} · {s.score}%
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[13px] text-text-muted">
            Пройди mock — readiness и сильные стороны появятся после оценки попыток.
          </p>
        )}
      </div>
    </section>
  )
}
