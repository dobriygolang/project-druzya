import { dbGet, dbPut, requireUserId } from '@shared/db/honeDb';

import type { SyncDomain } from './types';

function mapKey(userId: string, domain: SyncDomain, localId: string): string {
  return `${userId}::map::${domain}::${localId}`;
}

export async function setServerId(
  domain: SyncDomain,
  localId: string,
  serverId: string,
  userId?: string,
): Promise<void> {
  const uid = userId ?? requireUserId();
  await dbPut('id_map', {
    key: mapKey(uid, domain, localId),
    userId: uid,
    domain,
    localId,
    serverId,
  });
}

export async function getServerId(
  domain: SyncDomain,
  localId: string,
  userId?: string,
): Promise<string | null> {
  const uid = userId ?? requireUserId();
  const row = await dbGet<{ serverId: string }>('id_map', mapKey(uid, domain, localId));
  return row?.serverId ?? null;
}

export async function resolveEntityId(
  domain: SyncDomain,
  localId: string,
  userId?: string,
): Promise<string> {
  const serverId = await getServerId(domain, localId, userId);
  return serverId ?? localId;
}
