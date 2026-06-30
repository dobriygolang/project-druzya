// tasks.ts — REST client for Hone TaskBoard → project-druzya tracker work API.
import { API_BASE_URL, DEV_BEARER_TOKEN } from '@shared/api/config';
import { useSessionStore } from '@shared/model/session';

const BASE = `${API_BASE_URL}/v1/tracker/work/tasks`;

function authHeaders(): Record<string, string> {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'dismissed';
export type TaskKind = 'algo' | 'sysdesign' | 'quiz' | 'reflection' | 'reading' | 'ml' | 'custom';
export type TaskSource = 'ai' | 'user';

export interface TaskCard {
  id: string;
  status: TaskStatus;
  kind: TaskKind;
  source: TaskSource;
  title: string;
  briefMd: string;
  skillKey?: string;
  deepLink?: string;
  recommendedReading?: string[];
  priority: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  manualKindOverride?: boolean;
  scheduledStart?: string;
  scheduledDurationMin?: number;
}

type JsonWorkTask = Record<string, unknown>;

function pickStr(obj: JsonWorkTask, camel: string, snake: string): string {
  const v = obj[camel] ?? obj[snake];
  return typeof v === 'string' ? v : '';
}

function pickNum(obj: JsonWorkTask, camel: string, snake: string): number {
  const v = obj[camel] ?? obj[snake];
  return typeof v === 'number' ? v : 0;
}

function pickBool(obj: JsonWorkTask, camel: string, snake: string): boolean {
  const v = obj[camel] ?? obj[snake];
  return v === true;
}

function pickTs(obj: JsonWorkTask, camel: string, snake: string): string | undefined {
  const v = obj[camel] ?? obj[snake];
  if (typeof v === 'string' && v.length > 0) return v;
  return undefined;
}

function unwrapWorkTask(raw: JsonWorkTask): TaskCard {
  return {
    id: pickStr(raw, 'id', 'id'),
    status: pickStr(raw, 'status', 'status') as TaskStatus,
    kind: (pickStr(raw, 'kind', 'kind') || 'custom') as TaskKind,
    source: (pickStr(raw, 'source', 'source') || 'user') as TaskSource,
    title: pickStr(raw, 'title', 'title'),
    briefMd: pickStr(raw, 'briefMd', 'brief_md'),
    skillKey: pickStr(raw, 'skillKey', 'skill_key') || undefined,
    deepLink: pickStr(raw, 'deepLink', 'deep_link') || undefined,
    priority: pickNum(raw, 'priority', 'priority'),
    createdAt: pickStr(raw, 'createdAt', 'created_at'),
    updatedAt: pickStr(raw, 'updatedAt', 'updated_at'),
    completedAt: pickTs(raw, 'completedAt', 'completed_at'),
    manualKindOverride: pickBool(raw, 'manualKindOverride', 'manual_kind_override'),
    scheduledStart: pickTs(raw, 'scheduledStart', 'scheduled_start'),
    scheduledDurationMin: pickNum(raw, 'scheduledDurationMin', 'scheduled_duration_min') || undefined,
  };
}

function unwrapTaskResponse(j: unknown): TaskCard {
  if (!j || typeof j !== 'object') return unwrapWorkTask({});
  const obj = j as Record<string, unknown>;
  const nested = (obj.task ?? obj) as JsonWorkTask;
  return unwrapWorkTask(nested);
}

export async function listTasks(): Promise<TaskCard[]> {
  const resp = await fetch(BASE, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`listTasks: ${resp.status}`);
  const j = (await resp.json()) as { tasks?: JsonWorkTask[] };
  return (j.tasks ?? []).map(unwrapWorkTask);
}

export async function createTask(input: { title: string; briefMd?: string }): Promise<TaskCard> {
  const resp = await fetch(BASE, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({
      kind: 'custom',
      title: input.title,
      brief_md: input.briefMd ?? '',
    }),
  });
  if (!resp.ok) throw new Error(`createTask: ${resp.status}`);
  return unwrapTaskResponse(await resp.json());
}

export async function moveTaskStatus(taskId: string, status: TaskStatus): Promise<TaskCard> {
  const resp = await fetch(`${BASE}/${encodeURIComponent(taskId)}/status`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ id: taskId, status }),
  });
  if (!resp.ok) throw new Error(`moveTaskStatus: ${resp.status}`);
  return unwrapTaskResponse(await resp.json());
}

export async function deleteTask(taskId: string): Promise<void> {
  const resp = await fetch(`${BASE}/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`deleteTask: ${resp.status}`);
}

export async function scheduleTask(
  taskId: string,
  startIso: string,
  durationMin: number,
): Promise<TaskCard> {
  const resp = await fetch(`${BASE}/${encodeURIComponent(taskId)}/schedule`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({
      id: taskId,
      scheduledStartIso: startIso,
      durationMin,
      scheduled_start_iso: startIso,
      duration_min: durationMin,
    }),
  });
  if (!resp.ok) throw new Error(`scheduleTask: ${resp.status}`);
  return unwrapTaskResponse(await resp.json());
}

export async function unscheduleTask(taskId: string): Promise<TaskCard> {
  const resp = await fetch(`${BASE}/${encodeURIComponent(taskId)}/unschedule`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ id: taskId }),
  });
  if (!resp.ok) throw new Error(`unscheduleTask: ${resp.status}`);
  return unwrapTaskResponse(await resp.json());
}
