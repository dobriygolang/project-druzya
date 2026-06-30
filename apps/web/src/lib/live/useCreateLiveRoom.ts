import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createGuestRoom, createInvite, createRoom, persistGuestToken } from '@/lib/api/rooms'
import { ApiError, hasValidAccessToken } from '@/lib/apiClient'
import { persistGuestDisplayName, readGuestDisplayName } from '@/lib/live/guestDisplayName'

const inviteCopiedKey = (roomId: string) => `druzya_invite_copied_${roomId}`

export function markInviteCopied(roomId: string) {
  try {
    sessionStorage.setItem(inviteCopiedKey(roomId), '1')
  } catch {
    /* noop */
  }
}

export function readInviteCopied(roomId: string): boolean {
  try {
    return sessionStorage.getItem(inviteCopiedKey(roomId)) === '1'
  } catch {
    return false
  }
}

async function createAsGuest(input: {
  language: string
  displayName?: string
  roomType?: string
}) {
  const name = input.displayName?.trim() || readGuestDisplayName() || 'Guest'
  persistGuestDisplayName(name)
  const result = await createGuestRoom({
    displayName: name,
    language: input.language,
    roomType: input.roomType,
  })
  return {
    room: result.room,
    access_token: result.access_token,
    inviteUrl: result.invite.url || null,
  }
}

export function useCreateLiveRoom() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const authed = hasValidAccessToken()

  return useMutation({
    mutationFn: async (input: {
      language: string
      displayName?: string
      roomType?: string
    }) => {
      const roomType = input.roomType ?? 'practice'

      if (authed) {
        try {
          const room = await createRoom({
            room_type: roomType,
            language: input.language,
          })
          let inviteUrl: string | null = null
          try {
            const invite = await createInvite(room.id)
            inviteUrl = invite.url
          } catch {
            /* owner can copy from room settings */
          }
          return { room, access_token: null as string | null, inviteUrl }
        } catch (err) {
          if (!(err instanceof ApiError) || (err.status !== 401 && err.status !== 403)) throw err
        }
      }

      return createAsGuest(input)
    },
    onSuccess: async ({ room, access_token, inviteUrl }) => {
      if (access_token) persistGuestToken(room.id, access_token)
      if (authed) void qc.invalidateQueries({ queryKey: ['my-active-rooms'] })
      if (inviteUrl) {
        try {
          await navigator.clipboard.writeText(inviteUrl)
          markInviteCopied(room.id)
        } catch {
          /* clipboard blocked */
        }
      }
      navigate(`/live/${room.id}`)
    },
  })
}
