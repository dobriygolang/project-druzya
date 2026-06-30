import { create } from 'zustand';

import type { SyncStatus } from '@shared/sync/types';

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: number | null;
  lastError: string | null;
  serverReachable: boolean;
  setStatus: (status: SyncStatus) => void;
  setPendingCount: (n: number) => void;
  setLastSyncedAt: (ts: number) => void;
  setLastError: (msg: string | null) => void;
  setServerReachable: (ok: boolean) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'idle',
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,
  serverReachable: true,
  setStatus: (status) => set({ status }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt, lastError: null }),
  setLastError: (lastError) => set({ lastError, status: lastError ? 'error' : 'idle' }),
  setServerReachable: (serverReachable) => set({ serverReachable }),
}));
