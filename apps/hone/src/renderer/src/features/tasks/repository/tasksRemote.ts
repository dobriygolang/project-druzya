import { API_BASE_URL, DEV_BEARER_TOKEN } from '@shared/api/config';
import { apiFetch } from '@shared/api/http';
import { useSessionStore } from '@shared/model/session';

import type { TaskCard, TaskKind, TaskStatus } from '../api/tasks';

const BASE = `${API_BASE_URL}/v1/tracker/work/tasks`;

function authHeaders(): Record<string, string> {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}

type JsonWorkTask = Record<string, unknown>;

function pickStr(obj: JsonWorkTask, camel: string, snake: string): string {
  const v = obj[camel] ?? obj[snake];
  return typeof v === 'string' ? v : '';
}

function pickNum(obj: JsonWorkTask, camel: string, snake: string): number | undefined {
  const v = obj[camel] ?? obj[snake];
  return typeof v === 'number' ? v : undefined;
}

function pickTs(obj: JsonWorkTask, camel: string, snake: string): string | undefined {
  const v = obj[camel] ?? obj[snake];
  if (typeof v === 'string' && v.length > 0) return v;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.dateTime === 'string' && o.dateTime.length > 0) return o.dateTime;
    if (typeof o.date_time === 'string' && o.date_time.length > 0) return o.date_time;
    const sec = o.seconds ?? o.Seconds;
    if (typeof sec === 'number' && Number.isFinite(sec)) {
      return new Date(sec * 1000).toISOString();
    }
  }
  return undefined;
}

function unwrapWorkTask(raw: JsonWorkTask): TaskCard {
  return {
    id: pickStr(raw, 'id', 'id'),
    status: pickStr(raw, 'status', 'status') as TaskStatus,
    kind: (pickStr(raw, 'kind', 'kind') || 'custom') as TaskKind,
    title: pickStr(raw, 'title', 'title'),
    createdAt: pickStr(raw, 'createdAt', 'created_at'),
    updatedAt: pickStr(raw, 'updatedAt', 'updated_at'),
    completedAt: pickTs(raw, 'completedAt', 'completed_at'),
    scheduledStart: pickTs(raw, 'scheduledStart', 'scheduled_start'),
    scheduledDurationMin: pickNum(raw, 'scheduledDurationMin', 'scheduled_duration_min'),
    googleEventId: pickStr(raw, 'googleEventId', 'google_event_id') || undefined,
    order: pickNum(raw, 'order', 'order'),
  };
}

function unwrapTaskResponse(j: unknown): TaskCard {
  if (!j || typeof j !== 'object') return unwrapWorkTask({});
  const obj = j as Record<string, unknown>;
  return unwrapWorkTask((obj.task ?? obj) as JsonWorkTask);
}

export async function remoteListTasks(): Promise<TaskCard[]> {
  const resp = await apiFetch(BASE, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`listTasks: ${resp.status}`);
  const j = (await resp.json()) as { tasks?: JsonWorkTask[] };
  return (j.tasks ?? []).map(unwrapWorkTask);
}

export async function remoteCreateTask(input: { title: string; kind?: TaskKind }): Promise<TaskCard> {
  const resp = await apiFetch(BASE, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ kind: input.kind ?? 'custom', title: input.title }),
  });
  if (!resp.ok) throw new Error(`createTask: ${resp.status}`);
  return unwrapTaskResponse(await resp.json());
}

export async function remoteMoveTaskStatus(taskId: string, status: TaskStatus): Promise<TaskCard> {
  const resp = await apiFetch(`${BASE}/${encodeURIComponent(taskId)}/status`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ id: taskId, status }),
  });
  if (!resp.ok) throw new Error(`moveTaskStatus: ${resp.status}`);
  return unwrapTaskResponse(await resp.json());
}

export async function remoteDeleteTask(taskId: string): Promise<void> {
  const resp = await apiFetch(`${BASE}/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`deleteTask: ${resp.status}`);
}

export async function remoteScheduleTask(
  taskId: string,
  start: Date | string,
  durationMin: number,
): Promise<TaskCard> {
  const startIso =
    typeof start === 'string'
      ? start
      : Number.isNaN(start.getTime())
        ? new Date().toISOString()
        : start.toISOString();
  const duration = Math.max(15, Math.min(480, durationMin));
  const resp = await apiFetch(`${BASE}/${encodeURIComponent(taskId)}/schedule`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ scheduledStartIso: startIso, durationMin: duration }),
  });
  if (!resp.ok) throw new Error(`scheduleTask: ${resp.status}`);
  return unwrapTaskResponse(await resp.json());
}

export async function remoteUnscheduleTask(taskId: string): Promise<TaskCard> {
  const resp = await apiFetch(`${BASE}/${encodeURIComponent(taskId)}/unschedule`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ id: taskId }),
  });
  if (!resp.ok) throw new Error(`unscheduleTask: ${resp.status}`);
  return unwrapTaskResponse(await resp.json());
}
