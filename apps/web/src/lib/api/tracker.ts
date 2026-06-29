import { api } from '@/lib/apiClient'

export type TrackerProject = {
  id: string
  name: string
  position?: number
}

export type TrackerEpic = {
  id: string
  project_id: string
  name: string
  position?: number
  status?: string
  done_count?: number
  total_count?: number
}

export type TrackerSprint = {
  id: string
  project_id: string
  name: string
  goal?: string
  status?: string
  done_count?: number
  total_count?: number
  created_at?: string
  archived_at?: string
  estimate_days_used?: number
  estimate_days_capacity?: number
}

export type TrackerTask = {
  id: string
  sprint_id: string
  epic_id?: string
  title: string
  done: boolean
  position?: number
  estimate_days?: number
  source?: string
  metadata?: Record<string, unknown>
}

export type TodayReasonCode =
  | 'TODAY_REASON_UNSPECIFIED'
  | 'TODAY_REASON_RETRY'
  | 'TODAY_REASON_REVIEW'
  | 'TODAY_REASON_SKILL'
  | 'TODAY_REASON_MOCK'
  | 'TODAY_REASON_LEARNING'
  | 'TODAY_REASON_USER'

export type TodayTaskEntry = {
  task: TrackerTask
  reason_code?: TodayReasonCode | string
  epic_name?: string
  action_path?: string
}

export type TodayPlan = {
  today_tasks: TodayTaskEntry[]
  later_tasks: TodayTaskEntry[]
  budget_used: number
  budget_capacity: number
  local_date?: string
  active_sprint?: TrackerSprint
  epics?: TrackerEpic[]
}

export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

export function browserLocalDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type TrackerBoard = {
  project?: TrackerProject
  epics?: TrackerEpic[]
  active_sprint?: TrackerSprint
  tasks?: TrackerTask[]
  archived_sprints?: TrackerSprint[]
}

function normalizeBoard(raw: { board?: TrackerBoard }): TrackerBoard {
  const b = raw.board ?? {}
  return {
    project: b.project,
    epics: b.epics ?? [],
    active_sprint: b.active_sprint,
    tasks: b.tasks ?? [],
    archived_sprints: b.archived_sprints ?? [],
  }
}

export function getBoard(projectId?: string) {
  const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
  return api<{ board?: TrackerBoard }>(`/tracker/board${q}`).then(normalizeBoard)
}

function normalizeTodayTask(raw: {
  task?: TrackerTask
  reason_code?: string
  epic_name?: string
  action_path?: string
}): TodayTaskEntry {
  return {
    task: raw.task ?? { id: '', sprint_id: '', title: '', done: false },
    reason_code: raw.reason_code,
    epic_name: raw.epic_name,
    action_path: raw.action_path,
  }
}

export function getToday(localDate?: string, timezone?: string) {
  const params = new URLSearchParams()
  if (localDate) params.set('local_date', localDate)
  if (timezone) params.set('timezone', timezone)
  const q = params.toString() ? `?${params.toString()}` : ''
  return api<{
    today_tasks?: TodayTaskEntry[]
    later_tasks?: TodayTaskEntry[]
    budget_used?: number
    budget_capacity?: number
    local_date?: string
    active_sprint?: TrackerSprint
    epics?: TrackerEpic[]
  }>(`/tracker/today${q}`).then(
    (raw): TodayPlan => ({
      today_tasks: (raw.today_tasks ?? []).map(normalizeTodayTask),
      later_tasks: (raw.later_tasks ?? []).map(normalizeTodayTask),
      budget_used: raw.budget_used ?? 0,
      budget_capacity: raw.budget_capacity ?? 1.5,
      local_date: raw.local_date,
      active_sprint: raw.active_sprint,
      epics: raw.epics ?? [],
    }),
  )
}

export function createProject(name: string) {
  return api<{ project: TrackerProject }>('/tracker/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}

export function createEpic(projectId: string, name: string) {
  return api<{ epic: TrackerEpic }>('/tracker/epics', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, name }),
  })
}

export function reopenEpic(id: string) {
  return api<{ epic: TrackerEpic }>(`/tracker/epics/${encodeURIComponent(id)}/reopen`, {
    method: 'POST',
    body: '{}',
  })
}

export function createSprint(projectId: string, name?: string, goal?: string) {
  return api<{ sprint: TrackerSprint }>('/tracker/sprints', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId, name, goal }),
  })
}

export function createTask(
  sprintId: string,
  title: string,
  epicId?: string,
  estimateDays?: number,
  metadata?: Record<string, unknown>,
) {
  return api<{ task: TrackerTask }>('/tracker/tasks', {
    method: 'POST',
    body: JSON.stringify({
      sprint_id: sprintId,
      title,
      epic_id: epicId,
      estimate_days: estimateDays,
      source: 'TASK_SOURCE_USER',
      metadata,
    }),
  })
}

export function updateTask(
  id: string,
  patch: {
    title?: string
    done?: boolean
    epic_id?: string | null
    position?: number
    archived?: boolean
    estimate_days?: number
  },
) {
  return api<{ task: TrackerTask }>(`/tracker/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
}

export function getSprintTasks(sprintId: string) {
  return api<{ tasks?: TrackerTask[] }>(
    `/tracker/sprints/${encodeURIComponent(sprintId)}/tasks`,
  ).then((r) => r.tasks ?? [])
}

export function archiveSprint(id: string) {
  return api<{ sprint: TrackerSprint }>(`/tracker/sprints/${encodeURIComponent(id)}/archive`, {
    method: 'POST',
    body: '{}',
  })
}

export function exportBoard(projectId?: string) {
  const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
  return api<{ markdown: string }>(`/tracker/export${q}`).then((r) => r.markdown)
}

export type TrackerUserSettings = {
  smart_parse_enabled: boolean
  google_calendar_sync_enabled: boolean
  google_calendar_connected: boolean
}

function normalizeSettings(raw: { settings?: TrackerUserSettings }): TrackerUserSettings {
  const s = raw.settings ?? ({} as TrackerUserSettings)
  return {
    smart_parse_enabled: s.smart_parse_enabled ?? false,
    google_calendar_sync_enabled: s.google_calendar_sync_enabled ?? false,
    google_calendar_connected: s.google_calendar_connected ?? false,
  }
}

export function getSettings() {
  return api<{ settings?: TrackerUserSettings }>('/tracker/settings').then(normalizeSettings)
}

export function updateSettings(patch: {
  smart_parse_enabled?: boolean
  google_calendar_sync_enabled?: boolean
}) {
  return api<{ settings?: TrackerUserSettings }>('/tracker/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then(normalizeSettings)
}

export function getGoogleCalendarAuthURL() {
  return api<{ url: string }>('/tracker/integrations/google/url').then((r) => r.url)
}

export function disconnectGoogleCalendar() {
  return api<{ settings?: TrackerUserSettings }>('/tracker/integrations/google/disconnect', {
    method: 'POST',
    body: '{}',
  }).then(normalizeSettings)
}
