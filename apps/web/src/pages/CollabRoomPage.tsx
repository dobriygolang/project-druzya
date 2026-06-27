import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { CollabCodeEditor } from '@/components/CollabCodeEditor'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorMessage } from '@/components/ErrorMessage'
import { getMe } from '@/lib/api/auth'
import {
  createInvite,
  createRoom,
  freezeRoom,
  getRoom,
  guestJoin,
  joinRoom,
  persistGuestToken,
  readGuestToken,
} from '@/lib/api/rooms'
import { readAccessToken } from '@/lib/apiClient'

export default function CollabRoomPage() {
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite') ?? undefined
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestToken, setGuestToken] = useState(() => readGuestToken(roomId))
  const [guestRoom, setGuestRoom] = useState<import('@/lib/api/rooms').CodeRoom | null>(null)
  const isNew = roomId === 'new'
  const authed = !!readAccessToken()

  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: authed })

  const roomQ = useQuery({
    queryKey: ['room', roomId, inviteToken],
    queryFn: async () => {
      try {
        return await getRoom(roomId)
      } catch {
        return joinRoom(roomId, { inviteToken })
      }
    },
    enabled: !!roomId && !isNew && authed,
    retry: false,
  })

  const guestJoinM = useMutation({
    mutationFn: () => guestJoin(roomId, inviteToken ?? '', guestName.trim() || 'guest'),
    onSuccess: (result) => {
      persistGuestToken(roomId, result.access_token)
      setGuestToken(result.access_token)
      setGuestRoom(result.room)
    },
  })

  const createM = useMutation({
    mutationFn: (payload?: { task_id?: string; language?: string }) =>
      createRoom({
        room_type: 'interview',
        language: payload?.language ?? 'go',
        task_id: payload?.task_id,
      }),
    onSuccess: (room) => {
      navigate(`/live/${room.id}`, { replace: true })
    },
  })

  const freezeM = useMutation({
    mutationFn: (frozen: boolean) => freezeRoom(roomId, frozen),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['room', roomId] })
    },
  })

  const inviteM = useMutation({
    mutationFn: () => createInvite(roomId),
    onSuccess: async (invite) => {
      await navigator.clipboard.writeText(invite.url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    },
  })

  if (isNew) {
    if (!authed) {
      return (
        <Card className="space-y-3">
          <p className="text-sm">Войдите, чтобы создать live-комнату.</p>
          <Link to="/login" className="text-sm text-blue-600 underline">
            Войти
          </Link>
        </Card>
      )
    }
    return (
      <Card className="space-y-4">
        <h1 className="text-xl font-semibold">Новая live-комната</h1>
        <p className="text-sm text-text-muted">
          Общий редактор с синхронизацией через Yjs. Лимит — billing + до 3 активных комнат.
        </p>
        {createM.error ? (
          <ErrorMessage
            message={createM.error instanceof Error ? createM.error.message : 'Ошибка создания'}
          />
        ) : null}
        <Button onClick={() => createM.mutate(undefined)} loading={createM.isPending}>
          Создать комнату
        </Button>
      </Card>
    )
  }

  if (!authed && inviteToken && !guestToken) {
    return (
      <Card className="max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Вход как гость</h1>
        <p className="text-sm text-text-muted">
          Введите имя для отображения в редакторе. Доступ только на время сессии.
        </p>
        <div>
          <label htmlFor="guest-name" className="block text-sm font-medium">
            Имя
          </label>
          <input
            id="guest-name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            placeholder="Кандидат"
          />
        </div>
        {guestJoinM.error ? (
          <ErrorMessage
            message={
              guestJoinM.error instanceof Error ? guestJoinM.error.message : 'Ошибка входа'
            }
          />
        ) : null}
        <Button loading={guestJoinM.isPending} onClick={() => guestJoinM.mutate()}>
          Войти в комнату
        </Button>
        <p className="text-xs text-text-muted">
          Уже есть аккаунт?{' '}
          <Link to={`/login?next=/live/${roomId}?invite=${encodeURIComponent(inviteToken)}`} className="underline">
            Войти
          </Link>
        </p>
      </Card>
    )
  }

  if (!authed && !guestToken) {
    return (
      <Card className="space-y-3">
        <ErrorMessage message="Нужна ссылка-приглашение или вход в аккаунт." />
        <Link to="/login" className="text-sm text-blue-600 underline">
          Войти
        </Link>
      </Card>
    )
  }

  if (roomQ.isLoading || (authed && meQ.isLoading)) {
    return <p className="text-sm text-text-muted">Загрузка комнаты…</p>
  }

  const room =
    guestRoom ??
    roomQ.data ??
    (guestToken
      ? {
          id: roomId,
          owner_id: '',
          room_type: 'interview',
          language: 'go',
          is_frozen: false,
          visibility: 'shared',
          ws_url: `/ws/editor/${roomId}`,
          participants: [],
        }
      : null)
  if (!room) {
    return (
      <Card className="space-y-3">
        <ErrorMessage
          message={roomQ.error instanceof Error ? roomQ.error.message : 'Комната не найдена'}
        />
        {authed ? (
          <Link to="/live/new" className="text-sm text-blue-600 underline">
            Создать новую
          </Link>
        ) : null}
      </Card>
    )
  }

  const myId = meQ.data?.id
  const myRole = room.participants.find((p) => p.user_id === myId)?.role
  const canFreeze = myRole === 'owner' || myRole === 'interviewer'
  const isOwner = myId === room.owner_id
  const wsToken = guestToken ?? readAccessToken() ?? ''

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Live coding</p>
          <h1 className="text-xl font-semibold">Комната {room.id.slice(0, 8)}…</h1>
          <p className="text-sm text-text-muted">
            {room.language} · {room.participants.length} участник(ов)
            {room.is_frozen ? ' · заморожена' : ''}
            {guestToken ? ' · гость' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOwner ? (
            <Button variant="secondary" loading={inviteM.isPending} onClick={() => inviteM.mutate()}>
              {copied ? 'Ссылка скопирована' : 'Пригласить'}
            </Button>
          ) : null}
          {canFreeze ? (
            <Button
              variant="secondary"
              loading={freezeM.isPending}
              onClick={() => freezeM.mutate(!room.is_frozen)}
            >
              {room.is_frozen ? 'Разморозить' : 'Заморозить'}
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CollabCodeEditor
          roomId={room.id}
          language={room.language}
          frozen={room.is_frozen}
          userId={myId ?? guestName}
          accessToken={wsToken}
        />
      </Card>

      {authed ? (
        <Card>
          <h2 className="mb-2 font-medium">Участники</h2>
          <ul className="space-y-1 text-sm">
            {room.participants.map((p) => (
              <li key={p.user_id}>
                {p.user_id.slice(0, 8)}… — {p.role}
                {p.user_id === myId ? ' (вы)' : ''}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
