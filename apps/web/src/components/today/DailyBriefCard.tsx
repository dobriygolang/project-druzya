import { useMutation } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { startRetrySession } from '@/lib/api/interview'
import { useI18n } from '@/lib/i18n'
import type { DailyBrief } from '@/lib/types'

export function DailyBriefCard({ brief }: { brief?: DailyBrief | null }) {
  const { t } = useI18n()
  const navigate = useNavigate()

  const startM = useMutation({
    mutationFn: (ids: string[]) => startRetrySession(ids),
    onSuccess: (data) => navigate(`/interview/session/${data.session.id}`),
  })

  const items = brief?.items ?? []
  if (items.length === 0) {
    return <p className="text-[13px] text-text-muted">{t('today.actions.briefEmpty')}</p>
  }

  const readiness = brief?.readiness_score ?? 0

  return (
    <div className="space-y-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-text-muted">
        {t('today.actions.briefReadiness', { score: readiness })}
      </p>
      <ul className="flex flex-col gap-2.5">
        {items.map((item, index) => {
          const actionLabel = item.action_label ?? t('today.actions.briefDefaultAction')
          const secondaryLabel = item.secondary_action_label
          const action = item.retry_item_id ? (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              loading={
                startM.isPending &&
                startM.variables?.length === 1 &&
                startM.variables[0] === item.retry_item_id
              }
              iconRight={<ArrowRight className="h-3.5 w-3.5" />}
              onClick={() => startM.mutate([item.retry_item_id!])}
            >
              {actionLabel}
            </Button>
          ) : (
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {item.action_path ? (
                <Link to={item.action_path} className="no-underline">
                  <Button variant="ghost" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
                    {actionLabel}
                  </Button>
                </Link>
              ) : null}
              {item.secondary_action_path && secondaryLabel ? (
                <Link to={item.secondary_action_path} className="no-underline">
                  <Button variant="ghost" size="sm">
                    {secondaryLabel}
                  </Button>
                </Link>
              ) : null}
            </div>
          )

          return (
            <li
              key={`${item.type}-${item.title}-${index}`}
              className="relative flex flex-col gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2.5 pl-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <span
                className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r"
                style={{ background: brand.green }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-snug">{item.title}</p>
                {item.description ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">{item.description}</p>
                ) : null}
              </div>
              {action}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
