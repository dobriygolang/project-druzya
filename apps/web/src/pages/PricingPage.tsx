import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { PublicNav, PublicPageShell } from '@/components/brand/PublicNav'
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
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { formatApiError } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'
import type { BillingMe, PlanCatalogEntry } from '@/lib/types'

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
    <PublicPageShell>
      <PublicNav centerLinks={[{ href: '/welcome', label: t('public.home') }]} />

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
    </PublicPageShell>
  )
}

function PlanCheckoutActions({
  plan,
  isAuthed,
  isCurrent,
  hasTelegram,
  meLoading,
  billing,
  trialLoading,
  trialError,
  onStartTrial,
}: {
  plan: PlanCatalogEntry
  isAuthed: boolean
  isCurrent: boolean
  hasTelegram: boolean
  meLoading: boolean
  billing?: BillingMe
  trialLoading: boolean
  trialError: string | null
  onStartTrial: () => void | Promise<void>
}) {
  const { t } = useI18n()
  const returnUrl = `${window.location.origin}/pricing?paid=1`
  const trialDays = plan.trial_days ?? billing?.trial_days ?? 14
  const showTrialStart = !!billing?.trial_available && !billing?.is_trialing
  const isTrialing = !!billing?.is_trialing

  if (!isAuthed) {
    return (
      <Link to="/login?next=/pricing" className="mt-6 block">
        <Button variant={plan.highlight ? 'primary' : 'ghost'} className="w-full">
          {plan.slug === 'free' ? t('pricing.startFree') : t('pricing.loginForPro')}
        </Button>
      </Link>
    )
  }

  if (plan.slug === 'free' || (isCurrent && !isTrialing)) {
    return null
  }

  const webUrl = plan.checkout_url?.trim()
  const tgUrl = plan.telegram_checkout_url?.trim()
  const hasCheckout = !!(webUrl || tgUrl)

  if (meLoading) {
    return <p className="mt-6 text-center text-xs text-text-muted">{t('common.loading')}</p>
  }

  return (
    <div className="mt-6 space-y-3">
      {showTrialStart ? (
        <>
          <Button variant="primary" className="w-full" disabled={trialLoading} onClick={() => void onStartTrial()}>
            {trialLoading ? t('common.loading') : t('pricing.startTrial', { days: trialDays })}
          </Button>
          {trialError ? <p className="text-center text-xs text-danger">{trialError}</p> : null}
          <p className="text-center text-[11px] text-text-muted">{t('pricing.trialThenPay', { days: trialDays })}</p>
        </>
      ) : null}

      {isTrialing ? (
        <p className="text-center text-xs text-text-secondary">{t('pricing.trialActivePayHint')}</p>
      ) : null}

      {!showTrialStart && !hasCheckout && !isTrialing ? (
        <p className="mt-6 text-center text-xs text-text-muted">{t('pricing.checkoutUnavailable')}</p>
      ) : null}

      {(isTrialing || !showTrialStart) && hasCheckout ? (
        <>
          {!hasTelegram ? (
            <p className="text-center text-xs text-text-secondary">
              {t('pricing.linkTelegramFirst')}{' '}
              <Link to="/login" className="underline underline-offset-2 hover:text-text-primary">
                {t('pricing.linkTelegramAction')}
              </Link>
            </p>
          ) : null}
          {webUrl ? (
            <a href={webUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant={showTrialStart ? 'ghost' : 'primary'} className="w-full" disabled={!hasTelegram}>
                {t('pricing.subscribeWeb')}
              </Button>
            </a>
          ) : null}
          {tgUrl ? (
            <a href={tgUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button variant="ghost" className="w-full" disabled={!hasTelegram}>
                {t('pricing.subscribeTelegram')}
              </Button>
            </a>
          ) : null}
          {!isTrialing ? (
            <p className="text-center text-[11px] text-text-muted">
              {t('pricing.returnAfterPay', { url: returnUrl })}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function PlanCardSkeleton() {
  return (
    <div className="h-[320px] animate-pulse rounded-2xl border bg-surface-2" style={{ borderColor: brand.hair }} />
  )
}
