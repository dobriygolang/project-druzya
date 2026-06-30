import { dbDelete, dbGetAllByUser, dbPut, requireUserId } from '@shared/db/honeDb';

import type { OutboxEntry, OutboxOp, SyncDomain } from './types';

type OutboxRow = OutboxEntry & { key: string };

function rowKey(userId: string, id: string): string {
  return `${userId}::outbox::${id}`;
}

export async function enqueueOutbox(
  domain: SyncDomain,
  op: OutboxOp,
  entityId: string,
  payload: unknown,
  serverId?: string,
): Promise<void> {
  const userId = requireUserId();
  const id = crypto.randomUUID();
  const entry: OutboxRow = {
    key: rowKey(userId, id),
    id,
    userId,
    domain,
    op,
    entityId,
    serverId,
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  await dbPut('outbox', entry);
}

export async function listOutbox(userId?: string): Promise<OutboxEntry[]> {
  const uid = userId ?? requireUserId();
  const rows = await dbGetAllByUser<OutboxRow>('outbox', uid);
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeOutbox(id: string, userId?: string): Promise<void> {
  const uid = userId ?? requireUserId();
  await dbDelete('outbox', rowKey(uid, id));
}

export async function bumpOutboxAttempts(entry: OutboxEntry): Promise<void> {
  const row: OutboxRow = {
    ...entry,
    key: rowKey(entry.userId, entry.id),
    attempts: entry.attempts + 1,
  };
  await dbPut('outbox', row);
}

export async function outboxCount(userId?: string): Promise<number> {
  const rows = await listOutbox(userId);
  return rows.length;
}

export async function clearOutbox(userId: string): Promise<void> {
  const rows = await dbGetAllByUser<OutboxRow>('outbox', userId);
  for (const row of rows) await dbDelete('outbox', row.key);
}
