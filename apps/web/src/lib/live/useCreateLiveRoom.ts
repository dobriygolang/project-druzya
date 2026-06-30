import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createGuestRoom, persistGuestToken } from '@/lib/api/rooms'
import { persistGuestDisplayName, readGuestDisplayName } from '@/lib/live/guestDisplayName'

export function useCreateLiveRoom() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async (input: {
      language: string
      displayName?: string
      roomType?: string
    }) => {
      const name = input.displayName?.trim() || readGuestDisplayName() || 'Guest'
      persistGuestDisplayName(name)
      const result = await createGuestRoom({
        displayName: name,
        language: input.language,
        roomType: input.roomType ?? 'practice',
      })
      return {
        room: result.room,
        access_token: result.access_token,
        inviteUrl: result.invite.url || null,
      }
    },
    onSuccess: async ({ room, access_token, inviteUrl }) => {
      persistGuestToken(room.id, access_token)
      if (inviteUrl) {
        try {
          await navigator.clipboard.writeText(inviteUrl)
        } catch {
          /* clipboard blocked */
        }
      }
      navigate(`/live/${room.id}`)
    },
  })
}
