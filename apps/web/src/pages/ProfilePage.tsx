import { useQuery } from '@tanstack/react-query'
import { ErrorMessage } from '@/components/ErrorMessage'
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Профиль</h1>
        <p className="mt-1 text-sm text-muted">Аккаунт и подписка.</p>
      </div>

      {meQ.isLoading ? (
        <p className="text-sm text-muted">Загрузка…</p>
      ) : meQ.isError ? (
        <ErrorMessage
          message={formatApiError(meQ.error)}
          onRetry={() => void meQ.refetch()}
        />
      ) : meQ.data ? (
        <section className="rounded-xl border border-border bg-surface-1 p-5">
          <h2 className="font-medium">Аккаунт</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Имя</dt>
              <dd>{meQ.data.username}</dd>
            </div>
            {meQ.data.telegram_id ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Telegram</dt>
                <dd className="font-mono">{meQ.data.telegram_id}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {billingQ.isLoading ? (
        <p className="text-sm text-muted">Загрузка подписки…</p>
      ) : billingQ.isError ? (
        <ErrorMessage
          message={formatApiError(billingQ.error)}
          onRetry={() => void billingQ.refetch()}
        />
      ) : billingQ.data ? (
        <section className="rounded-xl border border-border bg-surface-1 p-5">
          <h2 className="font-medium">Подписка</h2>
          <p className="mt-2 text-sm">
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
                      <span className={exhausted ? 'text-danger' : 'text-muted'}>
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
            <p className="mt-2 text-sm text-muted">Лимиты не настроены.</p>
          )}
        </section>
      ) : null}
    </div>
  )
}
