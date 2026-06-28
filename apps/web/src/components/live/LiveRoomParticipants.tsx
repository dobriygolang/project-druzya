import { brand } from '@/lib/brand/tokens'
import type { CollabPeer } from '@/lib/codemirror/collabPresence'
import { cn } from '@/lib/cn'

type Props = {
  peers: CollabPeer[]
  className?: string
}

export function LiveRoomParticipants({ peers, className }: Props) {
  if (peers.length === 0) {
    return (
      <span className={cn('text-[12px] text-text-muted', className)}>Нет участников</span>
    )
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5 overflow-x-auto', className)}>
      {peers.map((peer) => (
        <div
          key={peer.clientId}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1',
            peer.isSelf ? 'border-border-strong bg-surface-2' : 'border-border bg-surface-1',
          )}
          style={{ borderColor: peer.isSelf ? brand.hair : undefined }}
          title={peer.active ? 'В комнате' : 'Вкладка неактивна'}
        >
          <span
            className={cn(
              'h-2 w-2 shrink-0 rounded-full ring-1 ring-black/5',
              peer.active ? 'bg-emerald-500' : 'bg-neutral-400',
            )}
            aria-hidden
          />
          <span
            className="max-w-[8rem] truncate font-mono text-[11px] tracking-[0.02em]"
            style={{ color: peer.isSelf ? undefined : peer.color }}
          >
            {peer.name}
            {peer.isSelf ? <span className="text-text-muted"> · вы</span> : null}
          </span>
        </div>
      ))}
    </div>
  )
}
