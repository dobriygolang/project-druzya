import { useQuery } from '@tanstack/react-query'
import { ErrorMessage } from '@/components/ErrorMessage'
import { getBillingMe } from '@/lib/api/billing'
import { getMe } from '@/lib/api/auth'

export default function ProfilePage() {
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe })
  const billingQ = useQuery({ queryKey: ['billing-me'], queryFn: getBillingMe })

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
          message={meQ.error instanceof Error ? meQ.error.message : 'Ошибка'}
          onRetry={() => void meQ.refetch()}
        />
      ) : meQ.data ? (
        <section className="rounded-xl border border-border bg-surface-1 p-5">
          <h2 className="font-medium">Аккаунт</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Username</dt>
              <dd className="font-mono">{meQ.data.username}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">ID</dt>
              <dd className="font-mono text-xs">{meQ.data.id}</dd>
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
        <p className="text-sm text-muted">Загрузка billing…</p>
      ) : billingQ.isError ? (
        <ErrorMessage
          message={
            billingQ.error instanceof Error
              ? billingQ.error.message
              : 'Billing недоступен (сервис может быть выключен)'
          }
          onRetry={() => void billingQ.refetch()}
        />
      ) : billingQ.data ? (
        <section className="rounded-xl border border-border bg-surface-1 p-5">
          <h2 className="font-medium">Подписка</h2>
          <p className="mt-2 text-sm">
            План: <span className="font-medium">{billingQ.data.plan_name}</span>{' '}
            <span className="font-mono text-muted">({billingQ.data.plan_slug})</span>
          </p>
          {Object.keys(billingQ.data.limits).length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {Object.entries(billingQ.data.limits).map(([key, lim]) => (
                <li key={key} className="flex justify-between gap-4">
                  <span className="font-mono text-muted">{key}</span>
                  <span>
                    {lim.unlimited
                      ? '∞'
                      : `${lim.used}${lim.limit != null ? ` / ${lim.limit}` : ''}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Лимиты не настроены.</p>
          )}
        </section>
      ) : null}
    </div>
  )
}
