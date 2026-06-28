import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import {
  CollabCodeEditor,
  wsStatusColor,
  wsStatusLabel,
  type CollabCodeEditorHandle,
} from '@/components/CollabCodeEditor'
import { LiveNewPage } from '@/components/live/LiveNewPage'
import { LiveCodeRunButton, LiveCodeStatusChip, LiveCodeToolButton } from '@/components/live/LiveCodeChrome'
import { RunOutputPanel, runPanelHeight } from '@/components/live/RunOutputPanel'
import { Logo } from '@/components/brand/Logo'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { useSandboxRun } from '@/hooks/useSandboxRun'
import { getMe } from '@/lib/api/auth'
import {
  createInvite,
  freezeRoom,
  getRoom,
  guestJoin,
  joinRoom,
  persistGuestToken,
  readGuestToken,
} from '@/lib/api/rooms'
import { readAccessToken } from '@/lib/apiClient'
import type { EditorWsStatus } from '@/lib/ws/collabEditor'

function jwtSubject(token: string): string | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const padded = part.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(padded)) as { sub?: string }
    return json.sub ?? null
  } catch {
    return null
  }
}

/** Immersive live room — full-viewport editor + RUN + output panel. */
export default function CollabRoomPage() {
  const { roomId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite') ?? undefined
  const sessionTaskId = searchParams.get('sessionTaskId') ?? undefined
  const qc = useQueryClient()
  const editorRef = useRef<CollabCodeEditorHandle>(null)
  const [copied, setCopied] = useState(false)
  const [wsStatus, setWsStatus] = useState<EditorWsStatus>('connecting')
  const [guestName, setGuestName] = useState('')
  const [guestToken, setGuestToken] = useState(() => readGuestToken(roomId))
  const [guestRoom, setGuestRoom] = useState<import('@/lib/api/rooms').CodeRoom | null>(null)
  const isNew = roomId === 'new'
  const authed = !!readAccessToken()
  const hasSession = authed || !!guestToken

  const meQ = useQuery({ queryKey: ['me'], queryFn: getMe, enabled: authed })

  const roomQ = useQuery({
    queryKey: ['room', roomId, inviteToken],
    queryFn: async () => {
      try {
        return await getRoom(roomId)
      } catch {
        if (authed) return joinRoom(roomId, { inviteToken })
        throw new Error('room not found')
      }
    },
    enabled: !!roomId && !isNew && hasSession,
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
    if (isNew) return
    const prev = document.body.style.backgroundColor
    document.body.style.backgroundColor = '#1e1e1e'
    return () => {
      document.body.style.backgroundColor = prev
    }
  }, [isNew])

  if (isNew) {
    return <LiveNewPage />
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

  if (!hasSession) {
    return (
      <GuestGate
        guestName={guestName}
        onNameChange={setGuestName}
        error={null}
        loading={false}
        onJoin={() => {}}
        loginTo={`/login?next=/live/${roomId}`}
        title="Нужен доступ"
        description="Войди в аккаунт или открой ссылку-приглашение от организатора."
        hideJoin
      />
    )
  }

  if (roomQ.isLoading || (authed && meQ.isLoading)) {
    return <EditorShell message="LOADING ROOM…" />
  }

  const room =
    guestRoom ??
    roomQ.data ??
    (guestToken
      ? {
          id: roomId,
          owner_id: jwtSubject(guestToken) ?? '',
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
      <EditorShell
        message="ROOM NOT FOUND"
        sub={roomQ.error instanceof Error ? roomQ.error.message : undefined}
        action={
          <Link to="/live/new">
            <Button variant="secondary" size="sm">
              Создать новую
            </Button>
          </Link>
        }
      />
    )
  }

  const sessionUserId = meQ.data?.id ?? (wsToken ? jwtSubject(wsToken) : null)
  const myRole = room.participants.find((p) => p.user_id === sessionUserId)?.role
  const isOwner = sessionUserId === room.owner_id
  const canFreeze = myRole === 'owner' || myRole === 'interviewer' || isOwner
  const canRun = !!hasSession
  const panelBottom = runPanelHeight(run.panelOpen)
  const closeTo = authed ? '/today' : '/welcome'

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
        userId={sessionUserId ?? guestName}
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
        <Link to={closeTo}>
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

function EditorShell({
  message,
  sub,
  action,
}: {
  message: string
  sub?: string
  action?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[#1e1e1e] px-6 text-center">
      <p className="font-mono text-[11px] tracking-[0.08em] text-[#858585]">{message}</p>
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
  title = 'Вход как гость',
  description = 'Имя для отображения в редакторе. Доступ только на время сессии.',
  hideJoin = false,
}: {
  guestName: string
  onNameChange: (v: string) => void
  error: unknown
  loading: boolean
  onJoin: () => void
  loginTo: string
  title?: string
  description?: string
  hideJoin?: boolean
}) {
  useEffect(() => {
    document.documentElement.classList.add('light')
  }, [])

  return (
    <div className="min-h-screen bg-bg text-text-primary">
      <header className="border-b px-6 py-5 sm:px-8" style={{ borderColor: brand.hair }}>
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Logo to="/welcome" />
          <Link to={loginTo} className="text-sm text-text-secondary no-underline">
            Войти
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-16">
        <div className="sdvg-card w-full p-6 sm:p-7" style={{ boxShadow: brand.cardShadow }}>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{description}</p>
          {!hideJoin ? (
            <>
              <label htmlFor="guest-name" className="mt-5 block text-sm font-medium">
                Имя
              </label>
              <input
                id="guest-name"
                value={guestName}
                onChange={(e) => onNameChange(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-surface-1 px-3 py-2.5 text-sm outline-none focus:border-border-strong"
                placeholder="Кандидат"
              />
              {error ? (
                <div className="mt-3">
                  <ErrorMessage message={error instanceof Error ? error.message : 'Ошибка входа'} />
                </div>
              ) : null}
              <Button className="mt-5 w-full" loading={loading} onClick={onJoin}>
                Войти в комнату
              </Button>
            </>
          ) : (
            <div className="mt-5 flex flex-col gap-2">
              <Link to={loginTo}>
                <Button className="w-full">Войти в аккаунт</Button>
              </Link>
              <Link to="/live/new">
                <Button variant="ghost" className="w-full">
                  Создать свою комнату
                </Button>
              </Link>
            </div>
          )}
          {!hideJoin ? (
            <p className="mt-4 text-center text-xs text-text-muted">
              Уже есть аккаунт?{' '}
              <Link to={loginTo} className="text-text-primary underline">
                Войти
              </Link>
            </p>
          ) : null}
        </div>
      </main>
    </div>
  )
}
