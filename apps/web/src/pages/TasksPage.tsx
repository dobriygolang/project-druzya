import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Check, ChevronDown, Clock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader, SdvgCard } from '@/components/brand/SdvgCard'
import { SortableTaskList, TASK_ESTIMATE_OPTIONS } from '@/components/tracker/SortableTaskList'
import { CollapsibleSection } from '@/components/tracker/CollapsibleSection'
import { TrackerProgressBar } from '@/components/tracker/TrackerProgressBar'
import { TodayPageShell } from '@/components/today/TodayPageShell'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import {
  archiveSprint,
  createEpic,
  createSprint,
  createTask,
  disconnectGoogleCalendar,
  exportBoard,
  getBoard,
  getGoogleCalendarAuthURL,
  getSettings,
  getSprintTasks,
  reopenEpic,
  updateEpicSprintScope,
  updateSettings,
  updateTask,
  type TrackerBoard,
  type TrackerEpic,
  type TrackerSprint,
  type TrackerTask,
  type TrackerUserSettings,
} from '@/lib/api/tracker'
import { formatApiError } from '@/lib/apiClient'
import { useI18n } from '@/lib/i18n'

type KindFilter = 'all' | 'learning' | 'events' | 'life'

const SPRINT_DAYS = 14

function taskKind(task: TrackerTask): string {
  const k = task.metadata?.task_kind
  return typeof k === 'string' ? k : 'general'
}

function isTaskArchived(task: TrackerTask): boolean {
  return task.metadata?.archived === true
}

function matchesKindFilter(task: TrackerTask, filter: KindFilter): boolean {
  const kind = taskKind(task)
  switch (filter) {
    case 'learning':
      return kind === 'learning' || kind === 'system'
    case 'events':
      return kind === 'event'
    case 'life':
      return kind === 'life' || kind === 'general'
    default:
      return true
  }
}

function isEpicDone(epic: TrackerEpic): boolean {
  const s = epic.status ?? ''
  return s === 'done' || s.includes('DONE')
}

function isEpicEmpty(epic: TrackerEpic): boolean {
  return (epic.total_count ?? 0) === 0
}

function formatDays(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function sortByPosition(tasks: TrackerTask[]): TrackerTask[] {
  return [...tasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}

function EpicCard({
  epic,
  selected,
  deferred,
  onSelect,
  onToggleSprintScope,
  sprintScopePending,
  onReopen,
  reopenPending,
}: {
  epic: TrackerEpic
  selected: boolean
  deferred?: boolean
  onSelect: () => void
  onToggleSprintScope?: () => void
  sprintScopePending?: boolean
  onReopen?: () => void
  reopenPending?: boolean
}) {
  const { t } = useI18n()
  const doneEpic = isEpicDone(epic)
  const emptyEpic = isEpicEmpty(epic)
  const epicDone = epic.done_count ?? 0
  const epicTotal = epic.total_count ?? 0

  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 transition-colors',
        selected ? 'border-border-strong bg-surface-2' : 'border-border',
        doneEpic && 'border-[var(--sdvg-green,#4CB35C)]/30 bg-[var(--sdvg-green,#4CB35C)]/5',
        deferred && !doneEpic && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'min-w-0 flex-1 rounded-md py-0.5 text-left transition-colors',
            'hover:bg-surface-1/80 active:bg-surface-1',
            selected && 'bg-surface-1/50',
          )}
        >
          <span className={cn('truncate text-sm font-medium', doneEpic && 'line-through opacity-70')}>
            {epic.name}
          </span>
        </button>
        {!doneEpic && onToggleSprintScope ? (
          <button
            type="button"
            disabled={sprintScopePending}
            title={deferred ? t('tracker.epicIncludeSprint') : t('tracker.epicDeferSprint')}
            onClick={onToggleSprintScope}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:bg-surface-1 hover:text-text-primary disabled:opacity-50"
          >
            {deferred ? t('tracker.epicIncludeShort') : t('tracker.epicDeferShort')}
          </button>
        ) : null}
        <span className="shrink-0 text-xs text-text-muted">
          {emptyEpic
            ? t('tracker.epicNoTasks')
            : doneEpic
              ? t('tracker.epicDone')
              : t('tracker.epicProgress', { done: epicDone, total: epicTotal })}
        </span>
      </div>
      {!emptyEpic ? (
        <TrackerProgressBar
          className="mt-1 pointer-events-none select-none"
          value={epicDone}
          max={epicTotal}
          label={`${epicDone}/${epicTotal}`}
          mode="tasks"
        />
      ) : null}
      {doneEpic && onReopen ? (
        <Button
          size="sm"
          variant="ghost"
          className="mt-1 h-7 px-2 text-xs"
          disabled={reopenPending}
          onClick={onReopen}
        >
          {t('tracker.epicReopen')}
        </Button>
      ) : null}
    </div>
  )
}

