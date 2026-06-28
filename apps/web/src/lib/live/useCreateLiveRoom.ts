import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getMe } from '@/lib/api/auth'
import { createGuestRoom, createRoom, persistGuestToken } from '@/lib/api/rooms'
import { readAccessToken } from '@/lib/apiClient'
import { persistGuestDisplayName, readGuestDisplayName } from '@/lib/live/guestDisplayName'

export function useCreateLiveRoom() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const authed = !!readAccessToken()
  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: authed })

  return useMutation({
    mutationFn: async (input: { language: string; displayName?: string }) => {
      if (authed) {
        const room = await createRoom({
          room_type: 'interview',
          language: input.language,
        })
        return { room, access_token: null as string | null }
      }

      const name =
        input.displayName?.trim() ||
        readGuestDisplayName() ||
        meQ.data?.username ||
        'Guest'
      persistGuestDisplayName(name)
      const result = await createGuestRoom({ displayName: name, language: input.language })
      return { room: result.room, access_token: result.access_token }
    },
    onSuccess: ({ room, access_token }) => {
      if (access_token) persistGuestToken(room.id, access_token)
      if (authed) void qc.invalidateQueries({ queryKey: ['my-active-rooms'] })
      navigate(`/live/${room.id}`)
    },
  })
}
