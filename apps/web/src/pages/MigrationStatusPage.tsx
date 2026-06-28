import { Link } from 'react-router-dom'
import {
  FEATURES,
  featuresByArea,
  migrationStats,
} from '@/lib/migration/features'
import type { FeatureStatus } from '@/lib/migration/types'
import { PageContent } from '@/components/PageContent'

const STATUS_LABEL: Record<FeatureStatus, string> = {
  ready: 'ready',
  partial: 'partial',
  in_progress: 'in progress',
  stub: 'stub',
  absent: 'absent',
  deprecated: 'deprecated',
}

const STATUS_CLASS: Record<FeatureStatus, string> = {
  ready: 'bg-success/15 text-success',
  partial: 'bg-warn/15 text-warn',
  in_progress: 'bg-accent/15 text-accent',
  stub: 'bg-surface-3 text-text-secondary',
  absent: 'bg-surface-2 text-text-secondary',
  deprecated: 'bg-danger/10 text-danger',
}

export default function MigrationStatusPage() {
  if (!import.meta.env.DEV) {
    return (
      <PageContent>
        <p className="text-text-secondary">Migration dashboard доступен только в dev.</p>
        <Link to="/today" className="mt-4 inline-block text-sm text-accent">
          ← Today
        </Link>
      </PageContent>
    )
  }

  const stats = migrationStats()
  const byArea = featuresByArea()

  return (
    <PageContent className="pb-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Dev only
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Frontend migration</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Реестр: <code className="text-xs">src/lib/migration/features.ts</code> · План:{' '}
            <code className="text-xs">MIGRATION.md</code>
          </p>
        </div>
        <Link to="/today" className="text-sm text-text-secondary hover:text-text-primary">
          ← Today
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            ['total', stats.total],
            ['ready', stats.ready],
            ['partial', stats.partial],
            ['stub', stats.stub],
            ['absent', stats.absent],
            ['in progress', stats.inProgress],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-surface-1 px-4 py-3">
            <dt className="text-xs text-text-secondary">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {[...byArea.entries()].map(([area, items]) => (
        <section key={area} className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">
            {area}
          </h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-border bg-surface-2 text-xs text-text-secondary">
                <tr>
                  <th className="px-3 py-2 font-medium">Route</th>
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Backend</th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.path} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{f.path}</td>
                    <td className="px-3 py-2">{f.label}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[f.status]}`}
                      >
                        {STATUS_LABEL[f.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-text-secondary">
                      {f.backend.length ? f.backend.join(', ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="mt-10 text-xs text-text-secondary">
        Всего записей в реестре: {FEATURES.length}. Обновляй статус при каждой итерации переноса.
      </p>
    </PageContent>
  )
}
