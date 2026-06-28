import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
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
    <PageContent>
      <header className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
          {today}
        </span>
        <h1 className="font-display text-3xl font-bold leading-tight">
          {username ? `Привет, ${username}` : 'Привет'}
        </h1>
        <p className="text-[14px] text-text-secondary">
          Рекомендации и прогресс — только с backend.{' '}
          <Link to="/mock" className="underline">
            Начать mock
          </Link>
        </p>
      </header>

      <BackendReadinessCard
        dashboard={dashboardQ.data}
        loading={dashboardQ.isLoading}
        error={dashboardQ.isError}
      />

      <LearningPlanCard items={dashboardQ.data?.learning_plan ?? []} loading={dashboardQ.isLoading} />

      <ErrorBoundary section="Action cards">
        <TodayActionGrid dashboard={dashboardQ.data} loading={dashboardQ.isLoading} />
      </ErrorBoundary>

      {pendingRetries.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface-1 p-5">
          <header className="mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-text-secondary" aria-hidden />
            <h2 className="font-display text-base font-bold">Повтор ошибок</h2>
          </header>
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
        </section>
      ) : null}
    </PageContent>
  )
}
