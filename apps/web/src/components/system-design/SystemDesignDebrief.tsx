import type { EvaluationResult } from '@/lib/types'
import { useI18n } from '@/lib/i18n'

type CriterionRow = {
  key: string
  score: number
  max_score: number
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
}

function readCriteria(feedback: Record<string, unknown> | undefined): CriterionRow[] {
  const raw = feedback?.criteria
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const key = typeof row.key === 'string' ? row.key : ''
      const score = typeof row.score === 'number' ? row.score : Number(row.score)
      const maxScore = typeof row.max_score === 'number' ? row.max_score : Number(row.max_score)
      if (!key || Number.isNaN(score)) return null
      return { key, score, max_score: Number.isNaN(maxScore) ? 100 : maxScore }
    })
    .filter(Boolean) as CriterionRow[]
}

export function SystemDesignDebrief({
  ev,
  title,
}: {
  ev: EvaluationResult
  title?: string
}) {
  const { t } = useI18n()
  const feedback = ev.summary.feedback ?? {}
  const strengths = readStringList(feedback.strengths)
  const improvements = readStringList(feedback.improvements)
  const criteria = readCriteria(feedback)
  const visionUsed = feedback.vision_used === true

  return (
    <li className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-text-primary">{title ?? t('sdDebrief.title')}</p>
          <p className="text-[11px] text-text-muted">{t('sdDebrief.subtitle')}</p>
        </div>
        <span className={ev.summary.passed ? 'font-semibold text-brand-green' : 'font-semibold text-danger'}>
          {ev.summary.score} · {ev.summary.passed ? t('common.pass') : t('common.fail')}
        </span>
      </div>

      {ev.summary.summary ? (
        <p className="mt-3 text-[14px] leading-relaxed text-text-secondary">{ev.summary.summary}</p>
      ) : null}

      {visionUsed ? (
        <p className="mt-2 text-[11px] text-text-muted">{t('sdDebrief.visionUsed')}</p>
      ) : null}

      {criteria.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('sdDebrief.criteria')}</p>
          {criteria.map((c) => (
            <div key={c.key}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{c.key.replace(/_/g, ' ')}</span>
                <span className="tabular-nums">
                  {Math.round(c.score)}/{Math.round(c.max_score)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full bg-brand-green"
                  style={{ width: `${Math.min(100, (c.score / c.max_score) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {strengths.length > 0 ? (
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium text-brand-green">{t('sdDebrief.strengths')}</p>
          <ul className="list-inside list-disc space-y-1 text-[13px] text-text-secondary">
            {strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {improvements.length > 0 ? (
        <div className="mt-4">
          <p className="mb-1 text-xs font-medium text-danger">{t('sdDebrief.improvements')}</p>
          <ul className="list-inside list-disc space-y-1 text-[13px] text-text-secondary">
            {improvements.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  )
}
