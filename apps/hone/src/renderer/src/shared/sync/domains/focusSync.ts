import { requireUserId } from '@shared/db/honeDb';
import {
  remoteEndFocusSession,
  remoteStartFocusSession,
} from '@features/focus/repository/focusRemote';
import { focusStoreGet, focusStorePut } from '@features/focus/repository/focusStore';
import { setServerId, resolveEntityId } from '@shared/sync/idMap';
import { removeOutbox } from '@shared/sync/outbox';
import type { OutboxEntry } from '@shared/sync/types';

export async function pushFocusOutbox(entry: OutboxEntry): Promise<void> {
  const userId = requireUserId();
  const payload = entry.payload as Record<string, unknown>;

  if (entry.op === 'session_start') {
    const session = await remoteStartFocusSession({
      planItemId: String(payload.planItemId ?? ''),
      pinnedTitle: String(payload.pinnedTitle ?? ''),
      mode: (payload.mode as 'pomodoro' | 'stopwatch') ?? 'pomodoro',
    });
    await setServerId('focus', entry.entityId, session.id, userId);
    const local = await focusStoreGet(entry.entityId, userId);
    if (local) {
      await focusStorePut({ ...local, synced: false });
    }
    await removeOutbox(entry.id, userId);
    return;
  }

  if (entry.op === 'session_end') {
    const serverId = await resolveEntityId('focus', entry.entityId, userId);
    await remoteEndFocusSession({
      sessionId: serverId,
      pomodorosCompleted: Number(payload.pomodorosCompleted ?? 0),
      secondsFocused: Number(payload.secondsFocused ?? 0),
    });
    const local = await focusStoreGet(entry.entityId, userId);
    if (local) {
      await focusStorePut({ ...local, synced: true });
    }
    await removeOutbox(entry.id, userId);
  }
}

export async function pullFocus(): Promise<void> {
  /* Stats pulled on-demand via remoteGetStats in focusClient cache */
}
