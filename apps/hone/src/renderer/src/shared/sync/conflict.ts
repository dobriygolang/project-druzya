/** Last-write-wins by ISO timestamp string or Date. */
export function isRemoteNewer(
  localUpdatedAt: string | Date | null | undefined,
  remoteUpdatedAt: string | Date | null | undefined,
): boolean {
  const lt = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0;
  const rt = remoteUpdatedAt ? new Date(remoteUpdatedAt).getTime() : 0;
  if (!Number.isFinite(lt)) return true;
  if (!Number.isFinite(rt)) return false;
  return rt > lt;
}

export function maxIso(a: string, b: string): string {
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}
