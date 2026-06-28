import { useQuery } from '@tanstack/react-query'
import { ErrorMessage } from '@/components/ErrorMessage'
import { PageContent } from '@/components/PageContent'
import { SectionCard } from '@/components/SectionCard'
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

  const limitEntries = billingQ.data ? sortLimitEntries(Object.entries(billingQ.data.limits)) : []

  return (
    <PageContent>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold leading-tight">Профиль</h1>
        <p className="text-[14px] text-text-secondary">Аккаунт и подписка.</p>
      </header>

      {meQ.isLoading ? (
        <p className="text-sm text-text-muted">Загрузка…</p>
      ) : meQ.isError ? (
        <ErrorMessage message={formatApiError(meQ.error)} onRetry={() => void meQ.refetch()} />
      ) : meQ.data ? (
        <SectionCard title="Аккаунт">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted">Имя</dt>
              <dd>{meQ.data.username}</dd>
            </div>
            {meQ.data.telegram_id ? (
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted">Telegram</dt>
                <dd className="font-mono">{meQ.data.telegram_id}</dd>
              </div>
            ) : null}
          </dl>
        </SectionCard>
      ) : null}

      {billingQ.isLoading ? (
        <p className="text-sm text-text-muted">Загрузка подписки…</p>
      ) : billingQ.isError ? (
        <ErrorMessage
          message={formatApiError(billingQ.error)}
          onRetry={() => void billingQ.refetch()}
        />
      ) : billingQ.data ? (
        <SectionCard title="Подписка">
          <p className="text-sm">
            Тариф:{' '}
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
                        aria-label={entitlementLabel(key)}
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
            <p className="mt-2 text-sm text-text-muted">Лимиты не настроены.</p>
          )}
        </SectionCard>
      ) : null}
    </PageContent>
  )
}
