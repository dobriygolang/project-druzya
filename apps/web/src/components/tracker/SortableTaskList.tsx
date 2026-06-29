import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Archive, Check, GripVertical } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'
import type { TrackerTask } from '@/lib/api/tracker'

export const TASK_ESTIMATE_OPTIONS = [0.5, 1, 1.5, 2, 3, 5] as const

function SortableTaskRow({
  task,
  epicName,
  dragDisabled,
  onToggle,
  onArchive,
  onEstimateChange,
}: {
  task: TrackerTask
  epicName?: string
  dragDisabled: boolean
  onToggle: (id: string, done: boolean) => void
  onArchive: (id: string) => void
  onEstimateChange: (id: string, days: number) => void
}) {
  const { t } = useI18n()
  const done = Boolean(task.done)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: dragDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-surface-1',
        isDragging && 'z-10 border-border-strong bg-surface-2 shadow-sm',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...listeners}
        {...attributes}
        disabled={dragDisabled}
        aria-label={t('tracker.dragHandle')}
        className={cn(
          'grid h-7 w-5 shrink-0 touch-none place-items-center rounded text-text-muted/40 transition-colors',
          dragDisabled
            ? 'cursor-default opacity-30'
            : 'cursor-grab hover:text-text-muted active:cursor-grabbing',
        )}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={done ? t('tracker.markOpen') : t('tracker.markDone')}
        onClick={() => onToggle(task.id, !done)}
        className={cn(
          'grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors',
          done
            ? 'border-[var(--sdvg-green,#4CB35C)] bg-[var(--sdvg-green,#4CB35C)] text-white'
            : 'border-border-strong bg-surface-1 hover:border-text-muted',
        )}
      >
        {done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </button>
      <span
        className={cn(
          'min-w-0 flex-1 text-sm leading-snug',
          done ? 'text-text-muted line-through' : 'text-text-primary',
        )}
      >
        {task.title}
      </span>
      {epicName ? (
        <span className="hidden shrink-0 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-text-muted sm:inline">
          {epicName}
        </span>
      ) : null}
      <select
        aria-label={t('tracker.estimateDays')}
        value={task.estimate_days ?? 1}
        onChange={(e) => onEstimateChange(task.id, Number(e.target.value))}
        className="shrink-0 rounded-md border border-border bg-surface-1 px-1.5 py-0.5 text-[11px] text-text-secondary outline-none focus:border-border-strong"
      >
        {TASK_ESTIMATE_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {t('tracker.estimateDaysShort', { days: d })}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={t('tracker.archiveTask')}
        onClick={() => onArchive(task.id)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-text-muted opacity-100 hover:bg-surface-2 hover:text-text-primary sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Archive className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

export function SortableTaskList({
  tasks,
  epicNames,
  dragDisabled,
  onReorder,
  onToggle,
  onArchive,
  onEstimateChange,
}: {
  tasks: TrackerTask[]
  epicNames?: Record<string, string>
  dragDisabled: boolean
  onReorder: (reordered: TrackerTask[]) => void
  onToggle: (id: string, done: boolean) => void
  onArchive: (id: string) => void
  onEstimateChange: (id: string, days: number) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = tasks.findIndex((task) => task.id === active.id)
    const newIndex = tasks.findIndex((task) => task.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onReorder(arrayMove(tasks, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <ul>
          {tasks.map((task) => (
            <SortableTaskRow
              key={task.id}
              task={task}
              epicName={task.epic_id ? epicNames?.[task.epic_id] : undefined}
              dragDisabled={dragDisabled}
              onToggle={onToggle}
              onArchive={onArchive}
              onEstimateChange={onEstimateChange}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}
