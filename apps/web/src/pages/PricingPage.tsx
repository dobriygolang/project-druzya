import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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

const INK = '#0F0F0F'
const INK_60 = '#5B5B5B'
const HAIR = 'rgba(15,15,15,0.08)'

export default function PricingPage() {
  const isAuthed = !!readAccessToken()
  const billingQ = useQuery({
    queryKey: ['billing-me'],
    queryFn: getBillingMe,
    enabled: isAuthed,
  })

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#0F0F0F]">
      <header className="border-b border-[rgba(15,15,15,0.08)] px-6 py-5 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link to="/welcome" className="inline-flex items-center gap-2 no-underline">
            <span className="h-[7px] w-[7px] rounded-full bg-danger" />
            <span className="text-sm font-medium">druz9.online</span>
          </Link>
          <Link to={isAuthed ? '/profile' : '/login'} className="text-sm text-[#5B5B5B] no-underline">
            {isAuthed ? 'Профиль' : 'Войти'}
          </Link>
        </div>
      </header>

      <PageContent className="max-w-4xl">
        <header className="text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">Тарифы</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
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
          <section className="rounded-xl border border-border bg-surface-1 p-5">
            <h2 className="font-display text-base font-bold">Твой план</h2>
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
                className="relative rounded-2xl border bg-white p-7"
                style={{
                  borderColor: plan.highlight ? 'rgba(15,15,15,0.18)' : HAIR,
                }}
              >
                {plan.highlight ? (
                  <span
                    className="absolute right-6 top-6 h-0.5 w-6 bg-danger"
                    aria-hidden
                  />
                ) : null}
                <h2 className="text-xl font-semibold" style={{ color: INK }}>
                  {plan.name}
                  {isCurrent ? (
                    <span className="ml-2 text-xs font-normal text-text-muted">(текущий)</span>
                  ) : null}
                </h2>
                <p className="mt-1 text-sm" style={{ color: INK_60 }}>
                  {plan.tagline}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {plan.highlights.map((line) => (
                    <li
                      key={line}
                      className="flex gap-2 text-[13.5px]"
                      style={{ color: INK_60 }}
                    >
                      <span style={{ color: INK }}>✓</span>
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
                  <p className="mt-6 text-center text-xs text-text-muted">
                    Checkout — см. блок ниже
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>

        <section className="mt-10 rounded-xl border border-dashed border-border bg-surface-1 px-5 py-4 text-center">
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
    </div>
  )
}
