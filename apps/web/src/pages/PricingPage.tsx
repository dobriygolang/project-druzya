import { useQuery } from '@tanstack/react-query'
import { PublicPageShell } from '@/components/brand/PublicNav'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { formatPlanLimitSpec, planLimitKeys } from '@/lib/billing/planLimits'
import { getBillingPlans } from '@/lib/api/billing'
import { useBillingLabels } from '@/lib/billingLabels'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { formatApiError } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'

export default function PricingPage() {
  const { t } = useI18n()
  const { entitlementLabel } = useBillingLabels()
  const plansQ = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    staleTime: 5 * 60_000,
  })

  const plans = plansQ.data?.plans ?? []
  const limitKeys = planLimitKeys(plans)

  return (
    <PublicPageShell>
      <PageContent>
        <header className="text-center">
          <Eyebrow className="text-site-muted">{t('pricing.eyebrow')}</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-site-text sm:text-4xl">
            {t('pricing.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-site-muted">{t('pricing.subtitle')}</p>
        </header>

        {plansQ.isError ? (
          <ErrorMessage message={formatApiError(plansQ.error)} onRetry={() => void plansQ.refetch()} />
        ) : null}

        {plansQ.isLoading ? (
          <div className="h-64 animate-pulse rounded-2xl border border-site-border bg-site-surface" />
        ) : null}

        {!plansQ.isLoading && plans.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-site-border bg-site-card">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-site-border">
                  <th className="px-5 py-4 font-medium text-site-muted">{t('pricing.limitColumn')}</th>
                  {plans.map((plan) => (
                    <th key={plan.slug} className="px-5 py-4 font-semibold text-site-text">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {limitKeys.map((key) => (
                  <tr key={key} className="border-b border-site-border last:border-b-0">
                    <td className="px-5 py-3.5 text-site-text">{entitlementLabel(key)}</td>
                    {plans.map((plan) => (
                      <td key={`${plan.slug}-${key}`} className="px-5 py-3.5 text-site-muted">
                        {formatPlanLimitSpec(plan.limits?.[key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!plansQ.isLoading && plans.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <article key={plan.slug} className="rounded-2xl border border-site-border bg-site-card p-6">
                <h2 className="text-lg font-semibold text-site-text">{plan.name}</h2>
                {plan.tagline ? <p className="mt-1 text-sm text-site-muted">{plan.tagline}</p> : null}
                {plan.highlights.length > 0 ? (
                  <ul className="mt-4 space-y-2 text-[13.5px] text-site-muted">
                    {plan.highlights.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="text-site-text">✓</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        <p className="text-center text-sm text-site-muted">{t('pricing.desktopNote')}</p>
      </PageContent>
    </PublicPageShell>
  )
}
