import { brand } from '@/lib/brand/tokens'
import { SdvgCard } from '@/components/brand/SdvgCard'
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
      <section className="sdvg-card h-36 animate-pulse bg-surface-2 p-6" aria-hidden />
    )
  }

  if (error) {
    return (
      <SdvgCard eyebrow="Readiness" title="Не удалось загрузить">
        <p className="text-sm text-text-secondary">
          Проверь, что recommendation-service запущен.
        </p>
      </SdvgCard>
    )
  }

  const score = dashboard?.readiness_score ?? 0
  const strengths = dashboard?.strengths ?? []

  return (
    <SdvgCard eyebrow="Readiness" title="Готовность к собесу" lift={false}>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-[120px]">
          <p className="text-[clamp(2rem,5vw,2.75rem)] font-semibold tabular-nums leading-none tracking-[-0.03em]">
            {score}
            <span className="text-lg font-normal text-text-muted">%</span>
          </p>
          <p className="mt-2 text-[13px] text-text-secondary">recommendation service</p>
        </div>
        <div className="min-w-[200px] flex-1">
          <div className="relative h-1 overflow-hidden rounded-full bg-[rgba(76,179,92,0.15)]">
            <span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, score))}%`, background: brand.green }}
            />
          </div>
        </div>
      </div>

      {strengths.length > 0 ? (
        <div className="mt-6 border-t border-border pt-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
            Сильные стороны
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {strengths.slice(0, 4).map((s) => (
              <li
                key={s.skill_key}
                className="sdvg-pill font-mono text-[11px] tracking-[0.04em]"
              >
                {s.skill_key} · {s.score}%
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-5 text-[13px] leading-relaxed text-text-secondary">
          Пройди mock — readiness и сильные стороны появятся после оценки попыток.
        </p>
      )}
    </SdvgCard>
  )
}
