import { Link } from 'react-router-dom'
import { Code2, Plus, Settings, X } from 'lucide-react'
import { brand } from '@/lib/brand/tokens'
import { cn } from '@/lib/cn'

type Props = {
  closeTo: string
  isOwner: boolean
  inviteLoading: boolean
  inviteCopied: boolean
  onInvite: () => void
  canFreeze: boolean
  freezeLoading: boolean
  frozen: boolean
  onFreeze: () => void
  wsFailed: boolean
  onReconnect: () => void
}

export function LiveRoomTopBar({
  closeTo,
  isOwner,
  inviteLoading,
  inviteCopied,
  onInvite,
  canFreeze,
  freezeLoading,
  frozen,
  onFreeze,
  wsFailed,
  onReconnect,
}: Props) {
  return (
    <header
      className="flex h-[52px] shrink-0 items-center justify-between gap-4 border-b bg-surface-1 px-4 sm:px-5"
      style={{ borderColor: brand.hair }}
    >
      <div className="flex min-w-0 items-center gap-4">
        <Link to={closeTo} className="inline-flex items-center gap-2 no-underline">
          <Code2 className="h-[18px] w-[18px] text-text-primary" strokeWidth={2} />
          <span className="text-[15px] font-medium tracking-[-0.01em] text-text-primary">
            druzya code
          </span>
        </Link>

        <div className="hidden items-center gap-2 sm:flex">
          <TopBarButton to={closeTo} variant="outline" icon={<X className="h-3.5 w-3.5" />}>
            Close room
          </TopBarButton>
          <TopBarButton to="/mock" variant="solid" icon={<Plus className="h-3.5 w-3.5" />}>
            Create room
          </TopBarButton>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {wsFailed ? (
          <button
            type="button"
            onClick={onReconnect}
            className="text-[13px] text-text-secondary underline hover:text-text-primary"
          >
            Reconnect
          </button>
        ) : null}

        <details className="relative">
          <summary
            className={cn(
              'flex cursor-pointer list-none items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-1.5',
              'text-[13px] font-medium text-text-primary transition-colors hover:bg-surface-2',
              '[&::-webkit-details-marker]:hidden',
            )}
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </summary>
          <div
            className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[180px] rounded-xl border border-border bg-surface-1 p-1.5 shadow-lg"
            style={{ boxShadow: brand.cardShadow }}
          >
            {isOwner ? (
              <MenuButton loading={inviteLoading} onClick={onInvite}>
                {inviteCopied ? 'Invite link copied' : 'Copy invite link'}
              </MenuButton>
            ) : null}
            {canFreeze ? (
              <MenuButton loading={freezeLoading} onClick={onFreeze}>
                {frozen ? 'Unfreeze editor' : 'Freeze editor'}
              </MenuButton>
            ) : null}
            {!isOwner && !canFreeze ? (
              <p className="px-3 py-2 text-[13px] text-text-muted">No room settings</p>
            ) : null}
          </div>
        </details>
      </div>
    </header>
  )
}

function TopBarButton({
  to,
  variant,
  icon,
  children,
}: {
  to: string
  variant: 'outline' | 'solid'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium no-underline transition-colors',
        variant === 'outline'
          ? 'border border-border-strong bg-surface-1 text-text-primary hover:bg-surface-2'
          : 'border border-text-primary bg-text-primary text-bg hover:bg-text-primary/90',
      )}
    >
      {icon}
      {children}
    </Link>
  )
}

function MenuButton({
  children,
  onClick,
  loading,
}: {
  children: React.ReactNode
  onClick: () => void
  loading?: boolean
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="flex w-full rounded-lg px-3 py-2 text-left text-[13px] text-text-primary transition-colors hover:bg-surface-2 disabled:opacity-50"
    >
      {children}
    </button>
  )
}
