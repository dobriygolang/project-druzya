import { cn } from '@/lib/cn'

export function PillButton({
  children,
  active,
  loading,
  disabled,
  title,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  loading?: boolean
  disabled?: boolean
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'border-border-strong bg-surface-2 font-medium text-text-primary'
          : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary',
      )}
    >
      {loading ? '…' : children}
    </button>
  )
}
