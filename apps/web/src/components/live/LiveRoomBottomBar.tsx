import { Minus, Play, Plus } from 'lucide-react'
import { LiveRoomParticipants } from '@/components/live/LiveRoomParticipants'
import { LIVE_LANGS } from '@/lib/live/constants'
import { brand } from '@/lib/brand/tokens'
import type { CollabPeer } from '@/lib/codemirror/collabPresence'
import { cn } from '@/lib/cn'
import { useI18n } from '@/lib/i18n'

const FONT_MIN = 12
const FONT_MAX = 20

type Props = {
  mode?: 'code' | 'diagram'
  language: string
  fontSize: number
  onFontSizeChange: (size: number) => void
  peers: CollabPeer[]
  statusLabel: string
  statusColor: string
  canRun: boolean
  running: boolean
  onRun: () => void
  canFormat?: boolean
  formatting?: boolean
  onFormat?: () => void
  outputOpen: boolean
  onToggleOutput: () => void
}

export function LiveRoomBottomBar({
  mode = 'code',
  language,
  fontSize,
  onFontSizeChange,
  peers,
  statusLabel,
  statusColor,
  canRun,
  running,
  onRun,
  canFormat,
  formatting,
  onFormat,
  outputOpen,
  onToggleOutput,
}: Props) {
  const { t } = useI18n()
  const isDiagram = mode === 'diagram'
  const langLabel = isDiagram
    ? t('live.diagramRoom')
    : (LIVE_LANGS.find((l) => l.id === language)?.label ?? language)

  return (
    <footer
      className="flex min-h-[48px] shrink-0 flex-col gap-2 border-t bg-surface-1 px-4 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-0"
      style={{ borderColor: brand.hair }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
        {canRun && !isDiagram ? (
          <button
            type="button"
            onClick={onRun}
            disabled={running}
            title="Run (⌘↵)"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border border-text-primary bg-text-primary px-3 py-1.5',
              'text-[13px] font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50',
            )}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            {running ? t('live.running') : t('live.run')}
          </button>
        ) : null}

        {canFormat && !isDiagram ? (
          <button
            type="button"
            onClick={onFormat}
            disabled={formatting}
            title="gofmt (⌘⇧F)"
            className={cn(
              'inline-flex items-center rounded-lg border border-border px-3 py-1.5',
              'font-mono text-[11px] tracking-[0.06em] text-text-secondary transition-colors hover:bg-surface-2 disabled:opacity-50',
            )}
          >
            {formatting ? 'FMT…' : 'FMT'}
          </button>
        ) : null}

        {!isDiagram ? (
          <button
            type="button"
            onClick={onToggleOutput}
            className={cn(
              'hidden rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors sm:inline-flex',
              outputOpen
                ? 'border-border-strong bg-surface-2 text-text-primary'
                : 'border-border text-text-secondary hover:bg-surface-2',
            )}
          >
            {t('live.output')}
          </button>
        ) : null}

        <div
          className="hidden items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[13px] text-text-secondary sm:flex"
          title={t('live.roomLanguage')}
        >
          <span>{langLabel}</span>
        </div>

        {!isDiagram ? (
          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 px-1 py-0.5">
            <IconButton
              aria-label={t('live.fontDecrease')}
              disabled={fontSize <= FONT_MIN}
              onClick={() => onFontSizeChange(Math.max(FONT_MIN, fontSize - 1))}
            >
              <Minus className="h-3.5 w-3.5" />
            </IconButton>
            <span className="min-w-[1.5rem] text-center font-mono text-[13px] text-text-primary">
              {fontSize}
            </span>
            <IconButton
              aria-label={t('live.fontIncrease')}
              disabled={fontSize >= FONT_MAX}
              onClick={() => onFontSizeChange(Math.min(FONT_MAX, fontSize + 1))}
            >
              <Plus className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        ) : null}

        <span className="hidden items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-text-muted md:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor }} />
          {statusLabel}
        </span>
      </div>

      <LiveRoomParticipants peers={peers} className="max-w-full sm:max-w-[50%] sm:justify-end" />
    </footer>
  )
}

function IconButton({
  children,
  onClick,
  disabled,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  'aria-label': string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary disabled:opacity-30"
    >
      {children}
    </button>
  )
}

export const LIVE_BOTTOM_BAR_HEIGHT = 48
