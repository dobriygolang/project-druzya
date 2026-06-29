import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, CreditCard, ListChecks, Sparkles } from 'lucide-react'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { SdvgCard } from '@/components/brand/SdvgCard'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { PlanCheckoutActions } from '@/components/billing/PlanCheckoutActions'
import { getBillingMe, getBillingPlans, startProTrial } from '@/lib/api/billing'
import { getMe } from '@/lib/api/auth'
import { formatApiError } from '@/lib/apiClient'
import { UserAvatar } from '@/components/UserAvatar'
import {
  formatPlanName,
  limitProgressPct,
  sortLimitEntries,
  useBillingLabels,
} from '@/lib/billingLabels'
import { useI18n } from '@/lib/i18n'

export default function ProfilePage() {
  const { t, formatDate } = useI18n()
  const { entitlementLabel, formatLimitUsage } = useBillingLabels()
  const queryClient = useQueryClient()
  const [trialError, setTrialError] = useState<string | null>(null)
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
  const billingQ = useQuery({ queryKey: ['billing-me'], queryFn: getBillingMe })
  const plansQ = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    staleTime: 5 * 60_000,
  })

  const trialMutation = useMutation({
    mutationFn: startProTrial,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing-me'] })
    },
  })

  if (meQ.isLoading) {
    return (
      <PageContent>
        <div className="animate-pulse space-y-5">
          <div className="h-4 w-24 rounded bg-surface-2" />
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-surface-2" />
            <div className="space-y-2">
              <div className="h-7 w-40 rounded bg-surface-2" />
              <div className="h-4 w-32 rounded bg-surface-2" />
            </div>
          </div>
        </div>
      </PageContent>
    )
  }

  if (meQ.isError) {
    return (
      <PageContent>
        <ErrorMessage message={formatApiError(meQ.error)} onRetry={() => void meQ.refetch()} />
      </PageContent>
    )
  }

  const user = meQ.data
  if (!user) return null

  const username = user.username
  const memberSince = user.created_at
    ? formatDate(new Date(user.created_at), { month: 'long', year: 'numeric' })
    : null
  const limitEntries = billingQ.data ? sortLimitEntries(Object.entries(billingQ.data.limits)) : []
  const proPlan = (plansQ.data?.plans ?? []).find((p) => p.highlight) ?? (plansQ.data?.plans ?? []).find((p) => p.slug !== 'free')
  const isProActive = billingQ.data?.plan_slug != null && billingQ.data.plan_slug !== 'free' && !billingQ.data.is_trialing
  const showUpgrade = billingQ.data && !isProActive && proPlan

  return (
    <PageContent className="gap-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-1 text-xl font-semibold">
            <UserAvatar name={username} avatarUrl={user.avatar_url} className="h-16 w-16" textClassName="text-xl" />
          </div>
          <div>
            <Eyebrow>{t('profile.eyebrow')}</Eyebrow>
            <h1 className="mt-1 text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.02em]">
              @{username}
            </h1>
            {memberSince ? (
              <p className="mt-1 text-[14px] text-text-secondary">
                {t('profile.memberSince', { date: memberSince })}
              </p>
            ) : null}
          </div>
        </div>
        <Link to="/pricing">
          <Button variant="ghost" size="sm" icon={<CreditCard className="h-4 w-4" />}>
            {t('common.pricing')}
          </Button>
        </Link>
      </header>

      <QuickLinksCard t={t} />

      {billingQ.isLoading ? (
        <SdvgCard eyebrow={t('billing.eyebrow')} title={t('billing.title')}>
          <p className="text-sm text-text-muted">{t('common.loading')}</p>
        </SdvgCard>
      ) : billingQ.isError ? (
        <SdvgCard eyebrow={t('billing.eyebrow')} title={t('billing.title')}>
          <ErrorMessage
            message={formatApiError(billingQ.error)}
            onRetry={() => void billingQ.refetch()}
          />
        </SdvgCard>
      ) : billingQ.data ? (
        <SdvgCard eyebrow={t('billing.eyebrow')} title={t('billing.title')}>
          <p className="text-[15px]">
            {t('billing.plan')}:{' '}
            <span className="font-medium">
              {formatPlanName(billingQ.data.plan_name, billingQ.data.plan_slug)}
            </span>
          </p>
          {limitEntries.length > 0 ? (
            <ul className="mt-5 space-y-5">
              {limitEntries.map(([key, lim]) => {
                const pct = limitProgressPct(lim)
                const exhausted = pct === 100
                return (
                  <li key={key}>
                    <div className="flex items-baseline justify-between gap-4 text-sm">
                      <span>{entitlementLabel(key)}</span>
                      <span className={exhausted ? 'text-danger' : 'text-text-muted'}>
                        {formatLimitUsage(key, lim)}
                      </span>
                    </div>
                    {pct != null ? (
                      <div
                        className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(76,179,92,0.15)]"
                        role="progressbar"
                        aria-valuenow={lim.used}
                        aria-valuemin={0}
                        aria-valuemax={lim.limit ?? lim.used}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: exhausted ? brand.dot : brand.green,
                          }}
                        />
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-text-muted">{t('billing.noLimits')}</p>
          )}
          {showUpgrade && proPlan ? (
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-1 text-sm font-medium">{t('billing.upgradeTitle')}</p>
              <p className="text-[13px] text-text-secondary">{t('billing.upgradeHint')}</p>
              <PlanCheckoutActions
                plan={proPlan}
                isAuthed
                isCurrent={billingQ.data?.plan_slug === proPlan.slug}
                hasTelegram={!!meQ.data?.telegram_id}
                meLoading={meQ.isLoading}
                billing={billingQ.data}
                trialLoading={trialMutation.isPending}
                trialError={trialError}
                onStartTrial={async () => {
                  setTrialError(null)
                  try {
                    await trialMutation.mutateAsync()
                  } catch (err) {
                    setTrialError(formatApiError(err))
                  }
                }}
              />
            </div>
          ) : null}
        </SdvgCard>
      ) : null}
    </PageContent>
  )
}

function QuickLinksCard({
  t,
}: {
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const links = [
    {
      to: '/mock',
      label: t('profile.quickLinks.mockLabel'),
      hint: t('profile.quickLinks.mockHint'),
      icon: Sparkles,
    },
    {
      to: '/today',
      label: t('profile.quickLinks.todayLabel'),
      hint: t('profile.quickLinks.todayHint'),
      icon: ListChecks,
    },
  ]

  return (
    <SdvgCard eyebrow={t('profile.quickLinks.eyebrow')} title={t('profile.quickLinks.title')}>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 no-underline transition-colors hover:border-border-strong"
            >
              <l.icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted group-hover:text-text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-text-primary">{l.label}</span>
                <span className="block text-[12.5px] text-text-muted">{l.hint}</span>
              </span>
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-text-muted group-hover:text-text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </SdvgCard>
  )
}
