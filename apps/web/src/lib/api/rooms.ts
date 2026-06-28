import { API_BASE, api, apiWithBearer, parseAuthTokens, readAccessToken } from '@/lib/apiClient'
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
  created_at?: string
  is_guest_created?: boolean
  participants: RoomParticipant[]
}

export type ActiveRoomSummary = {
  id: string
  room_type: string
  language: string
  created_at?: string
  expires_at?: string
  is_guest_created?: boolean
  ws_url: string
}

export type MyActiveRooms = {
  rooms: ActiveRoomSummary[]
  active_count: number
  concurrent_limit?: number
  concurrent_unlimited?: boolean
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

export type GuestCreateResult = GuestJoinResult & {
  invite: InviteLink
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

function bearerForRoom(roomId: string): string | null {
  return readAccessToken() ?? readGuestToken(roomId)
}

export async function createRoom(payload: CreateRoomPayload): Promise<CodeRoom> {
  const res = await api<{ room: CodeRoom }>('/rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return normalizeRoom(res.room)
}

export async function listMyActiveRooms(): Promise<MyActiveRooms> {
  const res = await api<MyActiveRooms>('/rooms/mine/active')
  return {
    ...res,
    rooms: asArray(res.rooms),
  }
}

export async function createGuestRoom(input: {
  displayName: string
  language?: string
  roomType?: string
}): Promise<GuestCreateResult> {
  const res = await fetch(`${API_BASE}/rooms/guest-create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      display_name: input.displayName.trim() || 'guest',
      language: input.language ?? 'go',
      room_type: input.roomType ?? 'interview',
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `guest create ${res.status}`)
  }
  const body = normalizeProtoJson(await res.json()) as Record<string, unknown>
  const tokens = parseAuthTokens(body)
  const room = normalizeRoom(body.room as CodeRoom)
  const inviteRaw = body.invite as InviteLink | undefined
  const invite: InviteLink = inviteRaw
    ? {
        url: inviteRaw.url ?? '',
        token: inviteRaw.token ?? '',
        expires_at: inviteRaw.expires_at,
      }
    : { url: '', token: '' }
  return {
    access_token: tokens.access_token,
    expires_in: Number(body.expires_in ?? body.expiresIn ?? 0),
    room,
    invite,
  }
}

export async function getRoom(roomId: string): Promise<CodeRoom> {
  const token = bearerForRoom(roomId)
  if (!token) throw new Error('not authenticated')
  const res = await apiWithBearer<{ room: CodeRoom }>(
    `/rooms/${encodeURIComponent(roomId)}`,
    { method: 'GET' },
    token,
  )
  return normalizeRoom(res.room)
}

export async function joinRoom(
  roomId: string,
  opts?: { role?: string; inviteToken?: string },
): Promise<CodeRoom> {
  const token = bearerForRoom(roomId) ?? readAccessToken()
  if (!token) throw new Error('not authenticated')
  const res = await apiWithBearer<{ room: CodeRoom }>(
    `/rooms/${encodeURIComponent(roomId)}/join`,
    {
      method: 'POST',
      body: JSON.stringify({
        role: opts?.role ?? '',
        invite_token: opts?.inviteToken ?? '',
      }),
    },
    token,
  )
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
  const token = bearerForRoom(roomId)
  if (!token) throw new Error('not authenticated')
  const res = await apiWithBearer<{ room: CodeRoom }>(
    `/rooms/${encodeURIComponent(roomId)}/freeze`,
    { method: 'POST', body: JSON.stringify({ frozen }) },
    token,
  )
  return normalizeRoom(res.room)
}

export async function createInvite(roomId: string): Promise<InviteLink> {
  const token = bearerForRoom(roomId)
  if (!token) throw new Error('not authenticated')
  const res = await apiWithBearer<{ invite: InviteLink }>(
    `/rooms/${encodeURIComponent(roomId)}/invite`,
    { method: 'POST', body: '{}' },
    token,
  )
  return res.invite
}

export async function getReplay(roomId: string): Promise<{ payload_jsonl: string; op_count: number }> {
  const token = bearerForRoom(roomId)
  if (!token) throw new Error('not authenticated')
  return apiWithBearer(`/rooms/${encodeURIComponent(roomId)}/replay`, { method: 'GET' }, token)
}
