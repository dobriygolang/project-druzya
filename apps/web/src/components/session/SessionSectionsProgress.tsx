import type { SessionSection } from '@/lib/types'
import { useI18n } from '@/lib/i18n'
import { useDomainLabels } from '@/lib/labels'

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
  const { t } = useI18n()
  const labels = useDomainLabels()
  const sorted = [...sections].sort((a, b) => a.position - b.position)
  if (sorted.length === 0) return null

  const doneTasks = progress ? progress.evaluated_tasks + progress.skipped_tasks : 0

  return (
    <section className="rounded-xl border border-border bg-surface-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted">
          {t('session.sectionsTitle')}
        </h2>
        {progress ? (
          <span className="text-xs text-text-secondary">
            {t('session.sectionsTasks', { done: doneTasks, total: progress.total_tasks })}
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
              <span className="text-[10px] uppercase tracking-wide text-text-muted">
                {labels.sectionStatus(section.status)}
                {section.score ? ` · ${section.score}` : ''}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
