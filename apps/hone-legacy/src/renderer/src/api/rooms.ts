// api/rooms.ts — standalone collab rooms client.
import { createPromiseClient } from '@connectrpc/connect';
import { RoomService } from '@generated/pb/druz9/v1/rooms_connect';

import { transport } from './transport';

const client = createPromiseClient(RoomService, transport);

// ─── Types ────────────────────────────────────────────────────────────────

export type RoomKind = 'code' | 'whiteboard';
export type RoomStatus = 'active' | 'past' | 'all';

export interface Room {
  id: string;
  ownerId: string;
  kind: RoomKind;
  title: string;
  visibility: string;
  freeTier: boolean;
  expiresAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date | null;
  shareUrl: string;
}

export interface RoomQuota {
  activeCount: number;
  maxActive: number;
  tier: string;
}

// ─── Internals ────────────────────────────────────────────────────────────

function tsToDate(ts: { seconds: bigint } | undefined): Date | null {
  if (!ts) return null;
  const s = Number(ts.seconds);
  return s > 0 ? new Date(s * 1000) : null;
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function createStandaloneRoom(kind: RoomKind, title: string): Promise<Room> {
  const resp = await client.createStandaloneRoom({ kind, title });
  const r = resp.room!;
  return {
    id: r.id,
    ownerId: r.ownerId,
    kind: r.kind as RoomKind,
    title: r.title,
    visibility: r.visibility,
    freeTier: r.freeTier,
    expiresAt: tsToDate(r.expiresAt),
    archivedAt: tsToDate(r.archivedAt),
    createdAt: tsToDate(r.createdAt),
    shareUrl: r.shareUrl,
  };
}

export async function listMyRooms(status: RoomStatus): Promise<{ rooms: Room[]; quota: RoomQuota }> {
  const resp = await client.listMyRooms({ status });
  return {
    rooms: resp.rooms.map((r) => ({
      id: r.id,
      ownerId: r.ownerId,
      kind: r.kind as RoomKind,
      title: r.title,
      visibility: r.visibility,
      freeTier: r.freeTier,
      expiresAt: tsToDate(r.expiresAt),
      archivedAt: tsToDate(r.archivedAt),
      createdAt: tsToDate(r.createdAt),
      shareUrl: '',
    })),
    quota: {
      activeCount: resp.quota?.activeCount ?? 0,
      maxActive: resp.quota?.maxActive ?? 3,
      tier: resp.quota?.tier ?? 'free',
    },
  };
}

export async function deleteRoom(kind: RoomKind, id: string): Promise<void> {
  await client.deleteRoom({ kind, id });
}

export async function restoreRoom(kind: RoomKind, id: string): Promise<void> {
  await client.restoreRoom({ kind, id });
}

export async function extendRoom(kind: RoomKind, id: string, hours: number): Promise<void> {
  await client.extendRoom({ kind, id, hours });
}
