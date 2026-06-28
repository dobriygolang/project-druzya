import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { getAdminDashboard } from '@/lib/api/admin'

function Stat({ label, value, warn, hint }: { label: string; value: string | number; warn?: boolean; hint?: string }) {
  return (
    <div className="rounded border border-border px-3 py-2">
      <div className="text-xs text-text-muted">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${warn ? 'text-red-500' : ''}`}>{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-text-muted">{hint}</div> : null}
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function formatRps(rps: number) {
  return rps < 10 ? rps.toFixed(2) : rps.toFixed(1)
}

export default function AdminHomePage() {
  const dashboardQ = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: getAdminDashboard,
    refetchInterval: 30_000,
  })

  const d = dashboardQ.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-medium">Dashboard</h1>
        <p className="text-sm text-text-muted">
          Platform metrics, service health, database footprint and evaluation pipeline. Auto-refreshes every 30s.
        </p>
      </div>

      {dashboardQ.isLoading ? <p className="text-sm text-text-muted">Loading dashboard…</p> : null}
      {dashboardQ.isError ? (
        <p className="text-sm text-red-500">Failed to load dashboard. Check admin BFF and downstream services.</p>
      ) : null}

      {d ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="Total users" value={d.users?.total_users ?? 0} />
            <Stat label="New (24h)" value={d.users?.new_users_24h ?? 0} />
            <Stat label="New (7d)" value={d.users?.new_users_7d ?? 0} />
            <Stat
              label="Active (7d)"
              value={d.users?.active_users_7d ?? 0}
              hint="Users with profile activity in last 7 days"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Stat label="New (30d)" value={d.users?.new_users_30d ?? 0} hint="Signup growth" />
            <Stat label="Active subscriptions" value={d.users?.active_subscriptions ?? 0} />
            <Stat label="Total HTTP RPS" value={formatRps(d.total_http_rps ?? 0)} hint="Sum across services" />
            <Stat label="Total DB size" value={formatBytes(d.total_database_size_bytes ?? 0)} />
          </div>

          <Card elevation="e1" className="p-4">
            <h2 className="mb-3 font-medium">Service health</h2>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {(d.services ?? []).map((svc) => (
                <li
                  key={svc.name}
                  className={`rounded border px-3 py-2 text-sm ${svc.ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-red-500/40 bg-red-500/5'}`}
                >
                  <div className="font-medium capitalize">{svc.name}</div>
                  <div className={svc.ok ? 'text-emerald-600' : 'text-red-500'}>{svc.ok ? 'OK' : 'Down'}</div>
                  {svc.error ? <div className="mt-1 text-xs text-red-500">{svc.error}</div> : null}
                </li>
              ))}
            </ul>
          </Card>

          <Card elevation="e1" className="overflow-x-auto p-4">
            <h2 className="mb-3 font-medium">Runtime & database</h2>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-text-muted">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Service</th>
                  <th className="pb-2 pr-4 font-medium">DB</th>
                  <th className="pb-2 pr-4 font-medium">Size</th>
                  <th className="pb-2 pr-4 font-medium">Memory (alloc)</th>
                  <th className="pb-2 pr-4 font-medium">Goroutines</th>
                  <th className="pb-2 font-medium">HTTP RPS</th>
                </tr>
              </thead>
              <tbody>
                {(d.runtimes ?? []).map((rt) => (
                  <tr key={rt.name} className="border-t border-border">
                    <td className="py-2 pr-4 font-medium capitalize">{rt.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{rt.database_name}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatBytes(rt.database_size_bytes)}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatBytes(rt.memory_alloc_bytes)}</td>
                    <td className="py-2 pr-4 tabular-nums">{rt.goroutines}</td>
                    <td className="py-2 tabular-nums">{formatRps(rt.http_rps)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card elevation="e1" className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-medium">Catalog (sample)</h2>
                <Link to="/admin/companies" className="text-xs text-accent hover:underline">
                  Manage →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                <Stat label="Companies" value={d.catalog?.companies ?? 0} hint="cap 500" />
                <Stat label="Tasks" value={d.catalog?.tasks ?? 0} hint="cap 500" />
                <Stat label="Templates" value={d.catalog?.templates ?? 0} hint="cap 500" />
                <Stat label="Articles" value={d.catalog?.articles ?? 0} hint="cap 500" />
                <Stat label="Plans" value={d.catalog?.plans ?? 0} />
              </div>
            </Card>

            <Card elevation="e1" className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-medium">Evaluation jobs (sample)</h2>
                <Link to="/admin/ai" className="text-xs text-accent hover:underline">
                  AI ops →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Pending" value={d.evaluation_jobs?.pending ?? 0} />
                <Stat label="Running" value={d.evaluation_jobs?.running ?? 0} />
                <Stat
                  label="Failed"
                  value={d.evaluation_jobs?.failed ?? 0}
                  warn={(d.evaluation_jobs?.failed ?? 0) > 0}
                />
                <Stat label="Completed" value={d.evaluation_jobs?.completed ?? 0} />
              </div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card elevation="e1" className="p-4">
              <h2 className="mb-3 font-medium">Recent failed jobs</h2>
              {(d.recent_failed_jobs ?? []).length === 0 ? (
                <p className="text-sm text-text-muted">No failed jobs in the recent sample.</p>
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto text-sm">
                  {d.recent_failed_jobs.map((job) => (
                    <li key={job.id} className="rounded border border-border px-3 py-2 font-mono text-xs">
                      <div>{job.id}</div>
                      <div className="text-text-muted">
                        attempt {job.attempt_id} · user {job.user_id}
                        {job.updated_at ? ` · ${new Date(job.updated_at).toLocaleString()}` : ''}
                      </div>
                      {job.error ? <div className="mt-1 text-red-500">{job.error}</div> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card elevation="e1" className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-medium">LLM runtime</h2>
                <Link to="/admin/ai" className="text-xs text-accent hover:underline">
                  Edit config →
                </Link>
              </div>
              {d.llm_config ? (
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-text-muted">Version</dt>
                    <dd className="font-mono">{d.llm_config.version}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Chain order</dt>
                    <dd className="font-mono">
                      {(d.llm_config.chain_order ?? []).length > 0
                        ? d.llm_config.chain_order.join(' → ')
                        : '(env fallback)'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-text-muted">LLM config unavailable.</p>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
