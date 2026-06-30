import { dbGet, dbPut, requireUserId } from '@shared/db/honeDb';

import type { SyncDomain } from './types';

function cursorKey(userId: string, domain: SyncDomain): string {
  return `${userId}::cursor::${domain}`;
}

export async function getCursor(domain: SyncDomain, userId?: string): Promise<string> {
  const uid = userId ?? requireUserId();
  const row = await dbGet<{ value: string }>('meta', cursorKey(uid, domain));
  return row?.value ?? '';
}

export async function setCursor(domain: SyncDomain, value: string, userId?: string): Promise<void> {
  const uid = userId ?? requireUserId();
  await dbPut('meta', {
    key: cursorKey(uid, domain),
    userId: uid,
    domain,
    value,
    updatedAt: Date.now(),
  });
}
