import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Check, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, SdvgCard } from '@/components/brand/SdvgCard'
import { TodayPageShell } from '@/components/today/TodayPageShell'
import { Button } from '@/components/ui/Button'
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
  updateSettings,
  updateTask,
  type TrackerBoard,
  type TrackerSprint,
  type TrackerTask,
  type TrackerUserSettings,
} from '@/lib/api/tracker'
import { useI18n } from '@/lib/i18n'

type KindFilter = 'all' | 'learning' | 'events' | 'life'

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

function sortByPosition(tasks: TrackerTask[]): TrackerTask[] {
  return [...tasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}

function FilterChips({
  items,
  selected,
  onSelect,
}: {
  items: { id: string; label: string }[]
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={cn(
            'rounded-full border px-3 py-1 text-sm transition-colors',
            selected === item.id
              ? 'border-border-strong bg-surface-2 font-medium text-text-primary'
              : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary',
          )}
        >
          {item.label}
        </button>
      ))}
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
      <div className="flex flex-col gap-4 text-sm">
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
    </SdvgCard>
  )
}

function TaskRow({
  task,
  canMoveUp,
  canMoveDown,
  onToggle,
  onArchive,
  onMove,
}: {
  task: TrackerTask
  canMoveUp: boolean
  canMoveDown: boolean
  onToggle: (id: string, done: boolean) => void
  onArchive: (id: string) => void
  onMove: (id: string, direction: 'up' | 'down') => void
}) {
  const { t } = useI18n()
  const done = Boolean(task.done)

  return (
    <li className="group flex items-center gap-2 rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-surface-1">
      <GripVertical className="h-4 w-4 shrink-0 text-text-muted/40" aria-hidden="true" />
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
      <div className="flex shrink-0 items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <button
          type="button"
          aria-label={t('tracker.moveUp')}
          disabled={!canMoveUp}
          onClick={() => onMove(task.id, 'up')}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t('tracker.moveDown')}
          disabled={!canMoveDown}
          onClick={() => onMove(task.id, 'down')}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={t('tracker.archiveTask')}
          onClick={() => onArchive(task.id)}
          className="grid h-7 w-7 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text-primary"
        >
          <Archive className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
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
  const qc = useQueryClient()
  const sprint = board.active_sprint
  const project = board.project!
  const [newEpic, setNewEpic] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newSprint, setNewSprint] = useState('')

  const { activeTasks, archivedTasks } = useMemo(() => {
    const all = (board.tasks ?? []).filter((task) => {
      if (epicFilter && task.epic_id !== epicFilter) return false
      return matchesKindFilter(task, kindFilter)
    })
    const sorted = sortByPosition(all)
    return {
      activeTasks: sorted.filter((task) => !isTaskArchived(task)),
      archivedTasks: sorted.filter((task) => isTaskArchived(task)),
    }
  }, [board.tasks, epicFilter, kindFilter])

  const epicM = useMutation({
    mutationFn: (name: string) => createEpic(project.id, name),
    onSuccess: () => {
      setNewEpic('')
      onRefresh()
    },
  })
  const taskM = useMutation({
    mutationFn: (title: string) => createTask(sprint!.id, title, epicFilter ?? undefined),
    onSuccess: () => {
      setNewTask('')
      onRefresh()
    },
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
  const moveM = useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const list = activeTasks
      const idx = list.findIndex((task) => task.id === id)
      if (idx < 0) return
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= list.length) return
      const a = list[idx]
      const b = list[swapIdx]
      await Promise.all([
        updateTask(a.id, { position: b.position ?? swapIdx }),
        updateTask(b.id, { position: a.position ?? idx }),
      ])
    },
    onSuccess: onRefresh,
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
    },
  })

  const done = activeTasks.filter((task) => task.done).length
  const kindItems = [
    { id: 'all', label: t('tracker.filterAll') },
    { id: 'learning', label: t('tracker.filterLearning') },
    { id: 'events', label: t('tracker.filterEvents') },
    { id: 'life', label: t('tracker.filterLife') },
  ]
  const epicItems = [
    { id: '__all__', label: t('tracker.epicAll') },
    ...(board.epics ?? []).map((e) => ({ id: e.id, label: e.name })),
  ]

  return (
    <TodayPageShell>
      <PageHeader
        title={t('tracker.boardTitle')}
        action={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => exportM.mutate()} disabled={exportM.isPending}>
              {t('tracker.export')}
            </Button>
            <Link to="/today" className="text-sm text-text-secondary no-underline hover:text-text-primary">
              {t('tracker.backToday')}
            </Link>
          </div>
        }
      />

      <TrackerSettingsPanel settings={settings} onRefresh={onRefresh} />

      <SdvgCard eyebrow={`${t('tracker.epics')} · ${board.epics?.length ?? 0}`} title={t('tracker.epics')}>
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
        <div className="mt-4 flex flex-col gap-3">
          <FilterChips
            items={kindItems}
            selected={kindFilter}
            onSelect={(id) => onSelectKind(id as KindFilter)}
          />
          <FilterChips
            items={epicItems}
            selected={epicFilter ?? '__all__'}
            onSelect={(id) => onSelectEpic(id === '__all__' ? null : id)}
          />
        </div>
      </SdvgCard>

      {sprint ? (
        <SdvgCard eyebrow={t('tracker.activeSprint')} title={sprint.name}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-text-muted">
              {done}/{activeTasks.length} {t('tracker.doneCount')}
            </p>
            <Button variant="ghost" size="sm" onClick={() => archiveM.mutate()} disabled={archiveM.isPending}>
              {t('tracker.archiveSprint')}
            </Button>
          </div>
          {activeTasks.length === 0 ? (
            <p className="mb-3 text-sm text-text-muted">{t('tracker.noTasks')}</p>
          ) : (
            <ul className="mb-1">
              {activeTasks.map((task, idx) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < activeTasks.length - 1}
                  onToggle={(id, d) => toggleM.mutate({ id, done: d })}
                  onArchive={(id) => archiveTaskM.mutate(id)}
                  onMove={(id, direction) => moveM.mutate({ id, direction })}
                />
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-border-strong"
              placeholder={t('tracker.newTask')}
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newTask.trim() && taskM.mutate(newTask.trim())}
            />
            <Button size="sm" onClick={() => newTask.trim() && taskM.mutate(newTask.trim())}>
              {t('tracker.create')}
            </Button>
          </div>

          {archivedTasks.length > 0 ? (
            <div className="mt-6 border-t border-border pt-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                {t('tracker.archivedTasks')} ({archivedTasks.length})
              </h3>
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
            </div>
          ) : null}
        </SdvgCard>
      ) : null}

      <SdvgCard eyebrow={t('tracker.newSprint')} title={t('tracker.newSprint')}>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-border-strong"
            placeholder={t('tracker.sprintPlaceholder')}
            value={newSprint}
            onChange={(e) => setNewSprint(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sprintM.mutate(newSprint.trim())}
          />
          <Button size="sm" onClick={() => sprintM.mutate(newSprint.trim())}>
            {t('tracker.create')}
          </Button>
        </div>
      </SdvgCard>

      {(board.archived_sprints?.length ?? 0) > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {t('tracker.archivedSprints')} ({board.archived_sprints!.length})
          </h2>
          {board.archived_sprints!.map((s) => (
            <ArchivedSprintCard key={s.id} sprint={s} onUnarchiveTask={onRefresh} />
          ))}
        </section>
      ) : null}
    </TodayPageShell>
  )
}

export default function TasksPage() {
  const qc = useQueryClient()
  const [epicFilter, setEpicFilter] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const boardQ = useQuery({ queryKey: ['tracker-board'], queryFn: () => getBoard() })
  const settingsQ = useQuery({ queryKey: ['tracker-settings'], queryFn: () => getSettings() })

  if (boardQ.isLoading || settingsQ.isLoading) {
    return <div className="py-24 text-center text-sm text-text-muted">…</div>
  }
  if (boardQ.isError || settingsQ.isError) {
    return <div className="py-24 text-center text-sm text-red-500">{String(boardQ.error ?? settingsQ.error)}</div>
  }

  const board = boardQ.data!
  const settings = settingsQ.data!
  if (!board.project || !board.active_sprint) {
    return <div className="py-24 text-center text-sm text-text-muted">…</div>
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
