import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/brand/SdvgCard'
import { BackendReadinessCard } from '@/components/today/BackendReadinessCard'
import { ErrorBoundary } from '@/components/today/ErrorBoundary'
import { TodayActionGrid } from '@/components/today/TodayActionGrid'
import { TodayPageShell } from '@/components/today/TodayPageShell'
import { TodayPlanCard } from '@/components/today/TodayPlanCard'
import { BillingUpsell } from '@/components/billing/BillingUpsell'
import { getMe } from '@/lib/api/auth'
import { getBillingMe } from '@/lib/api/billing'
import { getDashboard } from '@/lib/api/recommendation'
import { useI18n } from '@/lib/i18n'

export default function DashboardPage() {
  const { t, formatDate } = useI18n()

  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
  const billingQ = useQuery({ queryKey: ['billing-me'], queryFn: getBillingMe })
  const dashboardQ = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })

  const today = useMemo(
    () =>
      formatDate(new Date(), {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
      }),
    [formatDate],
  )

  const username = meQ.data?.username ?? ''

  const aiQuota = billingQ.data?.limits.ai_evaluations_per_day
  const showUpsell =
    billingQ.isSuccess &&
    billingQ.data?.plan_slug === 'free' &&
    aiQuota != null &&
    !aiQuota.unlimited &&
    aiQuota.limit != null &&
    aiQuota.used >= aiQuota.limit

  return (
    <TodayPageShell>
      <PageHeader
        eyebrow={today}
        title={username ? t('today.greetingNamed', { name: username }) : t('today.greeting')}
        description={
          <>
            {t('today.description')}{' '}
            <Link to="/mock" className="text-text-primary underline">
              {t('today.startMock')}
            </Link>
          </>
        }
      />

      {showUpsell ? <BillingUpsell /> : null}

      <BackendReadinessCard
        dashboard={dashboardQ.data}
        loading={dashboardQ.isLoading}
        error={dashboardQ.isError}
      />

      <TodayPlanCard />

      <ErrorBoundary message={t('today.errorSection', { section: t('today.insights.title') })}>
        <section className="flex flex-col gap-5">
          <PageHeader
            eyebrow={t('today.insights.eyebrow')}
            title={t('today.insights.title')}
            description={t('today.insights.description')}
          />
          <TodayActionGrid dashboard={dashboardQ.data} loading={dashboardQ.isLoading} />
        </section>
      </ErrorBoundary>
    </TodayPageShell>
  )
}
