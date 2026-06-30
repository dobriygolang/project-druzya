import { dbGet, dbPut, requireUserId } from '@shared/db/honeDb';

function metaKey(userId: string): string {
  return `${userId}::vault_enabled`;
}

let cachedUserId: string | null = null;
let cachedEnabled = false;

/** Fast path for sync/store — call loadVaultPrefs on sign-in first. */
export function isVaultEnabledSync(): boolean {
  return cachedEnabled;
}

export async function loadVaultPrefs(userId: string): Promise<boolean> {
  const row = await dbGet<{ enabled?: boolean }>('meta', metaKey(userId));
  cachedUserId = userId;
  cachedEnabled = row?.enabled === true;
  return cachedEnabled;
}

export async function isVaultEnabled(userId?: string): Promise<boolean> {
  const uid = userId ?? requireUserId();
  if (cachedUserId === uid) return cachedEnabled;
  return loadVaultPrefs(uid);
}

export async function setVaultEnabled(enabled: boolean, userId?: string): Promise<void> {
  const uid = userId ?? requireUserId();
  await dbPut('meta', { key: metaKey(uid), userId: uid, enabled });
  cachedUserId = uid;
  cachedEnabled = enabled;
}

export function clearVaultPrefsCache(): void {
  cachedUserId = null;
  cachedEnabled = false;
}
