import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import {
  CollabCodeEditor,
  wsStatusColor,
  wsStatusLabel,
  type CollabCodeEditorHandle,
} from '@/components/CollabCodeEditor'
import { LiveCodeRunButton, LiveCodeStatusChip, LiveCodeToolButton } from '@/components/live/LiveCodeChrome'
import { RunOutputPanel, runPanelHeight } from '@/components/live/RunOutputPanel'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { useSandboxRun } from '@/hooks/useSandboxRun'
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
import type { EditorWsStatus } from '@/lib/ws/collabEditor'

/** Immersive live room — layout 1:1 with druzya/frontend EditorPage (full-viewport + RUN + output panel). */
export default function CollabRoomPage() {
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite') ?? undefined
  const sessionTaskId = searchParams.get('sessionTaskId') ?? undefined
  const navigate = useNavigate()
  const qc = useQueryClient()
  const editorRef = useRef<CollabCodeEditorHandle>(null)
  const [copied, setCopied] = useState(false)
  const [wsStatus, setWsStatus] = useState<EditorWsStatus>('connecting')
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
    mutationFn: () =>
      createRoom({
        room_type: 'interview',
        language: 'go',
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

  const wsToken = guestToken ?? readAccessToken() ?? ''
  const run = useSandboxRun()

  useEffect(() => {
    const prev = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#1e1e1e'
    return () => {
      document.body.style.backgroundColor = prev
    }
  }, [])

  if (isNew) {
    if (!authed) {
      return (
        <CenterMessage
          text="SIGN IN REQUIRED"
          sub="Войдите, чтобы создать live-комнату."
          action={
            <Link to="/login?next=/live/new">
              <Button size="sm">Войти</Button>
            </Link>
          }
        />
      )
    }
    return (
      <CenterMessage
        text={createM.isPending ? 'CREATING ROOM…' : 'LIVE CODING'}
        sub="Общий редактор с синхронизацией в реальном времени."
        action={
          <>
            {createM.error ? (
              <ErrorMessage
                message={createM.error instanceof Error ? createM.error.message : 'Ошибка'}
              />
            ) : null}
            <Button onClick={() => createM.mutate()} loading={createM.isPending}>
              Создать комнату
            </Button>
          </>
        }
      />
    )
  }

  if (!authed && inviteToken && !guestToken) {
    return (
      <GuestGate
        guestName={guestName}
        onNameChange={setGuestName}
        error={guestJoinM.error}
        loading={guestJoinM.isPending}
        onJoin={() => guestJoinM.mutate()}
        loginTo={`/login?next=/live/${roomId}?invite=${encodeURIComponent(inviteToken)}`}
      />
    )
  }

  if (!authed && !guestToken) {
    return (
      <CenterMessage
        text="INVITE REQUIRED"
        sub="Нужна ссылка-приглашение или вход в аккаунт."
        action={
          <Link to="/login">
            <Button variant="secondary" size="sm">
              Войти
            </Button>
          </Link>
        }
      />
    )
  }

  if (roomQ.isLoading || (authed && meQ.isLoading)) {
    return <CenterMessage text="LOADING ROOM…" />
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
      <CenterMessage
        text="ROOM NOT FOUND"
        sub={roomQ.error instanceof Error ? roomQ.error.message : undefined}
        action={
          authed ? (
            <Link to="/live/new">
              <Button variant="secondary" size="sm">
                Создать новую
              </Button>
            </Link>
          ) : undefined
        }
      />
    )
  }

  const myId = meQ.data?.id
  const myRole = room.participants.find((p) => p.user_id === myId)?.role
  const canFreeze = myRole === 'owner' || myRole === 'interviewer'
  const isOwner = myId === room.owner_id
  const canRun = !!(authed || guestToken)
  const panelBottom = runPanelHeight(run.panelOpen)

  const handleRun = () => {
    const code = editorRef.current?.getCode() ?? ''
    if (!code.trim()) return
    void run.executeRun({
      taskId: room.task_id,
      sessionTaskId,
      language: room.language,
      code,
      runType: room.task_id ? 'sample' : 'custom',
    })
  }

  return (
    <div className="fixed inset-0 bg-[#1e1e1e] text-[#d4d4d4]">
      <CollabCodeEditor
        ref={editorRef}
        roomId={room.id}
        language={room.language}
        frozen={room.is_frozen}
        userId={myId ?? guestName}
        displayName={meQ.data?.username ?? (guestName || undefined)}
        accessToken={wsToken}
        bottomInset={panelBottom}
        onRun={canRun ? handleRun : undefined}
        onWsStatusChange={setWsStatus}
      />

      <div className="fixed top-3.5 right-6 z-[25] flex items-center gap-2">
        {canRun ? <LiveCodeRunButton running={run.running} onRun={handleRun} /> : null}
        {isOwner ? (
          <LiveCodeToolButton loading={inviteM.isPending} onClick={() => inviteM.mutate()}>
            {copied ? 'Скопировано' : 'Пригласить'}
          </LiveCodeToolButton>
        ) : null}
        {canFreeze ? (
          <LiveCodeToolButton loading={freezeM.isPending} onClick={() => freezeM.mutate(!room.is_frozen)}>
            {room.is_frozen ? 'Разморозить' : 'Заморозить'}
          </LiveCodeToolButton>
        ) : null}
        <Link to="/today">
          <LiveCodeToolButton title="Закрыть">×</LiveCodeToolButton>
        </Link>
      </div>

      <RunOutputPanel
        open={run.panelOpen}
        onClose={() => run.setPanelOpen(false)}
        tab={run.outputTab}
        onTabChange={run.setOutputTab}
        run={run.activeRun}
        running={run.running}
        error={run.runError}
      />

      <LiveCodeStatusChip
        language={room.language}
        statusLabel={wsStatusLabel(wsStatus, room.is_frozen)}
        statusColor={wsStatusColor(wsStatus, room.is_frozen)}
        bottomOffset={panelBottom + 16}
        extra={
          wsStatus === 'failed' ? (
            <button
              type="button"
              className="pointer-events-auto ml-1 underline"
              style={{ color: 'var(--red)' }}
              onClick={() => editorRef.current?.reconnect()}
            >
              retry
            </button>
          ) : room.participants.length > 0 ? (
            <span className="pointer-events-none ml-1 text-[#858585]">
              · {room.participants.length} online
            </span>
          ) : null
        }
      />
    </div>
  )
}

function CenterMessage({
  text,
  sub,
  action,
}: {
  text: string
  sub?: string
  action?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#1e1e1e] px-6 text-center">
      <p className="font-mono text-[11px] tracking-[0.08em] text-[#858585]">{text}</p>
      {sub ? <p className="max-w-md text-sm leading-relaxed text-[#858585]">{sub}</p> : null}
      {action}
    </div>
  )
}

function GuestGate({
  guestName,
  onNameChange,
  error,
  loading,
  onJoin,
  loginTo,
}: {
  guestName: string
  onNameChange: (v: string) => void
  error: unknown
  loading: boolean
  onJoin: () => void
  loginTo: string
}) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-5 bg-bg px-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface-1 p-6">
        <h1 className="font-display text-xl font-bold">Вход как гость</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Имя для отображения в редакторе. Доступ только на время сессии.
        </p>
        <label htmlFor="guest-name" className="mt-4 block text-sm font-medium">
          Имя
        </label>
        <input
          id="guest-name"
          value={guestName}
          onChange={(e) => onNameChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-border-strong"
          placeholder="Кандидат"
        />
        {error ? (
          <div className="mt-3">
            <ErrorMessage message={error instanceof Error ? error.message : 'Ошибка входа'} />
          </div>
        ) : null}
        <Button className="mt-4 w-full" loading={loading} onClick={onJoin}>
          Войти в комнату
        </Button>
        <p className="mt-4 text-center text-xs text-text-muted">
          Уже есть аккаунт?{' '}
          <Link to={loginTo} className="underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  )
}
