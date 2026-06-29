import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { SdvgCard } from '@/components/brand/SdvgCard'
import { Button } from '@/components/ui/Button'
import { createTask, getBoard } from '@/lib/api/tracker'
import { useI18n } from '@/lib/i18n'

export function SprintPreviewCard() {
  const { t } = useI18n()
  const boardQ = useQuery({ queryKey: ['tracker-board'], queryFn: () => getBoard() })

  if (boardQ.isLoading || boardQ.isError || !boardQ.data?.active_sprint) {
    return null
  }

  const open = (boardQ.data.tasks ?? []).filter((task) => !task.done).slice(0, 3)
  if (open.length === 0) {
    return null
  }

  return (
    <SdvgCard eyebrow={t('tracker.sprintPreview.eyebrow')} title={t('tracker.sprintPreview.title')}>
      <ul className="mb-3 flex flex-col gap-1.5">
        {open.map((task) => (
          <li key={task.id} className="text-[13px] text-text-secondary">
            {task.title}
          </li>
        ))}
      </ul>
      <Link to="/tasks" className="no-underline">
        <Button variant="ghost" size="sm">
          {t('tracker.sprintPreview.open')}
        </Button>
      </Link>
    </SdvgCard>
  )
}

export function AddToSprintButton({
  title,
  metadata,
}: {
  title: string
  metadata?: Record<string, unknown>
}) {
  const { t } = useI18n()
  const qc = useQueryClient()
  const m = useMutation({
    mutationFn: async () => {
      const board = await getBoard()
      const sprintId = board.active_sprint?.id
      if (!sprintId) {
        throw new Error('no active sprint')
      }
      return createTask(sprintId, title, undefined, 1, metadata)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tracker-board'] })
    },
  })
  return (
    <Button variant="ghost" size="sm" loading={m.isPending} onClick={() => m.mutate()}>
      {t('tracker.addToSprint')}
    </Button>
  )
}
