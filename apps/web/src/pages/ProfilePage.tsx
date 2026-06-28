import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CreditCard,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { getBillingMe } from '@/lib/api/billing'
import { getMe } from '@/lib/api/auth'
import { formatApiError } from '@/lib/apiClient'
import {
  entitlementLabel,
  formatLimitUsage,
  formatPlanName,
  limitProgressPct,
  sortLimitEntries,
} from '@/lib/billingLabels'

export default function ProfilePage() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
  const billingQ = useQuery({ queryKey: ['billing-me'], queryFn: getBillingMe })

  if (meQ.isLoading) {
    return (
      <PageContent>
        <div className="animate-pulse">
          <div className="h-20 w-20 rounded-full bg-surface-2" />
          <div className="mt-5 h-7 w-48 rounded bg-surface-2" />
        </div>
      </PageContent>
    )
  }

  if (meQ.isError) {
    return (
      <PageContent>
        <ErrorMessage message={formatApiError(meQ.error)} onRetry={() => void meQ.refetch()} />
      </PageContent>
    )
  }

  const user = meQ.data
  if (!user) return null

  const username = user.username
  const initial = username.slice(0, 1).toUpperCase()
  const memberSince = user.created_at ? formatMonthYear(user.created_at) : null
  const limitEntries = billingQ.data ? sortLimitEntries(Object.entries(billingQ.data.limits)) : []

  return (
    <PageContent>
      <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-surface-2 font-display text-3xl font-extrabold text-text-primary">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={username}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold leading-tight">@{username}</h1>
            <div className="mt-1 text-[14px] text-text-secondary">
              {memberSince ? <>На druz9 с {memberSince}</> : null}
            </div>
          </div>
        </div>
        <Link to="/pricing">
          <Button variant="ghost" size="sm" icon={<CreditCard className="h-4 w-4" />}>
            Тарифы
          </Button>
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-5">
        <QuickLinksCard />

        {billingQ.isLoading ? (
          <ProfileCard title="Подписка и лимиты">
            <p className="text-sm text-text-muted">Загрузка…</p>
          </ProfileCard>
        ) : billingQ.isError ? (
          <ProfileCard title="Подписка и лимиты">
            <ErrorMessage
              message={formatApiError(billingQ.error)}
              onRetry={() => void billingQ.refetch()}
            />
          </ProfileCard>
        ) : billingQ.data ? (
          <ProfileCard title="Подписка и лимиты">
            <p className="text-sm">
              План:{' '}
              <span className="font-medium">
                {formatPlanName(billingQ.data.plan_name, billingQ.data.plan_slug)}
              </span>
            </p>
            {limitEntries.length > 0 ? (
              <ul className="mt-5 space-y-4">
                {limitEntries.map(([key, lim]) => {
                  const pct = limitProgressPct(lim)
                  const exhausted = pct === 100
                  return (
                    <li key={key}>
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span>{entitlementLabel(key)}</span>
                        <span className={exhausted ? 'text-danger' : 'text-text-muted'}>
                          {formatLimitUsage(key, lim)}
                        </span>
                      </div>
                      {pct != null ? (
                        <div
                          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3"
                          role="progressbar"
                          aria-valuenow={lim.used}
                          aria-valuemin={0}
                          aria-valuemax={lim.limit ?? lim.used}
                        >
                          <div
                            className={`h-full rounded-full transition-all ${exhausted ? 'bg-danger' : 'bg-text-primary'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-text-muted">Лимиты не настроены для плана.</p>
            )}
          </ProfileCard>
        ) : null}
      </div>
    </PageContent>
  )
}

function ProfileCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-5">
      <h2 className="font-display text-base font-bold leading-tight">{title}</h2>
      {children}
    </section>
  )
}

function QuickLinksCard() {
  const links = [
    {
      to: '/mock',
      label: 'Mock interview',
      hint: 'Шаблоны компаний и сессии',
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      to: '/today',
      label: 'Today',
      hint: 'Readiness и рекомендации',
      icon: <ListChecks className="h-4 w-4" />,
    },
  ]

  return (
    <ProfileCard title="Быстрые ссылки">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="group flex items-start gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5 transition-colors hover:bg-surface-2/80"
            >
              <span className="mt-0.5 text-text-secondary group-hover:text-text-primary">
                {l.icon}
              </span>
              <span className="flex-1">
                <span className="block text-[13px] font-medium text-text-primary">{l.label}</span>
                <span className="block text-[11.5px] text-text-muted">{l.hint}</span>
              </span>
              <ArrowRight className="mt-1 h-3.5 w-3.5 text-text-muted group-hover:text-text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </ProfileCard>
  )
}

function formatMonthYear(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}
