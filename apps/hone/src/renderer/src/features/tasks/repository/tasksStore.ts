import {
  dbDelete,
  dbGet,
  dbGetAllByUser,
  dbPut,
  entityKey,
  requireUserId,
} from '@shared/db/honeDb';

import type { TaskCard } from '../api/tasks';

export interface StoredTask extends TaskCard {
  userId: string;
  key: string;
  deleted?: boolean;
}

function rowFrom(userId: string, task: TaskCard, deleted = false): StoredTask {
  return { ...task, userId, key: entityKey(task.id, userId), deleted };
}

export async function tasksStoreList(userId?: string): Promise<TaskCard[]> {
  const uid = userId ?? requireUserId();
  const rows = await dbGetAllByUser<StoredTask>('tasks', uid);
  return rows
    .filter((r) => !r.deleted)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function tasksStoreGet(id: string, userId?: string): Promise<TaskCard | null> {
  const uid = userId ?? requireUserId();
  const row = await dbGet<StoredTask>('tasks', entityKey(id, uid));
  if (!row || row.deleted) return null;
  const { userId: _u, key: _k, deleted: _d, ...task } = row;
  return task;
}

export async function tasksStorePut(task: TaskCard): Promise<void> {
  const userId = requireUserId();
  await dbPut('tasks', rowFrom(userId, task));
}

export async function tasksStoreMergeRemote(task: TaskCard): Promise<void> {
  const userId = requireUserId();
  const local = await dbGet<StoredTask>('tasks', entityKey(task.id, userId));
  if (!local) {
    await dbPut('tasks', rowFrom(userId, task));
    return;
  }
  const lt = new Date(local.updatedAt).getTime();
  const rt = new Date(task.updatedAt).getTime();
  if (rt >= lt) {
    // Preserve local manual order — the backend has no order column, so a
    // remote pull would otherwise wipe the user's drag-reordering.
    await dbPut('tasks', rowFrom(userId, { ...task, order: local.order }));
  }
}

export async function tasksStoreBulkImport(
  userId: string,
  records: Record<string, TaskCard>,
): Promise<void> {
  for (const task of Object.values(records)) {
    await dbPut('tasks', rowFrom(userId, task));
  }
}

export async function tasksStoreSoftDelete(id: string): Promise<void> {
  const userId = requireUserId();
  const existing = await dbGet<StoredTask>('tasks', entityKey(id, userId));
  if (!existing) return;
  await dbPut('tasks', {
    ...existing,
    deleted: true,
    updatedAt: new Date().toISOString(),
  });
}

export async function tasksStoreReplaceId(oldId: string, task: TaskCard): Promise<void> {
  const userId = requireUserId();
  await dbDelete('tasks', entityKey(oldId, userId));
  await dbPut('tasks', rowFrom(userId, task));
}
