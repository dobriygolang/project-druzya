import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorMessage } from '@/components/ErrorMessage'
import {
  completeLearningPlanItem,
  completeRecommendation,
  dismissLearningPlanItem,
  dismissRecommendation,
  getDashboard,
} from '@/lib/api/recommendation'
import { listRetryItems, startRetrySession } from '@/lib/api/interview'

export default function DashboardPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const dashboardQ = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard })
  const retryQ = useQuery({ queryKey: ['retry-items'], queryFn: listRetryItems })

  const completeRecM = useMutation({
    mutationFn: completeRecommendation,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dashboard'] }),
  })
  const dismissRecM = useMutation({
    mutationFn: dismissRecommendation,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dashboard'] }),
  })
  const completePlanM = useMutation({
    mutationFn: completeLearningPlanItem,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dashboard'] }),
  })
  const dismissPlanM = useMutation({
    mutationFn: dismissLearningPlanItem,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['dashboard'] }),
  })
  const retryM = useMutation({
    mutationFn: (ids: string[]) => startRetrySession(ids),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  if (dashboardQ.isLoading) {
    return <p className="text-sm text-text-muted">Загрузка…</p>
  }
  if (dashboardQ.isError) {
    return (
      <ErrorMessage
        message={dashboardQ.error instanceof Error ? dashboardQ.error.message : 'Ошибка загрузки'}
        onRetry={() => void dashboardQ.refetch()}
      />
    )
  }

  const d = dashboardQ.data
  if (!d) return <p className="text-sm text-text-muted">Нет данных.</p>

  const recommendations = d.recommendations ?? []
  const learningPlan = d.learning_plan ?? []
  const strengths = d.strengths ?? []
  const weaknesses = d.weaknesses ?? []

  const pendingRetries = (retryQ.data?.items ?? []).filter(
    (i) => i.status === 'RETRY_ITEM_STATUS_PENDING',
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Главная</h1>
        <p className="mt-1 text-sm text-text-muted">Твой прогресс и рекомендации по подготовке.</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Readiness" value={`${d.readiness_score ?? 0}%`} />
        <StatCard label="Задач на повтор" value={String(d.pending_retry_count ?? 0)} />
        <StatCard label="Рекомендаций" value={String(recommendations.length)} />
      </section>

      {d.profile_summary ? (
        <Card elevation="e2">
          <h2 className="font-medium">Профиль</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">{d.profile_summary}</p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <InsightList title="Сильные стороны" items={strengths} />
        <InsightList title="Зоны роста" items={weaknesses} />
      </div>

      {pendingRetries.length > 0 ? (
        <Card elevation="e2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Повтор ошибок</h2>
              <p className="mt-1 text-sm text-text-muted">
                {pendingRetries.length} задач ждут повторной попытки.
              </p>
            </div>
            <Button loading={retryM.isPending} onClick={() => retryM.mutate(pendingRetries.map((i) => i.id))}>
              Начать повтор
            </Button>
          </div>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-medium">Рекомендации</h2>
        {recommendations.length === 0 ? (
          <p className="text-sm text-text-muted">
            Пока нет рекомендаций.{' '}
            <Link to="/interview" className="underline">
              Пройди mock-интервью
            </Link>
            , чтобы получить персональный план.
          </p>
        ) : (
          recommendations.map((rec) => (
            <Card key={rec.id} elevation="e1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-muted">{rec.type}</p>
                  <h3 className="font-medium">{rec.title}</h3>
                  <p className="mt-1 text-sm text-text-muted">{rec.description}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" size="sm" onClick={() => completeRecM.mutate(rec.id)}>
                    Готово
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => dismissRecM.mutate(rec.id)}>
                    Скрыть
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-medium">План обучения</h2>
        {learningPlan.length === 0 ? (
          <p className="text-sm text-text-muted">План появится после первых интервью.</p>
        ) : (
          learningPlan.map((item) => (
            <Card key={item.id} elevation="e1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-text-muted">{item.type}</p>
                  <h3 className="font-medium">{item.title}</h3>
                  {item.description ? (
                    <p className="mt-1 text-sm text-text-muted">{item.description}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" size="sm" onClick={() => completePlanM.mutate(item.id)}>
                    Готово
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => dismissPlanM.mutate(item.id)}>
                    Скрыть
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card elevation="e2" padding="md">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  )
}

function InsightList({
  title,
  items,
}: {
  title: string
  items: { skill_key: string; score: number; confidence: number }[]
}) {
  return (
    <Card elevation="e2">
      <h2 className="font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">Недостаточно данных.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.skill_key} className="flex items-center justify-between text-sm">
              <span className="mono">{item.skill_key}</span>
              <span className="text-text-muted">
                {item.score} · conf {item.confidence}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
