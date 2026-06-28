import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader, SdvgCard } from '@/components/brand/SdvgCard'
import { Button } from '@/components/ui/Button'
import { PageContent } from '@/components/PageContent'
import { BackendReadinessCard } from '@/components/today/BackendReadinessCard'
import { ErrorBoundary } from '@/components/today/ErrorBoundary'
import { LearningPlanCard } from '@/components/today/LearningPlanCard'
import { TodayActionGrid } from '@/components/today/TodayActionGrid'
import { getMe } from '@/lib/api/auth'
import { getDashboard } from '@/lib/api/recommendation'
import { listRetryItems, startRetrySession } from '@/lib/api/interview'
import { useI18n } from '@/lib/i18n'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { t, formatDate } = useI18n()

  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
  const dashboardQ = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const retryQ = useQuery({ queryKey: ['retry-items'], queryFn: listRetryItems })

  const retryM = useMutation({
    mutationFn: (ids: string[]) => startRetrySession(ids),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

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
  const pendingRetries = (retryQ.data?.items ?? []).filter(
    (i) => i.status === 'RETRY_ITEM_STATUS_PENDING',
  )

  return (
    <PageContent className="gap-8">
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

      <BackendReadinessCard
        dashboard={dashboardQ.data}
        loading={dashboardQ.isLoading}
        error={dashboardQ.isError}
      />

      <LearningPlanCard items={dashboardQ.data?.learning_plan ?? []} loading={dashboardQ.isLoading} />

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

      {pendingRetries.length > 0 ? (
        <SdvgCard eyebrow={t('today.retry.eyebrow')} title={t('today.retry.title')}>
          <p className="text-[13px] text-text-secondary">
            {t('today.retry.pending', { count: pendingRetries.length })}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            loading={retryM.isPending}
            onClick={() => retryM.mutate(pendingRetries.map((i) => i.id))}
          >
            {t('today.retry.start')}
          </Button>
        </SdvgCard>
      ) : null}
    </PageContent>
  )
}
