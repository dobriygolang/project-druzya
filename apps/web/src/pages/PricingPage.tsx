import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { PublicOrAuthedShell } from '@/components/brand/PublicOrAuthedShell'
import { PlanCheckoutActions } from '@/components/billing/PlanCheckoutActions'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { brand } from '@/lib/brand/tokens'
import { readAccessToken } from '@/lib/apiClient'
import { getBillingMe, getBillingPlans, startProTrial } from '@/lib/api/billing'
import { getMe } from '@/lib/api/auth'
import {
  formatPlanName,
  sortLimitEntries,
  useBillingLabels,
} from '@/lib/billingLabels'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { formatApiError } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'

export default function PricingPage() {
  const { t, formatDate } = useI18n()
  const { entitlementLabel, formatLimitUsage } = useBillingLabels()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const isAuthed = !!readAccessToken()
  const paidReturn = searchParams.get('paid') === '1'

  const billingQ = useQuery({
    queryKey: ['billing-me'],
    queryFn: getBillingMe,
    enabled: isAuthed,
  })
  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: isAuthed,
  })
  const plansQ = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    staleTime: 5 * 60_000,
  })

  const isProActive = billingQ.data?.plan_slug != null && billingQ.data.plan_slug !== 'free'
  const isTrialing = !!billingQ.data?.is_trialing
  const trialEndLabel =
    billingQ.data?.trial_end != null
      ? formatDate(new Date(billingQ.data.trial_end), { day: 'numeric', month: 'long', year: 'numeric' })
      : null

  const trialMutation = useMutation({
    mutationFn: startProTrial,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['billing-me'] })
    },
  })
  const [trialError, setTrialError] = useState<string | null>(null)

  useEffect(() => {
    if (!paidReturn || !isAuthed) return
    let attempts = 0
    const id = window.setInterval(() => {
      attempts += 1
      void queryClient.invalidateQueries({ queryKey: ['billing-me'] })
      if (attempts >= 15) window.clearInterval(id)
    }, 2000)
    return () => window.clearInterval(id)
  }, [paidReturn, isAuthed, queryClient])

  useEffect(() => {
    if (!paidReturn || !isProActive) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('paid')
        return next
      },
      { replace: true },
    )
  }, [paidReturn, isProActive, setSearchParams])

  return (
    <PublicOrAuthedShell publicNav={{ centerLinks: [{ href: '/welcome', label: t('public.home') }] }}>
      <PageContent>
        <header className="text-center">
          <Eyebrow>{t('pricing.eyebrow')}</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{t('pricing.title')}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-text-secondary">
            {t('pricing.subtitle')}
          </p>
        </header>

        {paidReturn && isAuthed ? (
          <div
            className="rounded-xl border px-4 py-3 text-center text-sm"
            style={{
              borderColor: isProActive ? brand.hairStrong : brand.hair,
              backgroundColor: isProActive ? 'rgba(76,179,92,0.08)' : undefined,
            }}
          >
            {isProActive ? t('pricing.paymentSuccess') : t('pricing.paymentPending')}
          </div>
        ) : null}

        {isAuthed && billingQ.isLoading ? (
          <p className="text-center text-sm text-text-muted">{t('billing.loading')}</p>
        ) : null}

        {isAuthed && billingQ.isError ? (
          <ErrorMessage message={formatApiError(billingQ.error)} onRetry={() => void billingQ.refetch()} />
        ) : null}

        {plansQ.isError ? (
          <ErrorMessage message={formatApiError(plansQ.error)} onRetry={() => void plansQ.refetch()} />
        ) : null}

        {isAuthed && billingQ.data ? (
          <section className="sdvg-card p-5">
            <h2 className="text-base font-semibold">{t('billing.yourPlan')}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {formatPlanName(billingQ.data.plan_name, billingQ.data.plan_slug)}
              {isTrialing && trialEndLabel ? (
                <span className="block text-xs text-text-muted">{t('pricing.trialUntil', { date: trialEndLabel })}</span>
              ) : null}
            </p>
            <ul className="mt-4 space-y-2">
              {sortLimitEntries(Object.entries(billingQ.data.limits)).map(([key, lim]) => (
                <li key={key} className="flex justify-between gap-4 text-sm">
                  <span>{entitlementLabel(key)}</span>
                  <span className="text-text-muted">{formatLimitUsage(key, lim)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {plansQ.isLoading ? (
            <>
              <PlanCardSkeleton />
              <PlanCardSkeleton />
            </>
          ) : null}
          {(plansQ.data?.plans ?? []).map((plan) => {
            const isCurrent = billingQ.data?.plan_slug === plan.slug
            return (
              <article
                key={plan.slug}
                className="relative rounded-2xl border bg-surface-1 p-7"
                style={{ borderColor: plan.highlight ? brand.hairStrong : brand.hair }}
              >
                {plan.highlight ? (
                  <span className="absolute right-6 top-6 h-0.5 w-6 bg-danger" aria-hidden />
                ) : null}
                <h2 className="text-xl font-semibold">
                  {plan.name}
                  {isCurrent ? (
                    <span className="ml-2 text-xs font-normal text-text-muted">{t('common.current')}</span>
                  ) : null}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">{plan.tagline}</p>
                {plan.trial_days && plan.trial_days > 0 ? (
                  <p className="mt-3 inline-block rounded-full bg-[rgba(76,179,92,0.12)] px-3 py-1 text-xs font-medium text-text-primary">
                    {t('pricing.trialBadge', { days: plan.trial_days })}
                  </p>
                ) : null}
                <ul className="mt-5 space-y-2.5">
                  {plan.highlights.map((line) => (
                    <li key={line} className="flex gap-2 text-[13.5px] text-text-secondary">
                      <span className="text-text-primary">✓</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                <PlanCheckoutActions
                  plan={plan}
                  isAuthed={isAuthed}
                  isCurrent={isCurrent}
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
              </article>
            )
          })}
        </div>

        <section className="mt-10 rounded-2xl border border-dashed border-border bg-surface-2 px-5 py-4 text-center">
          <p className="text-sm text-text-secondary">{t('pricing.paymentNote')}</p>
          {import.meta.env.DEV ? (
            <p className="mt-2 font-mono text-[11px] text-text-muted">
              POST /v1/billing/webhooks/tribute · POST /v1/billing/admin/subscriptions/grant
            </p>
          ) : null}
        </section>
      </PageContent>
    </PublicOrAuthedShell>
  )
}

function PlanCardSkeleton() {
  return (
    <div className="h-[320px] animate-pulse rounded-2xl border bg-surface-2" style={{ borderColor: brand.hair }} />
  )
}
