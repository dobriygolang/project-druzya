type RunButtonProps = {
  running: boolean
  onRun: () => void
  disabled?: boolean
  title?: string
}

export function LiveCodeRunButton({ running, onRun, disabled, title }: RunButtonProps) {
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={disabled || running}
      title={title ?? 'Run code (⌘↵)'}
      className="rounded-full border-none px-3.5 py-1.5 font-mono text-xs font-medium tracking-[0.08em] transition-opacity disabled:cursor-default"
      style={{
        background: 'rgb(var(--ink))',
        color: 'rgb(var(--color-bg))',
        opacity: running || disabled ? 0.6 : 1,
      }}
    >
      {running ? '⏵ RUNNING…' : '▶ RUN'}
    </button>
  )
}

type ToolButtonProps = {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  title?: string
}

export function LiveCodeToolButton({ children, onClick, loading, title }: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      title={title}
      className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[10px] tracking-[0.06em] text-[#d4d4d4] transition-colors hover:bg-white/10 disabled:opacity-60"
    >
      {children}
    </button>
  )
}

type StatusChipProps = {
  language: string
  statusLabel: string
  statusColor: string
  extra?: React.ReactNode
  bottomOffset?: number
}

export function LiveCodeStatusChip({
  language,
  statusLabel,
  statusColor,
  extra,
  bottomOffset = 16,
}: StatusChipProps) {
  return (
    <div
      className="pointer-events-none fixed right-6 z-[25] flex items-center gap-2 rounded-full border border-white/10 bg-[rgba(20,20,22,0.78)] px-3.5 py-1.5 font-mono text-[10px] tracking-[0.08em] text-[#858585] backdrop-blur-md"
      style={{
        bottom: bottomOffset,
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
      }}
    >
      <span>{language.toUpperCase()}</span>
      <span className="opacity-40">·</span>
      <span style={{ color: statusColor }}>{statusLabel}</span>
      {extra}
    </div>
  )
}
