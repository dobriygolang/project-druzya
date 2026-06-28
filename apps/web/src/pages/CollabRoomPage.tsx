import { useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import {
  CollabCodeEditor,
  wsStatusColor,
  wsStatusLabel,
  type CollabCodeEditorHandle,
} from '@/components/CollabCodeEditor'
import type { CollabPeer } from '@/lib/codemirror/collabPresence'
import { LiveNewPage } from '@/components/live/LiveNewPage'
import { LiveRoomBottomBar } from '@/components/live/LiveRoomBottomBar'
import { LiveRoomTopBar } from '@/components/live/LiveRoomTopBar'
import { RunOutputPanel, runPanelHeight } from '@/components/live/RunOutputPanel'
import { Logo } from '@/components/brand/Logo'
import { brand } from '@/lib/brand/tokens'
import { Button } from '@/components/ui/Button'
import { ErrorMessage } from '@/components/ErrorMessage'
import { useFormatCode } from '@/hooks/useFormatCode'
import { useSandboxRun } from '@/hooks/useSandboxRun'
import { normalizeEditorLang } from '@/lib/codemirror/langExtension'
import { getMe } from '@/lib/api/auth'
import {
  closeRoom,
  createInvite,
  freezeRoom,
  getRoom,
  guestJoin,
  joinRoom,
  persistGuestToken,
  readGuestToken,
} from '@/lib/api/rooms'
import { readAccessToken } from '@/lib/apiClient'
import { markInviteCopied, readInviteCopied } from '@/lib/live/useCreateLiveRoom'

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

export default function CollabRoomPage() {
  const { roomId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite') ?? undefined
  const sessionTaskId = searchParams.get('sessionTaskId') ?? undefined
  const qc = useQueryClient()
  const editorRef = useRef<CollabCodeEditorHandle>(null)
  const [copied, setCopied] = useState(false)
  const [showInviteBanner, setShowInviteBanner] = useState(false)
  const [wsStatus, setWsStatus] = useState<import('@/lib/ws/collabEditor').EditorWsStatus>('connecting')
  const [guestName, setGuestName] = useState('')
  const [guestToken, setGuestToken] = useState(() => readGuestToken(roomId))
  const [guestRoom, setGuestRoom] = useState<import('@/lib/api/rooms').CodeRoom | null>(null)
  const [fontSize, setFontSize] = useState(14)
  const [peers, setPeers] = useState<CollabPeer[]>([])
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
      markInviteCopied(roomId)
      setCopied(true)
      setShowInviteBanner(true)
      window.setTimeout(() => setCopied(false), 2000)
    },
  })

  const closeM = useMutation({
    mutationFn: () => closeRoom(roomId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['my-active-rooms'] })
    },
  })

  const wsToken = guestToken ?? readAccessToken() ?? ''
  const run = useSandboxRun()
  const fmt = useFormatCode()

  useEffect(() => {
    if (isNew) return
    document.documentElement.classList.add('light')
    if (readInviteCopied(roomId)) {
      setShowInviteBanner(true)
      setCopied(true)
    }
    return () => {
      document.documentElement.classList.remove('light')
    }
  }, [isNew, roomId])

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
        description="Открой ссылку с ?invite=… от организатора или войди в аккаунт, если ты участник комнаты."
        hideJoin
      />
    )
  }

  if (roomQ.isLoading || (authed && meQ.isLoading)) {
    return <EditorShell message="Загрузка комнаты…" />
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
        message="Комната не найдена"
        sub={roomQ.error instanceof Error ? roomQ.error.message : undefined}
        action={
          <Link to="/mock">
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
  const closeTo = authed ? '/today' : '/welcome'
  const panelHeight = runPanelHeight(run.panelOpen)
  const displayName = meQ.data?.username ?? (guestName || 'Guest')

  const handleClose = () => {
    if (isOwner) {
      closeM.mutate(undefined, { onSettled: () => navigate(closeTo) })
      return
    }
    navigate(closeTo)
  }

  const handleFormat = async () => {
    const code = editorRef.current?.getCode() ?? ''
    if (!code.trim() || fmt.formatting || room.is_frozen) return
    const formatted = await fmt.format(room.language, code)
    if (formatted != null) editorRef.current?.setCode(formatted)
  }

  const handleRun = () => {
    const code = editorRef.current?.getCode() ?? ''
    if (!code.trim()) return
    run.setPanelOpen(true)
    void run.executeRun({
      taskId: room.task_id,
      sessionTaskId,
      language: room.language,
      code,
      runType: room.task_id ? 'sample' : 'custom',
    })
  }

  const statusLabel = wsStatusLabel(wsStatus, room.is_frozen)
  const statusColor =
    wsStatus === 'open' && !room.is_frozen ? brand.green : wsStatusColor(wsStatus, room.is_frozen)
  const isGo = normalizeEditorLang(room.language) === 'go'

  return (
    <div className="flex h-[100dvh] flex-col bg-bg text-text-primary">
      <LiveRoomTopBar
        closeTo={closeTo}
        onClose={handleClose}
        closeLoading={closeM.isPending}
        isOwner={isOwner}
        inviteLoading={inviteM.isPending}
        inviteCopied={copied}
        onInvite={() => inviteM.mutate()}
        canFreeze={canFreeze}
        freezeLoading={freezeM.isPending}
        frozen={room.is_frozen}
        onFreeze={() => freezeM.mutate(!room.is_frozen)}
        wsFailed={wsStatus === 'failed'}
        onReconnect={() => editorRef.current?.reconnect()}
        timerMode={authed ? 'elapsed' : 'countdown'}
        createdAt={room.created_at}
        expiresAt={room.expires_at}
      />

      {isOwner && showInviteBanner ? (
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b bg-surface-2 px-4 py-2 text-[13px] text-text-secondary sm:px-5"
          style={{ borderColor: brand.hair }}
        >
          <span>
            Отправь ссылку-приглашение гостю — он сможет войти без регистрации и редактировать код вместе с тобой.
          </span>
          <button
            type="button"
            onClick={() => setShowInviteBanner(false)}
            className="shrink-0 text-text-muted hover:text-text-primary"
          >
            Скрыть
          </button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 bg-[#1e1e1e]">
        <CollabCodeEditor
          ref={editorRef}
          roomId={room.id}
          language={room.language}
          frozen={room.is_frozen}
          userId={sessionUserId ?? guestName}
          displayName={displayName}
          accessToken={wsToken}
          bottomInset={panelHeight}
          fontSize={fontSize}
          onRun={canRun ? handleRun : undefined}
          onFormat={isGo && !room.is_frozen ? () => void handleFormat() : undefined}
          onPeersChange={setPeers}
          onWsStatusChange={setWsStatus}
        />

        {fmt.formatError ? (
          <div className="pointer-events-none absolute left-4 top-4 z-[25] rounded-lg border border-danger/30 bg-surface-1 px-3 py-2 text-xs text-danger shadow-sm">
            {fmt.formatError}
          </div>
        ) : null}

        <RunOutputPanel
          open={run.panelOpen}
          onClose={() => run.setPanelOpen(false)}
          tab={run.outputTab}
          onTabChange={run.setOutputTab}
          run={run.activeRun}
          running={run.running}
          error={run.runError}
          theme="light"
          placement="contained"
        />
      </div>

      <LiveRoomBottomBar
        language={room.language}
        fontSize={fontSize}
        onFontSizeChange={setFontSize}
        peers={peers}
        statusLabel={statusLabel}
        statusColor={statusColor}
        canRun={canRun}
        running={run.running}
        onRun={handleRun}
        canFormat={isGo && !room.is_frozen}
        formatting={fmt.formatting}
        onFormat={() => void handleFormat()}
        outputOpen={run.panelOpen}
        onToggleOutput={() => run.setPanelOpen((v) => !v)}
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
  useEffect(() => {
    document.documentElement.classList.add('light')
  }, [])

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <Logo to="/welcome" />
      <p className="text-sm font-medium text-text-primary">{message}</p>
      {sub ? <p className="max-w-md text-sm leading-relaxed text-text-secondary">{sub}</p> : null}
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
              <Link to="/mock">
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