function sprintDaysLeft(createdAt?: string): number | null {
  if (!createdAt) return null
  const start = new Date(createdAt)
  if (Number.isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setDate(end.getDate() + SPRINT_DAYS)
  const msLeft = end.getTime() - Date.now()
  if (msLeft <= 0) return 0
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000))
}

function BoardOverview({
  sprint,
  archivedCount,
  epics,
  taskCount,
}: {
  sprint?: TrackerSprint
  archivedCount: number
  epics: TrackerEpic[]
  taskCount: number
}) {
  const { t } = useI18n()
  const daysLeft = sprintDaysLeft(sprint?.created_at)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border bg-surface-1 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('tracker.overviewActive')}</p>
        <p className="mt-1 truncate text-sm font-medium text-text-primary">
          {sprint?.name ?? t('tracker.noActiveSprint')}
        </p>
        {sprint && daysLeft !== null ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-text-muted">
            <Clock className="h-3 w-3 shrink-0" aria-hidden />
            {daysLeft === 0
              ? t('tracker.sprintEnded')
              : daysLeft === 1
                ? t('tracker.sprintEndsToday')
                : t('tracker.sprintEndsIn', { days: daysLeft })}
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border border-border bg-surface-1 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('tracker.overviewArchived')}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{archivedCount}</p>
      </div>
      <div className="rounded-xl border border-border bg-surface-1 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('tracker.overviewEpics')}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{epics.length}</p>
      </div>
      <div className="rounded-xl border border-border bg-surface-1 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{t('tracker.overviewTasks')}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{taskCount}</p>
      </div>
    </div>
  )
}

