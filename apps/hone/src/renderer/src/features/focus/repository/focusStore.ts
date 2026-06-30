import { dbGet, dbGetAllByUser, dbPut, entityKey, requireUserId } from '@shared/db/honeDb';

export interface StoredFocusSession {
  userId: string;
  id: string;
  key: string;
  planItemId: string;
  pinnedTitle: string;
  startedAt: string;
  endedAt: string | null;
  pomodorosCompleted: number;
  secondsFocused: number;
  mode: string;
  synced?: boolean;
}

function rowFrom(
  userId: string,
  partial: Omit<StoredFocusSession, 'key' | 'userId'>,
): StoredFocusSession {
  return { ...partial, userId, key: entityKey(partial.id, userId) };
}

export async function focusStorePut(session: StoredFocusSession): Promise<void> {
  await dbPut('focus_sessions', session);
}

export async function focusStoreGet(id: string, userId?: string): Promise<StoredFocusSession | null> {
  const uid = userId ?? requireUserId();
  return dbGet<StoredFocusSession>('focus_sessions', entityKey(id, uid));
}

export async function focusStoreList(userId?: string): Promise<StoredFocusSession[]> {
  const uid = userId ?? requireUserId();
  return dbGetAllByUser<StoredFocusSession>('focus_sessions', uid);
}

export async function focusStoreBulkImport(
  userId: string,
  records: Record<string, Omit<StoredFocusSession, 'key' | 'userId'>>,
): Promise<void> {
  for (const s of Object.values(records)) {
    await dbPut('focus_sessions', rowFrom(userId, s));
  }
}

export async function focusStoreUnsynced(userId?: string): Promise<StoredFocusSession[]> {
  const rows = await focusStoreList(userId);
  return rows.filter((s) => s.endedAt && !s.synced);
}

export { rowFrom };
