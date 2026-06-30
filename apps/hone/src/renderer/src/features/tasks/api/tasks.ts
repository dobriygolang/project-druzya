// Local-first task board — IndexedDB source of truth; background sync when enabled.
import { tasksStoreGet, tasksStoreList, tasksStorePut, tasksStoreSoftDelete } from '@features/tasks/repository/tasksStore';
import { getServerId } from '@shared/sync/idMap';
import { enqueueOutbox } from '@shared/sync/outbox';
import { scheduleSync } from '@shared/sync/SyncEngine';
import { isSyncEnabled } from '@shared/sync/syncConfig';
import { HONE_EVENTS } from '@shared/lib/custom-events';

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'dismissed';
export type TaskKind = 'algo' | 'sysdesign' | 'quiz' | 'reflection' | 'reading' | 'ml' | 'custom';

export interface TaskCard {
  id: string;
  status: TaskStatus;
  kind: TaskKind;
  title: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  scheduledStart?: string;
  scheduledDurationMin?: number;
  googleEventId?: string;
  /** Manual order within a day column. Undefined → derived from schedule/createdAt. */
  order?: number;
}

async function resolveTask(id: string): Promise<TaskCard | null> {
  const direct = await tasksStoreGet(id);
  if (direct) return direct;
  const serverId = await getServerId('tasks', id);
  if (serverId && serverId !== id) return tasksStoreGet(serverId);
  return null;
}

export async function listTasks(): Promise<TaskCard[]> {
  return tasksStoreList();
}

export async function createTask(input: { title: string; kind?: TaskKind }): Promise<TaskCard> {
  const now = new Date().toISOString();
  const task: TaskCard = {
    id: crypto.randomUUID(),
    status: 'todo',
    kind: input.kind ?? 'custom',
    title: input.title,
    createdAt: now,
    updatedAt: now,
  };
  await tasksStorePut(task);
  if (isSyncEnabled()) {
    await enqueueOutbox('tasks', 'create', task.id, {
      title: task.title,
      kind: task.kind,
    });
    scheduleSync();
  }
  return task;
}

export async function moveTaskStatus(taskId: string, status: TaskStatus): Promise<TaskCard> {
  const prev = await resolveTask(taskId);
  if (!prev) throw new Error(`Task not found: ${taskId}`);
  const now = new Date().toISOString();
  const task: TaskCard = {
    ...prev,
    status,
    updatedAt: now,
    completedAt: status === 'done' ? now : prev.completedAt,
  };
  await tasksStorePut(task);
  if (isSyncEnabled()) {
    await enqueueOutbox('tasks', 'status', taskId, { status });
    scheduleSync();
  }
  return task;
}

/**
 * Inline title edit, persisted on device immediately. The tracker backend has
 * no rename/update-title RPC, so this stays local-first only (no outbox push);
 * wire an `update` outbox op here once a remote endpoint exists.
 */
export async function renameTask(taskId: string, title: string): Promise<TaskCard> {
  const prev = await resolveTask(taskId);
  if (!prev) throw new Error(`Task not found: ${taskId}`);
  const task: TaskCard = {
    ...prev,
    title,
    updatedAt: new Date().toISOString(),
  };
  await tasksStorePut(task);
  return task;
}

export async function scheduleTask(
  taskId: string,
  start: Date | string,
  durationMin: number,
): Promise<TaskCard> {
  const prev = await resolveTask(taskId);
  if (!prev) throw new Error(`Task not found: ${taskId}`);
  const startIso =
    typeof start === 'string'
      ? start
      : Number.isNaN(start.getTime())
        ? new Date().toISOString()
        : start.toISOString();
  const task: TaskCard = {
    ...prev,
    scheduledStart: startIso,
    scheduledDurationMin: Math.max(15, Math.min(480, durationMin)),
    updatedAt: new Date().toISOString(),
  };
  await tasksStorePut(task);
  if (isSyncEnabled()) {
    await enqueueOutbox('tasks', 'schedule', taskId, {
      startIso,
      durationMin: task.scheduledDurationMin,
    });
    scheduleSync();
  }
  return task;
}

export async function deleteTask(taskId: string): Promise<void> {
  const prev = await resolveTask(taskId);
  if (!prev) return;
  await tasksStoreSoftDelete(taskId);
  if (isSyncEnabled()) {
    await enqueueOutbox('tasks', 'delete', taskId, {});
    scheduleSync();
  }
  window.dispatchEvent(new CustomEvent(HONE_EVENTS.tasksChanged));
}

/**
 * Persist a manual reordering of tasks within a day column. Reassigns dense
 * sequential `order` values and stores them locally. Order is a local-first
 * field — it is not pushed to the backend (tracker has no order column), so
 * reordering stays intact on-device and across reloads; remote pull preserves
 * any local `order` already stored.
 */
export async function reorderTasks(updated: TaskCard[]): Promise<void> {
  for (const t of updated) await tasksStorePut(t);
  window.dispatchEvent(new CustomEvent(HONE_EVENTS.tasksChanged));
}
