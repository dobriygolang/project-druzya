import { Link } from 'react-router-dom'
import { ArrowRight, Brain, Loader2, Map as MapIcon, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { Dashboard } from '@/lib/types'

function Card({
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

export function TodayActionGrid({
  dashboard,
  loading,
}: {
  dashboard?: Dashboard | null
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
    )
  }

  const recommendations = dashboard?.recommendations ?? []
  const weaknesses = dashboard?.weaknesses ?? []

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <Card icon={<Sparkles className="h-4 w-4" />} title="Next mock">
        <p className="text-[13px] leading-relaxed text-text-secondary">
          Multi-stage interview under a company template — algo, system design, behavioral.
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
      </Card>

      <Card icon={<Sparkles className="h-4 w-4" />} title="Coach insight">
        {recommendations.length === 0 ? (
          <p className="text-[13px] text-text-muted">Complete a mock to unlock insights.</p>
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
      </Card>

      <Card icon={<Brain className="h-4 w-4" />} title="Daily brief">
        {dashboard?.profile_summary ? (
          <p className="text-[13px] leading-relaxed text-text-secondary">
            {dashboard.profile_summary}
          </p>
        ) : (
          <p className="text-[13px] text-text-muted">Brief appears after your first session.</p>
        )}
      </Card>

      <Card icon={<MapIcon className="h-4 w-4" />} title="Weak spots">
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
              <li key={w.skill_key} className="flex flex-col gap-1.5 rounded-md bg-surface-2 px-3 py-2.5">
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
      </Card>
    </div>
  )
}

export function TodayActionGridSkeleton() {
  return (
    <div className="flex items-center gap-2 text-[12px] text-text-muted">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading insights…
    </div>
  )
}
