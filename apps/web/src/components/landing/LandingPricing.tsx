import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { brand } from '@/lib/brand/tokens'
import { getBillingPlans } from '@/lib/api/billing'
import { readAccessToken } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'

export function LandingPricing() {
  const { t } = useI18n()
  const isAuthed = !!readAccessToken()
  const plansQ = useQuery({
    queryKey: ['billing-plans'],
    queryFn: getBillingPlans,
    staleTime: 5 * 60_000,
  })

  return (
    <section id="pricing" className="border-t border-border bg-surface-2/40 px-6 py-24 sm:px-8">
      <div className="mx-auto max-w-[760px]">
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.22em] text-text-muted">
          {t('welcome.pricingEyebrow')}
        </p>
        <h2 className="mt-4 text-center text-[clamp(1.75rem,4vw,2.25rem)] font-semibold tracking-[-0.03em]">
          {t('welcome.pricingTitle')}
        </h2>
        <p className="mx-auto mt-4 max-w-[48ch] text-center text-[15px] leading-relaxed text-text-secondary">
          {t('welcome.pricingBody')}
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {plansQ.isLoading ? (
            <>
              <div className="h-[260px] animate-pulse rounded-2xl bg-surface-2" />
              <div className="h-[260px] animate-pulse rounded-2xl bg-surface-2" />
            </>
          ) : null}
          {(plansQ.data?.plans ?? []).map((plan) => {
            const ctaTo =
              plan.slug === 'free'
                ? isAuthed
                  ? '/profile'
                  : '/login'
                : isAuthed
                  ? '/pricing'
                  : '/login?next=/pricing'
            const ctaLabel =
              plan.slug === 'free'
                ? isAuthed
                  ? t('public.account')
                  : t('public.startFree')
                : isAuthed
                  ? t('pricing.subscribeCta')
                  : t('pricing.loginForPro')

            return (
              <div
                key={plan.slug}
                className="relative rounded-2xl border bg-surface-1 p-7"
                style={{ borderColor: plan.highlight ? brand.hairStrong : brand.hair }}
              >
                {plan.highlight ? (
                  <span className="absolute right-6 top-6 h-0.5 w-6 bg-danger" aria-hidden />
                ) : null}
                <div className="text-xl font-semibold">{plan.name}</div>
                <div className="mt-1.5 text-[13px] text-text-secondary">{plan.tagline}</div>
                <ul className="my-5 flex flex-col gap-2.5">
                  {plan.highlights.map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-[13.5px] text-text-secondary">
                      <span className="text-text-primary">✓</span>
                      {line}
                    </li>
                  ))}
                </ul>
                <Link
                  to={ctaTo}
                  className="flex w-full items-center justify-center rounded-[10px] px-[18px] py-[11px] text-sm font-medium no-underline"
                  style={{
                    background: plan.highlight ? brand.ink : 'transparent',
                    color: plan.highlight ? brand.bg : brand.ink,
                    border: plan.highlight ? 'none' : `1px solid ${brand.hair}`,
                  }}
                >
                  {ctaLabel}
                </Link>
              </div>
            )
          })}
        </div>

        <p className="mt-6 text-center text-[13px] text-text-muted">
          <Link to="/pricing" className="text-text-primary underline">
            {t('welcome.pricingMore')}
          </Link>
        </p>
      </div>
    </section>
  )
}
