import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
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
  updateSettings,
  updateTask,
  type TrackerBoard,
  type TrackerEpic,
  type TrackerTask,
  type TrackerUserSettings,
} from '@/lib/api/tracker'
import { useI18n } from '@/lib/i18n'

type KindFilter = 'all' | 'learning' | 'events' | 'life'

function taskKind(task: TrackerTask): string {
  const k = task.metadata?.task_kind
  return typeof k === 'string' ? k : 'general'
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

function KindFilterBar({
  selected,
  onSelect,
}: {
  selected: KindFilter
  onSelect: (k: KindFilter) => void
}) {
  const { t } = useI18n()
  const items: { id: KindFilter; label: string }[] = [
    { id: 'all', label: t('tracker.filterAll') },
    { id: 'learning', label: t('tracker.filterLearning') },
    { id: 'events', label: t('tracker.filterEvents') },
    { id: 'life', label: t('tracker.filterLife') },
  ]
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className={`rounded-full border px-3 py-0.5 ${selected === item.id ? 'border-border-strong bg-surface-2' : 'border-border text-text-secondary'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function TrackerSettingsPanel({ settings, onRefresh }: { settings: TrackerUserSettings; onRefresh: () => void }) {
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
    <section className="sdvg-card p-5" style={{ boxShadow: brand.cardShadow }}>
      <h2 className="mb-4 text-sm font-medium text-text-primary">{t('tracker.settings.title')}</h2>
      <div className="flex flex-col gap-4 text-sm">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
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
            className="mt-1"
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
    </section>
  )
}

function EpicFilter({
  epics,
  selected,
  onSelect,
}: {
  epics: TrackerEpic[]
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={`rounded-full border px-3 py-0.5 ${selected === null ? 'border-border-strong bg-surface-2' : 'border-border text-text-secondary'}`}
      >
        {t('tracker.epicAll')}
      </button>
      {epics.map((e) => (
        <button
          key={e.id}
          type="button"
          onClick={() => onSelect(e.id)}
          className={`rounded-full border px-3 py-0.5 ${selected === e.id ? 'border-border-strong bg-surface-2' : 'border-border text-text-secondary'}`}
        >
          {e.name}
        </button>
      ))}
    </div>
  )
}

function TaskRow({
  task,
  onToggle,
}: {
  task: TrackerTask
  onToggle: (id: string, done: boolean) => void
}) {
  return (
    <li className="flex items-start gap-3 border-b border-border/60 py-2.5 last:border-0">
      <button
        type="button"
        aria-label={task.title}
        onClick={() => onToggle(task.id, !task.done)}
        className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${task.done ? 'border-[var(--sdvg-green,#4CB35C)] bg-[var(--sdvg-green,#4CB35C)]' : 'border-border-strong'}`}
      />
      <span className={`text-sm ${task.done ? 'text-text-muted line-through' : 'text-text-primary'}`}>{task.title}</span>
    </li>
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
  const sprint = board.active_sprint
  const project = board.project!
  const [newEpic, setNewEpic] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newSprint, setNewSprint] = useState('')

  const tasks = useMemo(() => {
    const all = board.tasks ?? []
    return all.filter((task) => {
      if (epicFilter && task.epic_id !== epicFilter) return false
      return matchesKindFilter(task, kindFilter)
    })
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

  const done = tasks.filter((task) => task.done).length

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-8">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-medium text-text-primary">{t('tracker.boardTitle')}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => exportM.mutate()} disabled={exportM.isPending}>
            {t('tracker.export')}
          </Button>
          <Link to="/today" className="text-sm text-text-secondary no-underline hover:text-text-primary">
            {t('tracker.backToday')}
          </Link>
        </div>
      </header>

      <TrackerSettingsPanel settings={settings} onRefresh={onRefresh} />

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-text-muted">
          {t('tracker.epics')} {board.epics?.length ?? 0}
        </h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none"
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
          <KindFilterBar selected={kindFilter} onSelect={onSelectKind} />
          <EpicFilter epics={board.epics ?? []} selected={epicFilter} onSelect={onSelectEpic} />
        </div>
      </section>

      {sprint && (
        <section className="sdvg-card p-5" style={{ boxShadow: brand.cardShadow }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-primary">
              {sprint.name}{' '}
              <span className="text-text-muted">
                {done}/{tasks.length}
              </span>
            </h2>
            <Button variant="ghost" size="sm" onClick={() => archiveM.mutate()} disabled={archiveM.isPending}>
              {t('tracker.archive')}
            </Button>
          </div>
          <ul>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} onToggle={(id, d) => toggleM.mutate({ id, done: d })} />
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none"
              placeholder={t('tracker.newTask')}
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && newTask.trim() && taskM.mutate(newTask.trim())}
            />
            <Button size="sm" onClick={() => newTask.trim() && taskM.mutate(newTask.trim())}>
              {t('tracker.create')}
            </Button>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs uppercase tracking-widest text-text-muted">{t('tracker.newSprint')}</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm outline-none"
            placeholder={t('tracker.sprintPlaceholder')}
            value={newSprint}
            onChange={(e) => setNewSprint(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sprintM.mutate(newSprint.trim())}
          />
          <Button size="sm" onClick={() => sprintM.mutate(newSprint.trim())}>
            {t('tracker.create')}
          </Button>
        </div>
      </section>

      {(board.archived_sprints?.length ?? 0) > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-widest text-text-muted">
            {t('tracker.archive')} {board.archived_sprints!.length}
          </h2>
        </section>
      )}
    </div>
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
