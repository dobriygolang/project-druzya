import type { CodeRun } from '@/lib/types'

const PANEL_HEIGHT = 160

type Props = {
  open: boolean
  onClose: () => void
  tab: 'stdout' | 'stderr'
  onTabChange: (tab: 'stdout' | 'stderr') => void
  run?: CodeRun
  running: boolean
  error?: string | null
  /** viewport = full screen bottom (CollabRoom); contained = inside editor block */
  placement?: 'viewport' | 'contained'
  theme?: 'light' | 'dark'
  panelLabel?: string
  closeTitle?: string
}

function isRunnerError(status: string): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  return s.includes('failed') || s.includes('error') || s === 'internal_error'
}

function panelBody({
  tab,
  run,
  running,
  error,
}: Pick<Props, 'tab' | 'run' | 'running' | 'error'>): string {
  if (error) return error
  if (running && !run) return '…'
  if (!run) return ''
  if (tab === 'stdout') {
    const out = run.stdout?.trim()
    if (out) return out
    if (run.tests_total > 0) {
      return `tests: ${run.tests_passed}/${run.tests_total}`
    }
    return '(no stdout)'
  }
  const err =
    run.stderr?.trim() ||
    run.compile_output?.trim() ||
    run.error?.trim() ||
    ''
  return err || '(no stderr)'
}

/** @deprecated use {@link runPanelHeight} with explicit open flag */
export function runPanelHeight(open: boolean): number {
  return open ? PANEL_HEIGHT : 0
}

export { PANEL_HEIGHT as RUN_OUTPUT_PANEL_HEIGHT }

export function RunOutputPanel({
  open,
  onClose,
  tab,
  onTabChange,
  run,
  running,
  error,
  placement = 'viewport',
  theme = 'dark',
  panelLabel,
  closeTitle,
}: Props) {
  if (!open) return null

  const light = theme === 'light'

  const positionClass =
    placement === 'contained'
      ? 'absolute bottom-0 left-0 right-0 z-[24]'
      : 'fixed bottom-0 left-0 right-0 z-[24]'

  const statusLabel = run
    ? isRunnerError(run.status)
      ? `RUNNER · ${run.status.toUpperCase()}`
      : run.exit_code != null && run.time_ms != null
        ? `EXIT ${run.exit_code} · ${run.time_ms}ms`
        : run.status.toUpperCase()
    : null

  // Dark panel uses fixed VS Code-like colors — not page --ink-* vars (light theme = dark ink on dark panel).
  const shellClass = light
    ? 'border-t border-border bg-surface-1 text-text-primary'
    : 'border-t border-white/10 bg-[#1a1a1a] font-mono text-[#d4d4d4] backdrop-blur-[20px]'

  return (
    <div className={`${positionClass} flex flex-col ${shellClass}`} style={{ height: PANEL_HEIGHT }}>
      <div
        className={`flex items-center justify-between border-b px-4 py-2.5 ${light ? 'border-border' : 'border-white/10'}`}
      >
        <div className="flex items-center gap-3.5">
          {panelLabel ? (
            <span
              className={`text-[10px] uppercase tracking-[0.08em] ${light ? 'font-medium text-text-muted' : 'text-[#858585]'}`}
            >
              {panelLabel}
            </span>
          ) : null}
          {(['stdout', 'stderr'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTabChange(t)}
              className={`border-none bg-transparent p-0 text-[10px] uppercase tracking-[0.08em] transition-colors ${
                light
                  ? tab === t
                    ? 'font-medium text-text-primary'
                    : 'font-medium text-text-muted'
                  : tab === t
                    ? 'text-[#d4d4d4]'
                    : 'text-[#858585] hover:text-[#d4d4d4]'
              }`}
            >
              {t}
            </button>
          ))}
          {statusLabel ? (
            <span
              className={`font-mono text-[10px] tracking-[0.08em] ${
                run && isRunnerError(run.status)
                  ? 'text-[#f48771]'
                  : light
                    ? 'text-text-muted'
                    : 'text-[#858585]'
              }`}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className={`border-none bg-transparent text-sm leading-none transition-colors ${
            light
              ? 'text-text-muted hover:text-text-primary'
              : 'text-[#858585] hover:text-[#d4d4d4]'
          }`}
          title={closeTitle ?? 'Close output'}
        >
          ×
        </button>
      </div>
      <pre
        className={`m-0 flex-1 overflow-auto px-4 py-3 text-xs whitespace-pre-wrap ${
          tab === 'stderr'
            ? light
              ? 'font-mono text-danger'
              : 'text-[#f48771]'
            : light
              ? 'font-mono text-text-primary'
              : 'text-[#d4d4d4]'
        }`}
      >
        {panelBody({ tab, run, running, error })}
      </pre>
    </div>
  )
}
