import type { SessionSection } from '@/lib/types'

function labelStatus(status: string): string {
  return status.replace('SECTION_STATUS_', '').toLowerCase().replace(/_/g, ' ')
}

export function SessionSectionsProgress({
  sections,
  currentSectionId,
  progress,
}: {
  sections: SessionSection[]
  currentSectionId?: string
  progress?: {
    total_tasks: number
    evaluated_tasks: number
    skipped_tasks: number
  }
}) {
  const sorted = [...sections].sort((a, b) => a.position - b.position)
  if (sorted.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-surface-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
          Секции сессии
        </h2>
        {progress ? (
          <span className="text-xs text-text-secondary">
            Задачи: {progress.evaluated_tasks + progress.skipped_tasks}/{progress.total_tasks}
          </span>
        ) : null}
      </div>
      <ol className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {sorted.map((section) => {
          const active = section.id === currentSectionId
          const done = section.status === 'SECTION_STATUS_COMPLETED'
          return (
            <li
              key={section.id}
              className={[
                'flex min-w-[140px] flex-1 flex-col gap-1 rounded-lg border px-3 py-2.5 text-sm',
                active
                  ? 'border-text-primary bg-text-primary/5'
                  : done
                    ? 'border-border bg-surface-2 opacity-80'
                    : 'border-border bg-surface-2',
              ].join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              <span className="font-medium text-text-primary">
                {section.position}. {section.title}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-text-muted">
                {labelStatus(section.status)}
                {section.score ? ` · ${section.score}` : ''}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