function TrackerSettingsPanel({
  settings,
  onRefresh,
}: {
  settings: TrackerUserSettings
  onRefresh: () => void
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const settingsM = useMutation({
    mutationFn: (patch: { smart_parse_enabled?: boolean; google_calendar_sync_enabled?: boolean }) =>
      updateSettings(patch),
    onSuccess: onRefresh,
  })
  const connectM = useMutation({
    mutationFn: () => getGoogleCalendarAuthURL(),
    onSuccess: (url) => {
      window.location.href = url
    },
  })
  const disconnectM = useMutation({
    mutationFn: () => disconnectGoogleCalendar(),
    onSuccess: onRefresh,
  })

  return (
    <SdvgCard eyebrow={t('tracker.settings.title')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left text-sm text-text-secondary"
      >
        <span>{t('tracker.settings.title')}</span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="mt-4 flex flex-col gap-4 border-t border-border pt-4 text-sm">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border accent-text-primary"
              checked={settings.smart_parse_enabled}
              disabled={settingsM.isPending}
              onChange={(e) => settingsM.mutate({ smart_parse_enabled: e.target.checked })}
            />
            <span>
              <span className="font-medium text-text-primary">{t('tracker.settings.smartParse')}</span>
              <span className="mt-0.5 block text-text-muted">{t('tracker.settings.smartParseHint')}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border accent-text-primary"
              checked={settings.google_calendar_sync_enabled}
              disabled={settingsM.isPending}
              onChange={(e) => settingsM.mutate({ google_calendar_sync_enabled: e.target.checked })}
            />
            <span>
              <span className="font-medium text-text-primary">{t('tracker.settings.googleSync')}</span>
              <span className="mt-0.5 block text-text-muted">{t('tracker.settings.googleSyncHint')}</span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {settings.google_calendar_connected ? (
              <>
                <span className="text-text-secondary">{t('tracker.settings.connected')}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => disconnectM.mutate()}
                  disabled={disconnectM.isPending}
                >
                  {t('tracker.settings.disconnectGoogle')}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => connectM.mutate()} disabled={connectM.isPending}>
                {t('tracker.settings.connectGoogle')}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </SdvgCard>
  )
}

function ArchivedSprintCard({ sprint, onUnarchiveTask }: { sprint: TrackerSprint; onUnarchiveTask: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const tasksQ = useQuery({
    queryKey: ['tracker-sprint-tasks', sprint.id],
    queryFn: () => getSprintTasks(sprint.id),
    enabled: open,
  })

  const unarchiveM = useMutation({
    mutationFn: (taskId: string) => updateTask(taskId, { archived: false }),
    onSuccess: () => {
      void tasksQ.refetch()
      onUnarchiveTask()
    },
  })

  return (
    <div className="rounded-xl border border-border bg-surface-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-text-primary">{sprint.name}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {t('tracker.archivedSprintMeta', {
              done: sprint.done_count ?? 0,
              total: sprint.total_count ?? 0,
            })}
          </p>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-3">
          {tasksQ.isLoading ? (
            <p className="text-sm text-text-muted">…</p>
          ) : tasksQ.isError ? (
            <p className="text-sm text-red-500">{String(tasksQ.error)}</p>
          ) : (tasksQ.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-text-muted">{t('tracker.noTasks')}</p>
          ) : (
            <ul className="space-y-1">
              {sortByPosition(tasksQ.data ?? []).map((task) => (
                <li key={task.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span
                    className={cn(
                      'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
                      task.done
                        ? 'border-[var(--sdvg-green,#4CB35C)] bg-[var(--sdvg-green,#4CB35C)]'
                        : 'border-border-strong',
                    )}
                  >
                    {task.done ? <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} /> : null}
                  </span>
                  <span className={cn('flex-1', task.done && 'text-text-muted line-through')}>{task.title}</span>
                  {isTaskArchived(task) ? (
                    <Button size="sm" variant="ghost" onClick={() => unarchiveM.mutate(task.id)}>
                      {t('tracker.restoreTask')}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

function NoActiveSprintCard({
  onCreate,
  pending,
}: {
  onCreate: (name: string) => void
  pending: boolean
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')

  return (
    <SdvgCard eyebrow={t('tracker.activeSprint')} title={t('tracker.noActiveSprint')}>
      <p className="mb-4 text-sm text-text-muted">{t('tracker.noActiveSprintHint')}</p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-border-strong"
          placeholder={t('tracker.sprintPlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !pending && sprintCreate(name)}
        />
        <Button size="sm" onClick={() => sprintCreate(name)} disabled={pending}>
          {t('tracker.startSprint')}
        </Button>
      </div>
    </SdvgCard>
  )

  function sprintCreate(raw: string) {
    onCreate(raw.trim())
    setName('')
  }
}

function isEpicDeferred(epicName: string, deferred: string[]): boolean {
  const key = epicName.trim().toLowerCase()
  return deferred.some((name) => name.trim().toLowerCase() === key)
}

function SprintPanel({
  board,
  settings,
  epicFilter,
  kindFilter,
  onSelectEpic,
  onSelectKind,
  onRefresh,
}: {
  board: TrackerBoard
  settings: TrackerUserSettings
  epicFilter: string | null
  kindFilter: KindFilter
  onSelectEpic: (id: string | null) => void
  onSelectKind: (k: KindFilter) => void
  onRefresh: () => void
}) {
  const { t } = useI18n()
  const toast = useToast()
  const qc = useQueryClient()
  const sprint = board.active_sprint
  const project = board.project!
  const epics = board.epics ?? []
  const [newEpic, setNewEpic] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newTaskEpicId, setNewTaskEpicId] = useState<string>('')
  const [newTaskEstimate, setNewTaskEstimate] = useState<number>(1)
  const [newSprint, setNewSprint] = useState('')

  const epicNameById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const epic of epics) map[epic.id] = epic.name
    return map
  }, [epics])

  const deferredEpics = settings.deferred_sprint_epic_names ?? []

  const { activeTasks, archivedTasks, deferredTasks } = useMemo(() => {
    const all = (board.tasks ?? []).filter((task) => {
      if (epicFilter) {
        return task.epic_id === epicFilter && matchesKindFilter(task, kindFilter)
      }
      const epicName = task.epic_id ? epicNameById[task.epic_id] ?? '' : ''
      if (!epicFilter && epicName && isEpicDeferred(epicName, deferredEpics)) {
        return false
      }
      return matchesKindFilter(task, kindFilter)
    })
    const deferredOnly = (board.tasks ?? []).filter((task) => {
      if (epicFilter) return false
      const epicName = task.epic_id ? epicNameById[task.epic_id] ?? '' : ''
      return epicName !== '' && isEpicDeferred(epicName, deferredEpics) && matchesKindFilter(task, kindFilter)
    })
    const sorted = sortByPosition(all)
    return {
      activeTasks: sorted.filter((task) => !isTaskArchived(task)),
      archivedTasks: sorted.filter((task) => isTaskArchived(task)),
      deferredTasks: sortByPosition(deferredOnly.filter((task) => !isTaskArchived(task))),
    }
  }, [board.tasks, epicFilter, kindFilter, epicNameById, deferredEpics])

  const dragDisabled = kindFilter !== 'all' || epicFilter !== null

  const epicM = useMutation({
    mutationFn: (name: string) => createEpic(project.id, name),
    onSuccess: () => {
      setNewEpic('')
      onRefresh()
    },
  })
  const reopenEpicM = useMutation({
    mutationFn: (id: string) => reopenEpic(id),
    onSuccess: onRefresh,
    onError: (err) => toast.push(formatApiError(err), 'error'),
  })
  const epicScopeM = useMutation({
    mutationFn: ({ epicId, deferred }: { epicId: string; deferred: boolean }) =>
      updateEpicSprintScope(epicId, deferred),
    onSuccess: onRefresh,
    onError: (err) => toast.push(formatApiError(err), 'error'),
  })
  const taskM = useMutation({
    mutationFn: ({ title, epicId, estimateDays }: { title: string; epicId?: string; estimateDays: number }) =>
      createTask(sprint!.id, title, epicId || undefined, estimateDays),
    onSuccess: () => {
      setNewTask('')
      onRefresh()
    },
    onError: (err) => toast.push(formatApiError(err), 'error'),
  })
  const estimateM = useMutation({
    mutationFn: ({ id, estimateDays }: { id: string; estimateDays: number }) =>
      updateTask(id, { estimate_days: estimateDays }),
    onSuccess: onRefresh,
    onError: (err) => toast.push(formatApiError(err), 'error'),
  })
  const toggleM = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => updateTask(id, { done }),
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: ['tracker-board'] })
      const prev = qc.getQueryData<TrackerBoard>(['tracker-board'])
      if (prev?.tasks) {
        qc.setQueryData<TrackerBoard>(['tracker-board'], {
          ...prev,
          tasks: prev.tasks.map((task) => (task.id === id ? { ...task, done } : task)),
        })
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tracker-board'], ctx.prev)
    },
    onSettled: onRefresh,
  })
  const archiveTaskM = useMutation({
    mutationFn: (id: string) => updateTask(id, { archived: true }),
    onSuccess: onRefresh,
  })
  const reorderM = useMutation({
    mutationFn: async (reordered: TrackerTask[]) => {
      const updates = reordered
        .map((task, index) => ({ id: task.id, position: index, prev: task.position ?? 0 }))
        .filter((u) => u.position !== u.prev)
      await Promise.all(updates.map((u) => updateTask(u.id, { position: u.position })))
    },
    onMutate: async (reordered) => {
      await qc.cancelQueries({ queryKey: ['tracker-board'] })
      const prev = qc.getQueryData<TrackerBoard>(['tracker-board'])
      if (prev?.tasks) {
        const posMap = new Map(reordered.map((task, index) => [task.id, index]))
        qc.setQueryData<TrackerBoard>(['tracker-board'], {
          ...prev,
          tasks: prev.tasks.map((task) =>
            posMap.has(task.id) ? { ...task, position: posMap.get(task.id)! } : task,
          ),
        })
      }
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['tracker-board'], ctx.prev)
    },
    onSettled: onRefresh,
  })
  const sprintM = useMutation({
    mutationFn: (name: string) => createSprint(project.id, name || undefined),
    onSuccess: () => {
      setNewSprint('')
      onRefresh()
    },
  })
  const archiveM = useMutation({
    mutationFn: () => archiveSprint(sprint!.id),
    onSuccess: onRefresh,
  })
  const exportM = useMutation({
    mutationFn: () => exportBoard(project.id),
    onSuccess: (md) => {
      void navigator.clipboard.writeText(md)
      toast.push(t('tracker.exportCopied'), 'success')
    },
  })

  const done = activeTasks.filter((task) => task.done).length
  const openEpics = epics.filter((e) => !isEpicDone(e))
  const doneEpics = epics.filter((e) => isEpicDone(e))
  const kindItems = [
    { id: 'all', label: t('tracker.filterAll') },
    { id: 'learning', label: t('tracker.filterLearning') },
    { id: 'events', label: t('tracker.filterEvents') },
    { id: 'life', label: t('tracker.filterLife') },
  ]
  const epicFilterOptions = [
    { value: '__all__', label: t('tracker.epicAll') },
    ...openEpics.map((e) => ({ value: e.id, label: e.name })),
  ]
  const taskEpicOptions = [
    { value: '', label: t('tracker.noEpic') },
    ...openEpics.map((e) => ({ value: e.id, label: e.name })),
  ]

  const activeTaskTotal = (board.tasks ?? []).filter((task) => !isTaskArchived(task)).length
  const sprintCapacity = sprint?.estimate_days_capacity ?? 10
  const sprintUsed = sprint?.estimate_days_used ?? 0
  const sprintOver = sprintUsed > sprintCapacity + 1e-9
  const archivedSprintCount = board.archived_sprints?.length ?? 0
  const archiveTotalCount = archivedTasks.length + archivedSprintCount

  return (
    <TodayPageShell>
      <PageHeader
        title={t('tracker.boardTitle')}
        action={
          <Button variant="ghost" size="sm" onClick={() => exportM.mutate()} disabled={exportM.isPending}>
            {t('tracker.export')}
          </Button>
        }
      />

      <BoardOverview
        sprint={sprint}
        archivedCount={board.archived_sprints?.length ?? 0}
        epics={epics}
        taskCount={activeTaskTotal}
      />

      {sprint ? (
        <SdvgCard eyebrow={t('tracker.activeSprint')} title={sprint.name}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('tracker.sprintTasksProgress')}
              </p>
              <TrackerProgressBar
                value={done}
                max={activeTasks.length}
                label={`${done}/${activeTasks.length}`}
                mode="tasks"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={() => archiveM.mutate()} disabled={archiveM.isPending}>
              {t('tracker.archiveSprint')}
            </Button>
          </div>

          <div className="mb-4 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('tracker.estimateDays')}
              </p>
              {sprintOver ? (
                <span className="text-xs text-[var(--tracker-progress-over,#E8B548)]">
                  {t('tracker.sprintCapacityOver', { over: formatDays(sprintUsed - sprintCapacity) })}
                </span>
              ) : null}
            </div>
            <TrackerProgressBar
              value={sprintUsed}
              max={sprintCapacity}
              label={`${formatDays(sprintUsed)}/${formatDays(sprintCapacity)}`}
              mode="capacity"
            />
            <p className="text-xs text-text-muted">{t('tracker.sprintCapacityHint')}</p>
          </div>

          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div className="min-w-[8.5rem] flex-1">
              <p className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">{t('tracker.filterLabelKind')}</p>
              <Select
                size="sm"
                value={kindFilter}
                onChange={(v) => onSelectKind(v as KindFilter)}
                options={kindItems.map((i) => ({ value: i.id, label: i.label }))}
              />
            </div>
            {openEpics.length > 0 ? (
              <div className="min-w-[8.5rem] flex-1">
                <p className="mb-1 text-[11px] uppercase tracking-wide text-text-muted">{t('tracker.filterLabelEpic')}</p>
                <Select
                  size="sm"
                  value={epicFilter ?? '__all__'}
                  onChange={(v) => onSelectEpic(v === '__all__' ? null : v)}
                  options={epicFilterOptions}
                />
              </div>
            ) : null}
          </div>

          {activeTasks.length === 0 ? (
            <p className="mb-3 text-sm text-text-muted">{t('tracker.noTasks')}</p>
          ) : (
            <>
              {dragDisabled ? (
                <p className="mb-2 text-xs text-text-muted">{t('tracker.reorderFilteredHint')}</p>
              ) : null}
              <SortableTaskList
                tasks={activeTasks}
                epicNames={epicNameById}
                dragDisabled={dragDisabled}
                onReorder={(reordered) => reorderM.mutate(reordered)}
                onToggle={(id, d) => toggleM.mutate({ id, done: d })}
                onArchive={(id) => archiveTaskM.mutate(id)}
                onEstimateChange={(id, days) => estimateM.mutate({ id, estimateDays: days })}
              />
            </>
          )}

          {deferredTasks.length > 0 && epicFilter === null ? (
            <CollapsibleSection
              title={t('tracker.deferredEpicsSection')}
              count={deferredTasks.length}
              defaultOpen={false}
            >
              <p className="mb-2 text-xs text-text-muted">{t('tracker.deferredEpicsHint')}</p>
              <SortableTaskList
                tasks={deferredTasks}
                epicNames={epicNameById}
                dragDisabled
                onReorder={() => {}}
                onToggle={(id, d) => toggleM.mutate({ id, done: d })}
                onArchive={(id) => archiveTaskM.mutate(id)}
                onEstimateChange={(id, days) => estimateM.mutate({ id, estimateDays: days })}
              />
            </CollapsibleSection>
          ) : null}

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-border-strong"
              placeholder={t('tracker.newTask')}
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                newTask.trim() &&
                taskM.mutate({ title: newTask.trim(), epicId: newTaskEpicId, estimateDays: newTaskEstimate })
              }
            />
            <Select
              aria-label={t('tracker.estimateDays')}
              className="w-[5.5rem] shrink-0 sm:w-24"
              value={String(newTaskEstimate)}
              onChange={(v) => setNewTaskEstimate(Number(v))}
              options={TASK_ESTIMATE_OPTIONS.map((d) => ({
                value: String(d),
                label: t('tracker.estimateDaysShort', { days: d }),
              }))}
            />
            {openEpics.length > 0 ? (
              <Select
                className="min-w-[7rem] shrink-0 sm:min-w-[9rem]"
                size="sm"
                value={newTaskEpicId}
                onChange={setNewTaskEpicId}
                options={taskEpicOptions}
              />
            ) : null}
            <Button
              size="sm"
              className="shrink-0"
              disabled={taskM.isPending}
              onClick={() =>
                newTask.trim() &&
                taskM.mutate({ title: newTask.trim(), epicId: newTaskEpicId, estimateDays: newTaskEstimate })
              }
            >
              {t('tracker.create')}
            </Button>
          </div>
        </SdvgCard>
      ) : (
        <NoActiveSprintCard onCreate={(name) => sprintM.mutate(name)} pending={sprintM.isPending} />
      )}

      <SdvgCard
        eyebrow={t('tracker.epics')}
        title={t('tracker.epicsTitleCounts', { open: openEpics.length, done: doneEpics.length })}
      >
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-border-strong"
            placeholder={t('tracker.newEpic')}
            value={newEpic}
            onChange={(e) => setNewEpic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newEpic.trim() && epicM.mutate(newEpic.trim())}
          />
          <Button size="sm" onClick={() => newEpic.trim() && epicM.mutate(newEpic.trim())}>
            {t('tracker.create')}
          </Button>
        </div>
        {openEpics.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {openEpics.map((epic) => (
              <li key={epic.id}>
                <EpicCard
                  epic={epic}
                  selected={epicFilter === epic.id}
                  deferred={isEpicDeferred(epic.name, deferredEpics)}
                  onSelect={() => onSelectEpic(epicFilter === epic.id ? null : epic.id)}
                  onToggleSprintScope={() =>
                    epicScopeM.mutate({
                      epicId: epic.id,
                      deferred: !isEpicDeferred(epic.name, deferredEpics),
                    })
                  }
                  sprintScopePending={epicScopeM.isPending}
                />
              </li>
            ))}
          </ul>
        ) : null}
        {doneEpics.length > 0 ? (
          <div className={openEpics.length > 0 ? 'mt-3' : 'mt-3'}>
            <CollapsibleSection title={t('tracker.epicDone')} count={doneEpics.length} defaultOpen={false}>
              <ul className="flex flex-col gap-2">
                {doneEpics.map((epic) => (
                  <li key={epic.id}>
                    <EpicCard
                      epic={epic}
                      selected={false}
                      onSelect={() => {}}
                      onReopen={() => reopenEpicM.mutate(epic.id)}
                      reopenPending={reopenEpicM.isPending}
                    />
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          </div>
        ) : null}
      </SdvgCard>

      {sprint ? (
        <SdvgCard eyebrow={t('tracker.newSprint')} title={t('tracker.newSprint')}>
          <p className="mb-3 text-sm text-text-muted">{t('tracker.newSprintHint')}</p>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-border-strong"
              placeholder={t('tracker.sprintPlaceholder')}
              value={newSprint}
              onChange={(e) => setNewSprint(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sprintM.mutate(newSprint.trim())}
            />
            <Button size="sm" onClick={() => sprintM.mutate(newSprint.trim())} disabled={sprintM.isPending}>
              {t('tracker.create')}
            </Button>
          </div>
        </SdvgCard>
      ) : null}

      {archiveTotalCount > 0 ? (
        <CollapsibleSection title={t('tracker.archiveSection')} count={archiveTotalCount} defaultOpen={false}>
          <div className="flex flex-col gap-3">
            {archivedTasks.length > 0 ? (
              <ul className="space-y-1">
                {archivedTasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted">
                    <Archive className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 line-through">{task.title}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateTask(task.id, { archived: false }).then(onRefresh)}
                    >
                      {t('tracker.restoreTask')}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {board.archived_sprints?.map((s) => (
              <ArchivedSprintCard key={s.id} sprint={s} onUnarchiveTask={onRefresh} />
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      <TrackerSettingsPanel settings={settings} onRefresh={onRefresh} />
    </TodayPageShell>
  )
}

export default function TasksPage() {
  const { t } = useI18n()
  const qc = useQueryClient()
  const [epicFilter, setEpicFilter] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const boardQ = useQuery({ queryKey: ['tracker-board'], queryFn: () => getBoard() })
  const settingsQ = useQuery({ queryKey: ['tracker-settings'], queryFn: () => getSettings() })

  if (boardQ.isLoading || settingsQ.isLoading) {
    return <div className="py-24 text-center text-sm text-text-muted">{t('common.loading')}</div>
  }
  if (boardQ.isError || settingsQ.isError) {
    return <div className="py-24 text-center text-sm text-red-500">{String(boardQ.error ?? settingsQ.error)}</div>
  }

  const board = boardQ.data!
  const settings = settingsQ.data!
  if (!board.project) {
    return <div className="py-24 text-center text-sm text-text-muted">{t('common.loading')}</div>
  }

  return (
    <SprintPanel
      board={board}
      settings={settings}
      epicFilter={epicFilter}
      kindFilter={kindFilter}
      onSelectEpic={setEpicFilter}
      onSelectKind={setKindFilter}
      onRefresh={() => {
        void qc.invalidateQueries({ queryKey: ['tracker-board'] })
        void qc.invalidateQueries({ queryKey: ['tracker-settings'] })
      }}
    />
  )
}
