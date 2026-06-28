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

export default function DashboardPage() {
  const navigate = useNavigate()

  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
  const dashboardQ = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const retryQ = useQuery({ queryKey: ['retry-items'], queryFn: listRetryItems })

  const retryM = useMutation({
    mutationFn: (ids: string[]) => startRetrySession(ids),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  const today = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    })
  }, [])

  const username = meQ.data?.username ?? ''
  const pendingRetries = (retryQ.data?.items ?? []).filter(
    (i) => i.status === 'RETRY_ITEM_STATUS_PENDING',
  )

  return (
    <PageContent className="gap-8">
      <PageHeader
        eyebrow={today}
        title={username ? `Привет, ${username}` : 'Привет'}
        description={
          <>
            Рекомендации и прогресс — только с backend.{' '}
            <Link to="/mock" className="text-text-primary underline">
              Начать mock
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

      <ErrorBoundary section="Action cards">
        <section className="flex flex-col gap-5">
          <PageHeader
            eyebrow="Insights"
            title="Что делать сегодня"
            description="Карточки строятся из recommendation service после mock-сессий."
          />
          <TodayActionGrid dashboard={dashboardQ.data} loading={dashboardQ.isLoading} />
        </section>
      </ErrorBoundary>

      {pendingRetries.length > 0 ? (
        <SdvgCard eyebrow="Retry" title="Повтор ошибок">
          <p className="text-[13px] text-text-secondary">
            {pendingRetries.length} задач ждут повторной попытки.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            loading={retryM.isPending}
            onClick={() => retryM.mutate(pendingRetries.map((i) => i.id))}
          >
            Начать повтор
          </Button>
        </SdvgCard>
      ) : null}
    </PageContent>
  )
}
