import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'

type Props = {
  mode: 'countdown' | 'elapsed'
  createdAt?: string
  expiresAt?: string
  className?: string
}

function parseTs(value?: string): number | null {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function formatDuration(totalSec: number): string {
  const sec = Math.max(0, totalSec)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

export function RoomSessionTimer({ mode, createdAt, expiresAt, className }: Props) {
  const { t } = useI18n()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const createdMs = parseTs(createdAt)
  const expiresMs = parseTs(expiresAt)

  let label: string
  let value: string
  let urgent = false

  if (mode === 'countdown') {
    if (expiresMs == null) {
      return null
    }
    const remainingSec = Math.ceil((expiresMs - now) / 1000)
    label = t('live.timerRemaining')
    value = formatDuration(remainingSec)
    urgent = remainingSec <= 300
  } else {
    if (createdMs == null) {
      return null
    }
    const elapsedSec = Math.floor((now - createdMs) / 1000)
    label = t('live.timerSession')
    value = formatDuration(elapsedSec)
  }

  return (
    <div
      className={cn(
        'hidden items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] tabular-nums sm:flex',
        urgent
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-800'
          : 'border-border bg-surface-1 text-text-secondary',
        className,
      )}
      title={mode === 'countdown' ? t('live.timerCountdownTitle') : t('live.timerElapsedTitle')}
    >
      <span className="font-medium text-text-primary">{value}</span>
      <span>{label}</span>
    </div>
  )
}
