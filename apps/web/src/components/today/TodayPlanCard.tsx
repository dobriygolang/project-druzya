import { useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, ListTodo } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { SdvgCard } from '@/components/brand/SdvgCard'
import { CollapsibleSection } from '@/components/tracker/CollapsibleSection'
import { TrackerProgressBar } from '@/components/tracker/TrackerProgressBar'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { updateMe } from '@/lib/api/auth'
import { startRetrySession } from '@/lib/api/interview'
import { browserLocalDate, browserTimezone, getToday, type TodayTaskEntry } from '@/lib/api/tracker'
import { useI18n } from '@/lib/i18n'

const todayKey = () => `${browserLocalDate()}|${browserTimezone()}`

function reasonKey(code?: string): string {
  switch (code) {
    case 'TODAY_REASON_RETRY':
      return 'today.plan.reasonRetry'
    case 'TODAY_REASON_REVIEW':
      return 'today.plan.reasonReview'
    case 'TODAY_REASON_SKILL':
      return 'today.plan.reasonSkill'
    case 'TODAY_REASON_MOCK':
      return 'today.plan.reasonMock'
    case 'TODAY_REASON_LEARNING':
      return 'today.plan.reasonLearning'
    default:
      return 'today.plan.reasonUser'
  }
}

function TodayTaskRow({
  entry,
  onRetry,
  retryLoading,
}: {
  entry: TodayTaskEntry
  onRetry: (id: string) => void
  retryLoading: boolean
}) {
  const { t } = useI18n()
  const task = entry.task
  const meta = task.metadata ?? {}
  const retryId = typeof meta.retry_item_id === 'string' ? meta.retry_item_id : undefined
  const actionPath = entry.action_path ?? (typeof meta.action_path === 'string' ? meta.action_path : undefined)
  const estimate = task.estimate_days ?? 1

  const action = retryId ? (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0"
      loading={retryLoading}
      iconRight={<ArrowRight className="h-3.5 w-3.5" />}
      onClick={() => onRetry(retryId)}
    >
      {t('today.plan.actionRetry')}
    </Button>
  ) : actionPath ? (
    <Link to={actionPath} className="no-underline">
      <Button variant="ghost" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
        {t('today.plan.actionOpen')}
      </Button>
    </Link>
  ) : null

  return (
    <li className="relative flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 pl-4 sm:flex-row sm:items-center sm:justify-between">
      <span
        className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r"
        style={{ background: brand.green }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] font-medium leading-snug">{task.title}</p>
          {entry.epic_name ? (
            <span className="rounded-md bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-text-muted">
              {entry.epic_name}
            </span>
          ) : null}
          <span className="font-mono text-[10px] tabular-nums text-text-muted">
            {t('tracker.estimateDaysShort', { days: estimate })}
          </span>
          <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] text-text-secondary">
            {t(reasonKey(entry.reason_code))}
          </span>
        </div>
      </div>
      {action}
    </li>
  )
}

export function TodayPlanCard() {
  const { t } = useI18n()
  const navigate = useNavigate()

  useEffect(() => {
    const tz = browserTimezone()
    if (!tz) return
    void updateMe({ timezone: tz }).catch(() => {})
  }, [])

  const planQ = useQuery({
    queryKey: ['tracker-today', todayKey()],
    queryFn: () => getToday(browserLocalDate(), browserTimezone()),
  })

  const startM = useMutation({
    mutationFn: (ids: string[]) => startRetrySession(ids),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  if (planQ.isLoading) {
    return <div className="sdvg-card h-48 animate-pulse bg-surface-2" />
  }

  if (planQ.isError) {
    return (
      <SdvgCard eyebrow={t('today.plan.eyebrow')} title={t('today.plan.title')}>
        <p className="text-[13px] text-text-muted">{t('today.readiness.errorBody')}</p>
      </SdvgCard>
    )
  }

  const plan = planQ.data
  const today = plan?.today_tasks ?? []
  const later = plan?.later_tasks ?? []
  const budgetUsed = plan?.budget_used ?? 0
  const budgetCap = plan?.budget_capacity ?? 1.5

  if (!plan?.active_sprint && today.length === 0 && later.length === 0) {
    return (
      <SdvgCard eyebrow={t('today.plan.eyebrow')} title={t('today.plan.title')}>
        <p className="text-[13px] text-text-secondary">{t('today.plan.empty')}</p>
        <Link to="/tasks" className="mt-4 inline-block no-underline">
          <Button variant="ghost" size="sm" icon={<ListTodo className="h-4 w-4" />}>
            {t('today.plan.allTasks')}
          </Button>
        </Link>
      </SdvgCard>
    )
  }

  return (
    <SdvgCard eyebrow={t('today.plan.eyebrow')} title={t('today.plan.title')}>
      <div className="mb-4 space-y-2">
        <TrackerProgressBar
          mode="capacity"
          value={budgetUsed}
          max={budgetCap}
          label={t('today.plan.budget', { used: budgetUsed, capacity: budgetCap })}
        />
        <p className="text-[12px] text-text-muted">{t('today.plan.budgetHint')}</p>
      </div>

      {today.length === 0 ? (
        <p className="mb-3 text-[13px] text-text-muted">{t('today.plan.todayEmpty')}</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {today.map((entry) => (
            <TodayTaskRow
              key={entry.task.id}
              entry={entry}
              onRetry={(id) => startM.mutate([id])}
              retryLoading={
                startM.isPending && startM.variables?.length === 1 && startM.variables[0] === entry.task.metadata?.retry_item_id
              }
            />
          ))}
        </ul>
      )}

      {later.length > 0 ? (
        <CollapsibleSection title={t('today.plan.laterInSprint')} count={later.length}>
          <ul className="flex flex-col gap-2">
            {later.map((entry) => (
              <TodayTaskRow
                key={entry.task.id}
                entry={entry}
                onRetry={(id) => startM.mutate([id])}
                retryLoading={
                  startM.isPending &&
                  startM.variables?.length === 1 &&
                  startM.variables[0] === entry.task.metadata?.retry_item_id
                }
              />
            ))}
          </ul>
        </CollapsibleSection>
      ) : null}

      <Link to="/tasks" className="mt-4 inline-block no-underline">
        <Button variant="ghost" size="sm" icon={<ListTodo className="h-4 w-4" />}>
          {t('today.plan.allTasks')}
        </Button>
      </Link>
    </SdvgCard>
  )
}
