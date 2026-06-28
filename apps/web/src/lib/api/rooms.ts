import { API_BASE, api, parseAuthTokens } from '@/lib/apiClient'
import { asArray } from '@/lib/api/normalize'
import { normalizeProtoJson } from '@/lib/protoJson'

export type RoomParticipant = {
  user_id: string
  role: string
  joined_at?: string
}

export type CodeRoom = {
  id: string
  owner_id: string
  room_type: string
  task_id?: string
  language: string
  is_frozen: boolean
  visibility: string
  ws_url: string
  expires_at?: string
  participants: RoomParticipant[]
}

export type InviteLink = {
  url: string
  token: string
  expires_at?: string
}

export type CreateRoomPayload = {
  room_type?: string
  task_id?: string
  language?: string
  session_id?: string
}

export type GuestJoinResult = {
  access_token: string
  expires_in: number
  room: CodeRoom
}

function normalizeRoom(raw: CodeRoom): CodeRoom {
  return {
    ...raw,
    participants: asArray(raw.participants),
  }
}

const guestTokenKey = (roomId: string) => `druzya_guest_token_${roomId}`

export function readGuestToken(roomId: string): string | null {
  try {
    return sessionStorage.getItem(guestTokenKey(roomId))
  } catch {
    return null
  }
}

export function persistGuestToken(roomId: string, token: string): void {
  try {
    sessionStorage.setItem(guestTokenKey(roomId), token)
  } catch {
    /* noop */
  }
}

export function clearGuestToken(roomId: string): void {
  try {
    sessionStorage.removeItem(guestTokenKey(roomId))
  } catch {
    /* noop */
  }
}

export async function createRoom(payload: CreateRoomPayload): Promise<CodeRoom> {
  const res = await api<{ room: CodeRoom }>('/rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return normalizeRoom(res.room)
}

export async function getRoom(roomId: string): Promise<CodeRoom> {
  const res = await api<{ room: CodeRoom }>(`/rooms/${encodeURIComponent(roomId)}`)
  return normalizeRoom(res.room)
}

export async function joinRoom(
  roomId: string,
  opts?: { role?: string; inviteToken?: string },
): Promise<CodeRoom> {
  const res = await api<{ room: CodeRoom }>(`/rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    body: JSON.stringify({
      role: opts?.role ?? '',
      invite_token: opts?.inviteToken ?? '',
    }),
  })
  return normalizeRoom(res.room)
}

export async function guestJoin(
  roomId: string,
  inviteToken: string,
  displayName: string,
): Promise<GuestJoinResult> {
  const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}/guest-join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite_token: inviteToken, display_name: displayName }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `guest join ${res.status}`)
  }
  const body = normalizeProtoJson(await res.json()) as Record<string, unknown>
  const tokens = parseAuthTokens(body)
  const room = normalizeRoom(body.room as CodeRoom)
  return {
    access_token: tokens.access_token,
    expires_in: Number(body.expires_in ?? body.expiresIn ?? 0),
    room,
  }
}

export async function freezeRoom(roomId: string, frozen: boolean): Promise<CodeRoom> {
  const res = await api<{ room: CodeRoom }>(`/rooms/${encodeURIComponent(roomId)}/freeze`, {
    method: 'POST',
    body: JSON.stringify({ frozen }),
  })
  return normalizeRoom(res.room)
}

export async function createInvite(roomId: string): Promise<InviteLink> {
  const res = await api<{ invite: InviteLink }>(`/rooms/${encodeURIComponent(roomId)}/invite`, {
    method: 'POST',
    body: '{}',
  })
  return res.invite
}

export async function getReplay(roomId: string): Promise<{ payload_jsonl: string; op_count: number }> {
  const res = await api<{ payload_jsonl: string; op_count: number }>(
    `/rooms/${encodeURIComponent(roomId)}/replay`,
  )
  return {
    payload_jsonl: res.payload_jsonl ?? '',
    op_count: res.op_count ?? 0,
  }
}
