import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PublicNav, PublicPageShell } from '@/components/brand/PublicNav'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { brand } from '@/lib/brand/tokens'
import { readAccessToken } from '@/lib/apiClient'
import { getBillingMe } from '@/lib/api/billing'
import { PLAN_CATALOG } from '@/lib/billing/planCatalog'
import {
  entitlementLabel,
  formatLimitUsage,
  formatPlanName,
  sortLimitEntries,
} from '@/lib/billingLabels'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { formatApiError } from '@/lib/apiClient'

export default function PricingPage() {
  const isAuthed = !!readAccessToken()
  const billingQ = useQuery({
    queryKey: ['billing-me'],
    queryFn: getBillingMe,
    enabled: isAuthed,
  })

  return (
    <PublicPageShell>
      <PublicNav centerLinks={[{ href: '/welcome', label: 'Главная' }]} />

      <PageContent>
        <header className="text-center">
          <Eyebrow>Тарифы</Eyebrow>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Free хватит, чтобы попробовать
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-text-secondary">
            Лимиты ниже — из billing service (plan entitlements). Твой текущий расход виден после входа.
          </p>
        </header>

        {isAuthed && billingQ.isLoading ? (
          <p className="text-center text-sm text-text-muted">Загрузка подписки…</p>
        ) : null}

        {isAuthed && billingQ.isError ? (
          <ErrorMessage message={formatApiError(billingQ.error)} onRetry={() => void billingQ.refetch()} />
        ) : null}

        {isAuthed && billingQ.data ? (
          <section className="sdvg-card p-5">
            <h2 className="text-base font-semibold">Твой план</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {formatPlanName(billingQ.data.plan_name, billingQ.data.plan_slug)}
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
          {PLAN_CATALOG.map((plan) => {
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
                    <span className="ml-2 text-xs font-normal text-text-muted">(текущий)</span>
                  ) : null}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">{plan.tagline}</p>
                <ul className="mt-5 space-y-2.5">
                  {plan.highlights.map((line) => (
                    <li key={line} className="flex gap-2 text-[13.5px] text-text-secondary">
                      <span className="text-text-primary">✓</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                {!isAuthed ? (
                  <Link to="/login?next=/pricing" className="mt-6 block">
                    <Button variant={plan.highlight ? 'primary' : 'ghost'} className="w-full">
                      {plan.slug === 'free' ? 'Начать бесплатно' : 'Войти для Pro'}
                    </Button>
                  </Link>
                ) : plan.slug !== 'free' && !isCurrent ? (
                  <p className="mt-6 text-center text-xs text-text-muted">Checkout — см. блок ниже</p>
                ) : null}
              </article>
            )
          })}
        </div>

        <section className="mt-10 rounded-2xl border border-dashed border-border bg-surface-2 px-5 py-4 text-center">
          <p className="text-sm text-text-secondary">
            Оплата Pro через Tribute — UI checkout в разработке. Сейчас Pro выдаётся через admin grant
            на backend.
          </p>
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
