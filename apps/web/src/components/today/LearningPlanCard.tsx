import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { SdvgCard } from '@/components/brand/SdvgCard'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import {
  completeLearningPlanItem,
  dismissLearningPlanItem,
} from '@/lib/api/recommendation'
import type { LearningPlanItem } from '@/lib/types'

export function LearningPlanCard({
  items,
  loading,
}: {
  items: LearningPlanItem[]
  loading?: boolean
}) {
  const qc = useQueryClient()

  const completeM = useMutation({
    mutationFn: completeLearningPlanItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
  })

  const dismissM = useMutation({
    mutationFn: dismissLearningPlanItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }),
  })

  if (loading) {
    return <section className="sdvg-card h-32 animate-pulse bg-surface-2 p-6" aria-hidden />
  }

  const active = items.filter((i) => i.status !== 'completed' && i.status !== 'dismissed')
  if (active.length === 0) return null

  return (
    <SdvgCard
      eyebrow="План"
      title="План обучения"
      description={`${active.length} ${active.length === 1 ? 'задача' : active.length < 5 ? 'задачи' : 'задач'} на повтор`}
    >
      <ul className="flex flex-col gap-2">
        {active.slice(0, 5).map((item) => (
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
            <div className="flex shrink-0 gap-2">
              <Button
                variant="ghost"
                size="sm"
                loading={completeM.isPending && completeM.variables === item.id}
                icon={<Check className="h-3.5 w-3.5" />}
                onClick={() => completeM.mutate(item.id)}
              >
                Готово
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={dismissM.isPending && dismissM.variables === item.id}
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => dismissM.mutate(item.id)}
              >
                Скрыть
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </SdvgCard>
  )
}
