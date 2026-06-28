import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ListTodo, X } from 'lucide-react'
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
    return (
      <section className="h-32 animate-pulse rounded-xl border border-border bg-surface-2" aria-hidden />
    )
  }

  const active = items.filter((i) => i.status !== 'completed' && i.status !== 'dismissed')
  if (active.length === 0) return null

  return (
    <section className="rounded-xl border border-border bg-surface-1 p-5">
      <header className="mb-3 flex items-center gap-2">
        <ListTodo className="h-4 w-4 text-text-secondary" aria-hidden />
        <h2 className="font-display text-base font-bold">План обучения</h2>
      </header>
      <ul className="flex flex-col gap-3">
        {active.slice(0, 5).map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{item.title}</p>
              {item.description ? (
                <p className="mt-1 text-[13px] text-text-secondary">{item.description}</p>
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
    </section>
  )
}
