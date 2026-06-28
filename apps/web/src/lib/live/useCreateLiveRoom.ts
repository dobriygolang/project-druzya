import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getMe } from '@/lib/api/auth'
import { createGuestRoom, createInvite, createRoom, persistGuestToken } from '@/lib/api/rooms'
import { readAccessToken } from '@/lib/apiClient'
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

export function useCreateLiveRoom() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const authed = !!readAccessToken()
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: authed })

  return useMutation({
    mutationFn: async (input: {
      language: string
      displayName?: string
      roomType?: string
    }) => {
      const roomType = input.roomType ?? 'interview'
      if (authed) {
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
      }

      const name =
        input.displayName?.trim() ||
        readGuestDisplayName() ||
        meQ.data?.username ||
        'Guest'
      persistGuestDisplayName(name)
      const result = await createGuestRoom({
        displayName: name,
        language: input.language,
        roomType,
      })
      return {
        room: result.room,
        access_token: result.access_token,
        inviteUrl: result.invite.url || null,
      }
    },
    onSuccess: async ({ room, access_token, inviteUrl }) => {
      if (access_token) persistGuestToken(room.id, access_token)
      if (authed) void qc.invalidateQueries({ queryKey: ['my-active-rooms'] })
      if (inviteUrl) {
        try {
          await navigator.clipboard.writeText(inviteUrl)
          markInviteCopied(room.id)
        } catch {
          /* clipboard blocked — owner uses Invite in room */
        }
      }
      navigate(`/live/${room.id}`)
    },
  })
}
