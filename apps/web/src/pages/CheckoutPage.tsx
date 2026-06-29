import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { PublicOrAuthedShell } from '@/components/brand/PublicOrAuthedShell'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { PageContent } from '@/components/PageContent'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { readAccessToken, formatApiError } from '@/lib/apiClient'
import { getBillingMe, getBillingPlans } from '@/lib/api/billing'
import { getMe } from '@/lib/api/auth'
import { useI18n } from '@/lib/i18n'

export default function CheckoutPage() {
  const { t } = useI18n()
  const { planSlug: paramSlug } = useParams<{ planSlug?: string }>()
  const [searchParams] = useSearchParams()
  const planSlug = (paramSlug ?? searchParams.get('plan') ?? 'pro_monthly').trim()
  const isAuthed = !!readAccessToken()
  const returnUrl = `${window.location.origin}/billing/welcome`

  const plansQ = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    staleTime: 5 * 60_000,
  })
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: isAuthed })
  const billingQ = useQuery({ queryKey: ['billing-me'], queryFn: getBillingMe, enabled: isAuthed })

  const plan = useMemo(
    () => (plansQ.data?.plans ?? []).find((p) => p.slug === planSlug),
    [plansQ.data?.plans, planSlug],
  )

  if (!isAuthed) {
    return <Navigate to={`/login?next=${encodeURIComponent(`/checkout/${planSlug}`)}`} replace />
  }

  if (billingQ.data?.plan_slug != null && billingQ.data.plan_slug !== 'free' && !billingQ.data.is_trialing) {
    return <Navigate to="/profile" replace />
  }

  const webUrl = plan?.checkout_url?.trim()
  const tgUrl = plan?.telegram_checkout_url?.trim()
  const hasCheckout = !!(webUrl || tgUrl)
  const hasTelegram = !!meQ.data?.telegram_id

  return (
    <PublicOrAuthedShell publicNav={{ centerLinks: [{ href: '/pricing', label: t('common.pricing') }] }}>
      <PageContent>
        <header className="text-center">
          <Eyebrow>{t('checkout.eyebrow')}</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t('checkout.title')}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-text-secondary">{t('checkout.subtitle')}</p>
        </header>

        {plansQ.isError ? (
          <ErrorMessage message={formatApiError(plansQ.error)} onRetry={() => void plansQ.refetch()} />
        ) : null}

        {plansQ.isLoading ? (
          <p className="text-center text-sm text-text-muted">{t('common.loading')}</p>
        ) : null}

        {plan ? (
          <article className="mx-auto max-w-md rounded-2xl border border-border bg-surface-1 p-7">
            <h2 className="text-xl font-semibold">{plan.name}</h2>
            <p className="mt-1 text-sm text-text-secondary">{plan.tagline}</p>
            <ul className="mt-5 space-y-2">
              {plan.highlights.slice(0, 4).map((line) => (
                <li key={line} className="flex gap-2 text-sm text-text-secondary">
                  <span>✓</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            {!hasTelegram ? (
              <p className="mt-6 text-center text-xs text-text-secondary">
                {t('pricing.linkTelegramFirst')}{' '}
                <Link to="/login" className="underline underline-offset-2">
                  {t('pricing.linkTelegramAction')}
                </Link>
              </p>
            ) : null}

            <div className="mt-6 space-y-3">
              {webUrl ? (
                <a href={webUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="primary" className="w-full" disabled={!hasTelegram}>
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
              {!hasCheckout ? (
                <p className="text-center text-xs text-text-muted">{t('pricing.checkoutUnavailable')}</p>
              ) : null}
            </div>

            <p className="mt-4 text-center text-[11px] text-text-muted">
              {t('checkout.returnHint', { url: returnUrl })}
            </p>
          </article>
        ) : plansQ.isSuccess ? (
          <p className="text-center text-sm text-text-muted">{t('checkout.planNotFound')}</p>
        ) : null}

        <p className="text-center text-sm">
          <Link to="/pricing" className="text-text-secondary underline underline-offset-2 hover:text-text-primary">
            {t('checkout.backToPricing')}
          </Link>
        </p>
      </PageContent>
    </PublicOrAuthedShell>
  )
}
