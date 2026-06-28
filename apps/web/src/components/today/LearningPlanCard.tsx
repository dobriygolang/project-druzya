import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SdvgCard } from '@/components/brand/SdvgCard'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { startRetrySession } from '@/lib/api/interview'
import { pluralTasks, useI18n } from '@/lib/i18n'
import type { LearningPlanItem, RetryItem } from '@/lib/types'

const PENDING_RETRY = 'RETRY_ITEM_STATUS_PENDING'

export function hasActiveLearningPlanRetries(
  items: LearningPlanItem[],
  retryItems: RetryItem[],
): boolean {
  return items
    .filter(
      (i) =>
        i.status !== 'LEARNING_PLAN_ITEM_STATUS_COMPLETED' &&
        i.status !== 'LEARNING_PLAN_ITEM_STATUS_DISMISSED',
    )
    .some((i) => !!pendingRetryForTask(i.task_id, retryItems))
}

function pendingRetryForTask(
  taskId: string | undefined,
  retryItems: RetryItem[],
): RetryItem | undefined {
  if (!taskId) return undefined
  return retryItems.find((r) => r.task_id === taskId && r.status === PENDING_RETRY)
}

export function LearningPlanCard({
  items,
  retryItems,
  loading,
}: {
  items: LearningPlanItem[]
  retryItems: RetryItem[]
  loading?: boolean
}) {
  const { t } = useI18n()
  const navigate = useNavigate()

  const startM = useMutation({
    mutationFn: (ids: string[]) => startRetrySession(ids),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  if (loading) {
    return <section className="sdvg-card h-32 animate-pulse bg-surface-2 p-6" aria-hidden />
  }

  const active = items
    .filter(
      (i) =>
        i.status !== 'LEARNING_PLAN_ITEM_STATUS_COMPLETED' &&
        i.status !== 'LEARNING_PLAN_ITEM_STATUS_DISMISSED',
    )
    .filter((i) => !!pendingRetryForTask(i.task_id, retryItems))
  if (!hasActiveLearningPlanRetries(items, retryItems)) return null

  const startable = active
    .map((item) => ({ item, retry: pendingRetryForTask(item.task_id, retryItems) }))
    .filter((row): row is { item: LearningPlanItem; retry: RetryItem } => !!row.retry)

  const startAllIds = startable.map(({ retry }) => retry.id)

  return (
    <SdvgCard
      eyebrow={t('today.plan.eyebrow')}
      title={t('today.plan.title')}
      description={pluralTasks(t, active.length)}
    >
      <ul className="flex flex-col gap-2">
        {active.slice(0, 5).map((item) => {
          const retry = pendingRetryForTask(item.task_id, retryItems)
          return (
            <li
              key={item.id}
              className="relative flex flex-col gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3.5 pl-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <span
                className="absolute bottom-3 left-0 top-3 w-0.5 rounded-r"
                style={{ background: brand.green }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[14px] font-medium">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                    {item.description}
                  </p>
                ) : null}
              </div>
              {retry ? (
                <Button
                  variant="primary"
                  size="sm"
                  className="shrink-0"
                  loading={startM.isPending && startM.variables?.length === 1 && startM.variables[0] === retry.id}
                  iconRight={<ArrowRight className="h-3.5 w-3.5" />}
                  onClick={() => startM.mutate([retry.id])}
                >
                  {t('today.plan.start')}
                </Button>
              ) : null}
            </li>
          )
        })}
      </ul>

      {startAllIds.length > 1 ? (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          loading={startM.isPending && (startM.variables?.length ?? 0) > 1}
          iconRight={<ArrowRight className="h-3.5 w-3.5" />}
          onClick={() => startM.mutate(startAllIds)}
        >
          {t('today.plan.startAll')}
        </Button>
      ) : null}
    </SdvgCard>
  )
}
