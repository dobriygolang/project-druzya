import { Link } from 'react-router-dom'
import { ArrowRight, Loader2, Target } from 'lucide-react'
import { SdvgCard } from '@/components/brand/SdvgCard'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { DailyBriefCard } from '@/components/today/DailyBriefCard'
import { skillLabel, useI18n } from '@/lib/i18n'
import type { Dashboard } from '@/lib/types'

function ActionCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <SdvgCard eyebrow={eyebrow} title={title} className="h-full">
      {children}
    </SdvgCard>
  )
}

export function TodayActionGrid({
  dashboard,
  loading,
}: {
  dashboard?: Dashboard | null
  loading?: boolean
}) {
  const { t } = useI18n()

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="sdvg-card h-40 animate-pulse bg-surface-2" />
        ))}
      </div>
    )
  }

  const recommendations = dashboard?.recommendations ?? []
  const weaknesses = dashboard?.weaknesses ?? []

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <ActionCard eyebrow={t('today.actions.mockEyebrow')} title={t('today.actions.mockTitle')}>
        <p className="text-[13px] leading-relaxed text-text-secondary">{t('today.actions.mockBody')}</p>
        <Link to="/mock" className="mt-4 inline-block">
          <Button
            variant="primary"
            size="sm"
            icon={<Target className="h-4 w-4" />}
            iconRight={<ArrowRight className="h-4 w-4" />}
          >
            {t('today.actions.mockCta')}
          </Button>
        </Link>
      </ActionCard>

      <ActionCard eyebrow={t('today.actions.insightEyebrow')} title={t('today.actions.insightTitle')}>
        {recommendations.length === 0 ? (
          <p className="text-[13px] text-text-muted">{t('today.actions.insightEmpty')}</p>
        ) : (
          <div className="relative pl-3.5">
            <span
              className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full"
              style={{ background: brand.dot }}
              aria-hidden
            />
            <p className="text-[14px] font-medium">{recommendations[0]?.title}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
              {recommendations[0]?.description}
            </p>
          </div>
        )}
      </ActionCard>

      <ActionCard eyebrow={t('today.actions.briefEyebrow')} title={t('today.actions.briefTitle')}>
        <DailyBriefCard brief={dashboard?.daily_brief} />
      </ActionCard>

      <ActionCard eyebrow={t('today.actions.focusEyebrow')} title={t('today.actions.focusTitle')}>
        {weaknesses.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-text-secondary">{t('today.actions.focusEmpty')}</p>
            <Link to="/mock">
              <Button variant="ghost" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
                {t('today.actions.focusMock')}
              </Button>
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {weaknesses.slice(0, 3).map((w) => (
              <li
                key={w.skill_key}
                className="relative rounded-xl border border-border bg-surface-2 px-3 py-2.5 pl-4"
              >
                <span
                  className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r"
                  style={{ background: brand.warn }}
                  aria-hidden
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium">{skillLabel(t, w.skill_key)}</span>
                  <span className="font-mono text-[11px] tabular-nums text-text-muted">{w.score}%</span>
                </div>
                <Link
                  to="/mock"
                  className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary no-underline hover:text-text-primary"
                >
                  <Target className="h-3 w-3" /> mock
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ActionCard>
    </div>
  )
}

export function TodayActionGridSkeleton() {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2 text-[12px] text-text-muted">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('today.actions.loading')}
    </div>
  )
}
