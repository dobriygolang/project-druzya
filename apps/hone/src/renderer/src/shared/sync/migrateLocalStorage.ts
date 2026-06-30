import { readJson } from '@shared/lib/localDb';

import { notesStoreBulkImport } from '@features/notes/repository/notesStore';
import { tasksStoreBulkImport } from '@features/tasks/repository/tasksStore';
import { focusStoreBulkImport } from '@features/focus/repository/focusStore';
import { dbGet, dbPut, requireUserId } from '@shared/db/honeDb';

const LEGACY_KEYS = {
  notes: 'hone:notes:v1',
  tasks: 'hone:tasks:v1',
  focus: 'hone:focus-sessions:v1',
} as const;

function migratedKey(userId: string): string {
  return `${userId}::migrated_from_localStorage`;
}

export async function migrateLocalStorageIfNeeded(userId: string): Promise<void> {
  const done = await dbGet<{ value: boolean }>('meta', migratedKey(userId));
  if (done?.value) return;

  const notes = readJson<Record<string, unknown>>(LEGACY_KEYS.notes, {});
  if (Object.keys(notes).length > 0) {
    await notesStoreBulkImport(userId, notes as Record<string, {
      id: string;
      title: string;
      bodyMd: string;
      createdAt: string;
      updatedAt: string;
    }>);
  }

  const tasks = readJson<Record<string, unknown>>(LEGACY_KEYS.tasks, {});
  if (Object.keys(tasks).length > 0) {
    await tasksStoreBulkImport(userId, tasks as Record<string, import('@features/tasks/api/tasks').TaskCard>);
  }

  const focus = readJson<Record<string, unknown>>(LEGACY_KEYS.focus, {});
  if (Object.keys(focus).length > 0) {
    await focusStoreBulkImport(userId, focus as Record<string, {
      id: string;
      planItemId: string;
      pinnedTitle: string;
      startedAt: string;
      endedAt: string | null;
      pomodorosCompleted: number;
      secondsFocused: number;
      mode: string;
    }>);
  }

  await dbPut('meta', { key: migratedKey(userId), userId, value: true, updatedAt: Date.now() });
}

export async function runMigrationForCurrentUser(): Promise<void> {
  const userId = requireUserId();
  await migrateLocalStorageIfNeeded(userId);
}
