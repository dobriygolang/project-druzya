import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, CreditCard, ListChecks, Sparkles } from 'lucide-react'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { SdvgCard } from '@/components/brand/SdvgCard'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { getBillingMe } from '@/lib/api/billing'
import { getMe } from '@/lib/api/auth'
import { formatApiError } from '@/lib/apiClient'
import { UserAvatar } from '@/components/UserAvatar'
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
        <div className="animate-pulse space-y-5">
          <div className="h-4 w-24 rounded bg-surface-2" />
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-full bg-surface-2" />
            <div className="space-y-2">
              <div className="h-7 w-40 rounded bg-surface-2" />
              <div className="h-4 w-32 rounded bg-surface-2" />
            </div>
          </div>
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
  const memberSince = user.created_at ? formatMonthYear(user.created_at) : null
  const limitEntries = billingQ.data ? sortLimitEntries(Object.entries(billingQ.data.limits)) : []

  return (
    <PageContent className="gap-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface-1 text-xl font-semibold">
            <UserAvatar name={username} avatarUrl={user.avatar_url} className="h-16 w-16" textClassName="text-xl" />
          </div>
          <div>
            <Eyebrow>Профиль</Eyebrow>
            <h1 className="mt-1 text-[clamp(1.5rem,3vw,2rem)] font-semibold leading-tight tracking-[-0.02em]">
              @{username}
            </h1>
            {memberSince ? (
              <p className="mt-1 text-[14px] text-text-secondary">На druz9 с {memberSince}</p>
            ) : null}
          </div>
        </div>
        <Link to="/pricing">
          <Button variant="ghost" size="sm" icon={<CreditCard className="h-4 w-4" />}>
            Тарифы
          </Button>
        </Link>
      </header>

      <QuickLinksCard />

      {billingQ.isLoading ? (
        <SdvgCard eyebrow="Billing" title="Подписка и лимиты">
          <p className="text-sm text-text-muted">Загрузка…</p>
        </SdvgCard>
      ) : billingQ.isError ? (
        <SdvgCard eyebrow="Billing" title="Подписка и лимиты">
          <ErrorMessage
            message={formatApiError(billingQ.error)}
            onRetry={() => void billingQ.refetch()}
          />
        </SdvgCard>
      ) : billingQ.data ? (
        <SdvgCard eyebrow="Billing" title="Подписка и лимиты">
          <p className="text-[15px]">
            План:{' '}
            <span className="font-medium">
              {formatPlanName(billingQ.data.plan_name, billingQ.data.plan_slug)}
            </span>
          </p>
          {limitEntries.length > 0 ? (
            <ul className="mt-5 space-y-5">
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
                        className="mt-2 h-1 overflow-hidden rounded-full bg-[rgba(76,179,92,0.15)]"
                        role="progressbar"
                        aria-valuenow={lim.used}
                        aria-valuemin={0}
                        aria-valuemax={lim.limit ?? lim.used}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: exhausted ? brand.dot : brand.green,
                          }}
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
        </SdvgCard>
      ) : null}
    </PageContent>
  )
}

function QuickLinksCard() {
  const links = [
    {
      to: '/mock',
      label: 'Mock interview',
      hint: 'Шаблоны компаний и сессии',
      icon: Sparkles,
    },
    {
      to: '/today',
      label: 'Today',
      hint: 'Readiness и рекомендации',
      icon: ListChecks,
    },
  ]

  return (
    <SdvgCard eyebrow="Навигация" title="Быстрые ссылки">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="group flex items-start gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 no-underline transition-colors hover:border-border-strong"
            >
              <l.icon className="mt-0.5 h-4 w-4 shrink-0 text-text-muted group-hover:text-text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-text-primary">{l.label}</span>
                <span className="block text-[12.5px] text-text-muted">{l.hint}</span>
              </span>
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-text-muted group-hover:text-text-primary" />
            </Link>
          </li>
        ))}
      </ul>
    </SdvgCard>
  )
}

function formatMonthYear(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
}
