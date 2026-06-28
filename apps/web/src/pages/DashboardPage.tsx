import { useMemo } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Brain, Map as MapIcon, RefreshCw, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
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
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    })
  }, [])

  if (dashboardQ.isLoading) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">Loading…</p>
      </PageContent>
    )
  }
  if (dashboardQ.isError) {
    return (
      <PageContent>
        <ErrorMessage
          message={dashboardQ.error instanceof Error ? dashboardQ.error.message : 'Load error'}
          onRetry={() => void dashboardQ.refetch()}
        />
      </PageContent>
    )
  }

  const d = dashboardQ.data
  if (!d) {
    return (
      <PageContent>
        <p className="text-sm text-text-muted">No data.</p>
      </PageContent>
    )
  }

  const username = meQ.data?.username ?? ''
  const recommendations = d.recommendations ?? []
  const weaknesses = d.weaknesses ?? []
  const pendingRetries = (retryQ.data?.items ?? []).filter(
    (i) => i.status === 'RETRY_ITEM_STATUS_PENDING',
  )

  return (
    <PageContent>
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
            {today}
          </span>
        </div>
        <h1 className="font-display text-3xl font-bold leading-tight">
          {username ? `Hey, ${username}` : 'Hey there'}
        </h1>
        <p className="text-[14px] text-text-secondary">
          Active mode: <b>General prep</b> — change in{' '}
          <Link to="/profile" className="underline">
            profile
          </Link>
          . Readiness: <b>{d.readiness_score ?? 0}%</b>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TodayCard icon={<Sparkles className="h-4 w-4" />} title="Next mock">
          <p className="text-[13px] leading-relaxed text-text-secondary">
            Run a multi-stage interview under a company template — algo, system design, behavioral.
          </p>
          <Link to="/mock">
            <Button
              variant="primary"
              size="sm"
              icon={<Target className="h-4 w-4" />}
              iconRight={<ArrowRight className="h-4 w-4" />}
              className="self-start"
            >
              Open mock picker
            </Button>
          </Link>
        </TodayCard>

        <TodayCard icon={<Sparkles className="h-4 w-4" />} title="Coach insight">
          {recommendations.length === 0 ? (
            <p className="text-[13px] text-text-muted">
              Complete a mock to unlock personalized insights.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="text-[14px] font-medium text-text-primary">
                {recommendations[0]?.title}
              </div>
              <p className="text-[13px] leading-relaxed text-text-secondary">
                {recommendations[0]?.description}
              </p>
            </div>
          )}
        </TodayCard>

        <TodayCard icon={<Brain className="h-4 w-4" />} title="Daily brief">
          {d.profile_summary ? (
            <p className="text-[13px] leading-relaxed text-text-secondary">{d.profile_summary}</p>
          ) : (
            <p className="text-[13px] text-text-muted">Brief will appear after your first session.</p>
          )}
        </TodayCard>

        <TodayCard icon={<MapIcon className="h-4 w-4" />} title="Weak spots">
          {weaknesses.length === 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] text-text-secondary">No weak spots tracked yet.</p>
              <Link to="/mock">
                <Button variant="ghost" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
                  Start mock
                </Button>
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {weaknesses.slice(0, 3).map((w) => (
                <li
                  key={w.skill_key}
                  className="flex flex-col gap-1.5 rounded-md bg-surface-2 px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-text-primary">{w.skill_key}</span>
                    <span className="font-mono text-[11px] tabular-nums text-text-secondary">
                      {w.score}%
                    </span>
                  </div>
                  <Link
                    to="/mock"
                    className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-surface-1 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-secondary hover:text-text-primary"
                  >
                    <Target className="h-3 w-3" /> mock
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TodayCard>
      </div>

      {pendingRetries.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface-1 p-5">
          <header className="mb-3 flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-text-secondary" />
            <h2 className="font-display text-base font-bold">Retry queue</h2>
          </header>
          <p className="text-[13px] text-text-secondary">
            {pendingRetries.length} tasks waiting for a second attempt.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            loading={retryM.isPending}
            onClick={() => retryM.mutate(pendingRetries.map((i) => i.id))}
          >
            Start retry session
          </Button>
        </section>
      ) : null}
    </PageContent>
  )
}

function TodayCard({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5">
      <header className="flex items-center gap-2">
        {icon ? <span className="text-text-secondary">{icon}</span> : null}
        <h2 className="font-display text-base font-bold leading-tight">{title}</h2>
      </header>
      {children}
    </section>
  )
}
