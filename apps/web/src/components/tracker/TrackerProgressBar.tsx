import { cn } from '@/lib/cn'

type TrackerProgressBarProps = {
  value: number
  max: number
  label?: string
  /** Task completion: purple → green. Capacity: blue → amber when over limit. */
  mode?: 'tasks' | 'capacity'
  className?: string
}

function fillColor(mode: 'tasks' | 'capacity', value: number, max: number): string {
  if (max <= 0) return 'var(--tracker-progress-muted, #3a3a3a)'
  if (mode === 'capacity') {
    if (value > max) return 'var(--tracker-progress-over, #E8B548)'
    if (value >= max * 0.85) return 'var(--tracker-progress-warn, #C4A86E)'
    return 'var(--tracker-progress-capacity, #7B9FD4)'
  }
  const ratio = value / max
  if (ratio >= 1) return 'var(--sdvg-green, #4CB35C)'
  if (ratio > 0) return 'var(--tracker-progress-active, #9B8FD4)'
  return 'var(--tracker-progress-muted, #3a3a3a)'
}

export function TrackerProgressBar({
  value,
  max,
  label,
  mode = 'tasks',
  className,
}: TrackerProgressBarProps) {
  const safeMax = Math.max(max, 0)
  const ratio = safeMax > 0 ? value / safeMax : 0
  const widthPct = mode === 'capacity' && value > safeMax ? 100 : Math.min(100, ratio * 100)
  const displayLabel = label ?? (safeMax > 0 ? `${Math.round(value)}/${Math.round(safeMax)}` : '0/0')

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-500 ease-out"
          style={{
            width: `${widthPct}%`,
            backgroundColor: fillColor(mode, value, safeMax),
          }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-text-muted">{displayLabel}</span>
    </div>
  )
}
