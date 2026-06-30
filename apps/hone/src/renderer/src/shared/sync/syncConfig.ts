import { LOCAL_ONLY } from '@app/config/features';
import { useSessionStore } from '@shared/model/session';

export function isSyncEnabled(): boolean {
  if (LOCAL_ONLY) return false;
  return useSessionStore.getState().status === 'signed_in';
}

export function canReachNetwork(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}
