import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AdminSelect } from '@/components/admin/FormControls'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  getAdminUserEntitlements,
  grantAdminSubscription,
  listAdminPlans,
  revokeAdminSubscription,
  updateAdminPlanEntitlement,
  type AdminPlan,
  type AdminPlanEntitlementSpec,
} from '@/lib/api/admin'
import { formatApiError } from '@/lib/apiClient'

const EDITABLE_COUNTER_KEYS = [
  'mock_interviews_per_month',
  'ai_evaluations_per_day',
  'code_runs_per_day',
] as const

export default function AdminBillingPage() {
  const qc = useQueryClient()
  const [lookupUserId, setLookupUserId] = useState('')
  const [grantUserId, setGrantUserId] = useState('')
  const [grantPlanSlug, setGrantPlanSlug] = useState('pro_monthly')
  const [revokeUserId, setRevokeUserId] = useState('')

  const plansQ = useQuery({
    queryKey: ['admin-plans'],
    queryFn: listAdminPlans,
  })

  useEffect(() => {
    const first = plansQ.data?.plans?.[0]?.slug
    if (first && grantPlanSlug === 'pro_monthly' && !plansQ.data?.plans.some((p) => p.slug === 'pro_monthly')) {
      setGrantPlanSlug(first)
    }
  }, [plansQ.data, grantPlanSlug])

  const entitlementsQ = useQuery({
    queryKey: ['admin-entitlements', lookupUserId],
    queryFn: () => getAdminUserEntitlements(lookupUserId),
    enabled: false,
  })

  const grantM = useMutation({
    mutationFn: () =>
      grantAdminSubscription({
        user_id: grantUserId,
        plan_slug: grantPlanSlug,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entitlements'] })
    },
  })

  const revokeM = useMutation({
    mutationFn: () => revokeAdminSubscription(revokeUserId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-entitlements'] })
    },
  })

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card elevation="e1" className="p-4">
        <h2 className="mb-3 font-medium">Plans & limits</h2>
        <p className="mb-3 text-xs text-text-muted">
          PATCH → billing DB + in-memory plan cache reload. Usage counters in Postgres are unchanged.
        </p>
        {plansQ.isLoading ? <p className="text-sm text-text-muted">Loading…</p> : null}
        <ul className="space-y-4 text-sm">
          {(plansQ.data?.plans ?? []).map((plan) => (
            <PlanLimitsEditor key={plan.slug} plan={plan} />
          ))}
        </ul>
      </Card>

      <div className="space-y-6">
        <Card elevation="e1" className="space-y-3 p-4">
          <h2 className="font-medium">User entitlements</h2>
          <label className="block text-sm">
            User ID
            <input
              className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm font-mono"
              value={lookupUserId}
              onChange={(e) => setLookupUserId(e.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            disabled={!lookupUserId}
            onClick={() => void entitlementsQ.refetch()}
          >
            Lookup
          </Button>
          {entitlementsQ.data?.entitlements ? (
            <div className="rounded border border-border px-3 py-2 text-sm">
              <div className="font-medium">
                {entitlementsQ.data.entitlements.plan_name} ({entitlementsQ.data.entitlements.plan_slug})
              </div>
              <ul className="mt-2 space-y-1 text-text-muted">
                {Object.entries(entitlementsQ.data.entitlements.limits).map(([key, lim]) => (
                  <li key={key}>
                    {key}: {lim.used}
                    {lim.unlimited ? ' / unlimited' : lim.limit != null ? ` / ${lim.limit}` : ''}
                    {lim.remaining != null ? ` (${lim.remaining} left)` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card elevation="e1" className="space-y-3 p-4">
          <h2 className="font-medium">Grant subscription</h2>
          <label className="block text-sm">
            User ID
            <input
              className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm font-mono"
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
            />
          </label>
          <AdminSelect
            label="Plan"
            value={grantPlanSlug}
            onChange={setGrantPlanSlug}
            options={(plansQ.data?.plans ?? []).map((plan) => ({
              value: plan.slug,
              label: `${plan.name} (${plan.slug})`,
            }))}
          />
          <Button
            loading={grantM.isPending}
            disabled={!grantUserId || !grantPlanSlug}
            onClick={() => grantM.mutate()}
          >
            Grant
          </Button>
        </Card>

        <Card elevation="e1" className="space-y-3 p-4">
          <h2 className="font-medium">Revoke subscription</h2>
          <label className="block text-sm">
            User ID
            <input
              className="mt-1 w-full rounded border border-border bg-surface-1 px-3 py-2 text-sm font-mono"
              value={revokeUserId}
              onChange={(e) => setRevokeUserId(e.target.value)}
            />
          </label>
          <Button
            variant="danger"
            loading={revokeM.isPending}
            disabled={!revokeUserId}
            onClick={() => revokeM.mutate()}
          >
            Revoke
          </Button>
        </Card>
      </div>
    </div>
  )
}

function PlanLimitsEditor({ plan }: { plan: AdminPlan }) {
  const qc = useQueryClient()
  const limits = plan.limits ?? {}
  const counterKeys = EDITABLE_COUNTER_KEYS.filter((key) => limits[key]?.type === 'counter')

  return (
    <li className="rounded border border-border px-3 py-3">
      <div className="font-medium">
        {plan.name} {plan.highlight ? '· featured' : ''}
      </div>
      <div className="text-text-muted">{plan.slug}</div>
      {counterKeys.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted">No editable counter limits.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {counterKeys.map((key) => (
            <LimitRow
              key={key}
              planSlug={plan.slug}
              entitlementKey={key}
              spec={limits[key]!}
              onSaved={() => void qc.invalidateQueries({ queryKey: ['admin-plans'] })}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

function LimitRow({
  planSlug,
  entitlementKey,
  spec,
  onSaved,
}: {
  planSlug: string
  entitlementKey: string
  spec: AdminPlanEntitlementSpec
  onSaved: () => void
}) {
  const [unlimited, setUnlimited] = useState(!!spec.unlimited || spec.limit == null)
  const [limit, setLimit] = useState(spec.limit != null ? String(spec.limit) : '')
  const [error, setError] = useState<string | null>(null)

  const saveM = useMutation({
    mutationFn: () => {
      const body: AdminPlanEntitlementSpec = {
        type: 'counter',
        period: spec.period ?? (entitlementKey.endsWith('_per_day') ? 'day' : 'month'),
        unlimited,
      }
      if (!unlimited) {
        const parsed = Number.parseInt(limit, 10)
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error('limit must be a non-negative integer')
        }
        body.limit = parsed
      }
      return updateAdminPlanEntitlement(planSlug, entitlementKey, body)
    },
    onSuccess: () => {
      setError(null)
      onSaved()
    },
    onError: (err) => setError(formatApiError(err)),
  })

  return (
    <li className="flex flex-wrap items-end gap-2 rounded bg-surface-2 px-2 py-2">
      <span className="min-w-[10rem] flex-1 font-mono text-xs">{entitlementKey}</span>
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
        unlimited
      </label>
      {!unlimited ? (
        <input
          className="w-20 rounded border border-border bg-surface-1 px-2 py-1 text-xs font-mono"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      ) : null}
      <Button size="sm" variant="secondary" loading={saveM.isPending} onClick={() => saveM.mutate()}>
        Save
      </Button>
      {error ? <span className="w-full text-xs text-danger">{error}</span> : null}
    </li>
  )
}
