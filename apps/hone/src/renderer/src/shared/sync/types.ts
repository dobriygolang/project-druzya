export type SyncDomain = 'notes' | 'tasks' | 'focus';

export type OutboxOp =
  | 'create'
  | 'update'
  | 'delete'
  | 'schedule'
  | 'unschedule'
  | 'status'
  | 'session_start'
  | 'session_end';

export interface OutboxEntry {
  id: string;
  userId: string;
  domain: SyncDomain;
  op: OutboxOp;
  entityId: string;
  serverId?: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
}

export interface IdMapEntry {
  key: string;
  userId: string;
  domain: SyncDomain;
  localId: string;
  serverId: string;
}

export interface SyncCursor {
  key: string;
  userId: string;
  domain: SyncDomain;
  value: string;
  updatedAt: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';
