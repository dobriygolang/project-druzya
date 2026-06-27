import { api } from '@/lib/apiClient'

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
  return res.room
}

export async function getRoom(roomId: string): Promise<CodeRoom> {
  const res = await api<{ room: CodeRoom }>(`/rooms/${encodeURIComponent(roomId)}`)
  return res.room
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
  return res.room
}

export async function guestJoin(
  roomId: string,
  inviteToken: string,
  displayName: string,
): Promise<GuestJoinResult> {
  const res = await fetch(`/v1/rooms/${encodeURIComponent(roomId)}/guest-join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invite_token: inviteToken, display_name: displayName }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `guest join ${res.status}`)
  }
  return res.json() as Promise<GuestJoinResult>
}

export async function freezeRoom(roomId: string, frozen: boolean): Promise<CodeRoom> {
  const res = await api<{ room: CodeRoom }>(`/rooms/${encodeURIComponent(roomId)}/freeze`, {
    method: 'POST',
    body: JSON.stringify({ frozen }),
  })
  return res.room
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
  return res
}
