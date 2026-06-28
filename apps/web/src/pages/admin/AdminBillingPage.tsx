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
} from '@/lib/api/admin'

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
        <h2 className="mb-3 font-medium">Plans catalog</h2>
        <p className="mb-3 text-xs text-text-muted">Read-only — plan rows live in billing DB migrations.</p>
        {plansQ.isLoading ? <p className="text-sm text-text-muted">Loading…</p> : null}
        <ul className="space-y-3 text-sm">
          {(plansQ.data?.plans ?? []).map((plan) => (
            <li key={plan.slug} className="rounded border border-border px-3 py-2">
              <div className="font-medium">
                {plan.name} {plan.highlight ? '· featured' : ''}
              </div>
              <div className="text-text-muted">{plan.slug}</div>
              {plan.tagline ? <p className="mt-1">{plan.tagline}</p> : null}
            </li>
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
