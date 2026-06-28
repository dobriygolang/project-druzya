import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Brain, RefreshCw, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { SectionCard } from '@/components/SectionCard'
import { getMe } from '@/lib/api/auth'
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

  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
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

  const today = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    })
  }, [])

  if (dashboardQ.isLoading) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">Загрузка…</p>
      </PageContent>
    )
  }
  if (dashboardQ.isError) {
    return (
      <PageContent>
        <ErrorMessage
          message={dashboardQ.error instanceof Error ? dashboardQ.error.message : 'Ошибка загрузки'}
          onRetry={() => void dashboardQ.refetch()}
        />
      </PageContent>
    )
  }

  const d = dashboardQ.data
  if (!d) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">Нет данных.</p>
      </PageContent>
    )
  }

  const recommendations = d.recommendations ?? []
  const learningPlan = d.learning_plan ?? []
  const strengths = d.strengths ?? []
  const weaknesses = d.weaknesses ?? []
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
          Твой прогресс и рекомендации по подготовке. Readiness:{' '}
          <b>{d.readiness_score ?? 0}%</b>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <SectionCard icon={<Sparkles className="h-4 w-4" />} title="Mock-интервью">
          <p className="text-[13px] leading-relaxed text-text-secondary">
            Пройди алгоритмическое и behavioral-интервью с AI-оценкой и персональным планом.
          </p>
          <Link to="/interview">
            <Button
              variant="primary"
              size="sm"
              icon={<Target className="h-4 w-4" />}
              iconRight={<ArrowRight className="h-4 w-4" />}
              className="self-start"
            >
              Начать mock
            </Button>
          </Link>
        </SectionCard>

        {pendingRetries.length > 0 ? (
          <SectionCard icon={<RefreshCw className="h-4 w-4" />} title="Повтор ошибок">
            <p className="text-[13px] leading-relaxed text-text-secondary">
              {pendingRetries.length} задач ждут повторной попытки.
            </p>
            <Button
              variant="secondary"
              size="sm"
              loading={retryM.isPending}
              onClick={() => retryM.mutate(pendingRetries.map((i) => i.id))}
              className="self-start"
            >
              Начать повтор
            </Button>
          </SectionCard>
        ) : (
          <SectionCard icon={<Brain className="h-4 w-4" />} title="Рекомендации">
            <p className="text-[13px] leading-relaxed text-text-secondary">
              {recommendations.length > 0
                ? `${recommendations.length} активных рекомендаций — смотри ниже.`
                : 'Пройди mock-интервью, чтобы получить персональные советы.'}
            </p>
          </SectionCard>
        )}
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Readiness" value={`${d.readiness_score ?? 0}%`} />
        <StatTile label="Задач на повтор" value={String(d.pending_retry_count ?? 0)} />
        <StatTile label="Рекомендаций" value={String(recommendations.length)} />
      </section>

      {d.profile_summary ? (
        <SectionCard title="Профиль навыков">
          <p className="text-[13px] leading-relaxed text-text-secondary">{d.profile_summary}</p>
        </SectionCard>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <InsightList title="Сильные стороны" items={strengths} />
        <InsightList title="Зоны роста" items={weaknesses} />
      </div>

      <SectionCard title="Рекомендации">
        {recommendations.length === 0 ? (
          <p className="text-[13px] text-text-muted">
            Пока нет рекомендаций.{' '}
            <Link to="/interview" className="underline">
              Пройди mock-интервью
            </Link>
            , чтобы получить персональный план.
          </p>
        ) : (
          <ul className="space-y-4">
            {recommendations.map((rec) => (
              <li
                key={rec.id}
                className="flex items-start justify-between gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                    {rec.type}
                  </p>
                  <h3 className="font-medium">{rec.title}</h3>
                  <p className="mt-1 text-[13px] text-text-secondary">{rec.description}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" size="sm" onClick={() => completeRecM.mutate(rec.id)}>
                    Готово
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => dismissRecM.mutate(rec.id)}>
                    Скрыть
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="План обучения">
        {learningPlan.length === 0 ? (
          <p className="text-[13px] text-text-muted">План появится после первых интервью.</p>
        ) : (
          <ul className="space-y-4">
            {learningPlan.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
                    {item.type}
                  </p>
                  <h3 className="font-medium">{item.title}</h3>
                  {item.description ? (
                    <p className="mt-1 text-[13px] text-text-secondary">{item.description}</p>
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
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </PageContent>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-4 card-lift">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
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
    <SectionCard title={title}>
      {items.length === 0 ? (
        <p className="text-[13px] text-text-muted">Недостаточно данных.</p>
      ) : (
        <ul className="space-y-2">
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
    </SectionCard>
  )
}
