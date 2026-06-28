import type { CodeRun } from '@/lib/types'

const PANEL_HEIGHT = 220

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

export function runPanelHeight(open: boolean): number {
  return open ? PANEL_HEIGHT : 0
}

export function RunOutputPanel({
  open,
  onClose,
  tab,
  onTabChange,
  run,
  running,
  error,
  placement = 'viewport',
}: Props) {
  if (!open) return null

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

  return (
    <div
      className={`${positionClass} flex flex-col border-t border-[var(--hair-2)] bg-[rgba(15,15,17,0.96)] font-mono backdrop-blur-[20px]`}
      style={{ height: PANEL_HEIGHT }}
    >
      <div className="flex items-center justify-between border-b border-[var(--hair)] px-4 py-2.5">
        <div className="flex items-center gap-3.5">
          {(['stdout', 'stderr'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTabChange(t)}
              className="border-none bg-transparent p-0 text-[10px] tracking-[0.08em] transition-colors"
              style={{ color: tab === t ? 'rgb(var(--ink))' : 'var(--ink-40)' }}
            >
              {t.toUpperCase()}
            </button>
          ))}
          {statusLabel ? (
            <span
              className="text-[10px] tracking-[0.08em]"
              style={{ color: run && isRunnerError(run.status) ? 'var(--red)' : 'var(--ink-40)' }}
            >
              {statusLabel}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="border-none bg-transparent text-sm leading-none text-[var(--ink-40)] transition-colors hover:text-[rgb(var(--ink))]"
          title="Close output"
        >
          ×
        </button>
      </div>
      <pre
        className="m-0 flex-1 overflow-auto px-4 py-3 text-xs whitespace-pre-wrap"
        style={{ color: tab === 'stderr' ? 'var(--red)' : 'rgb(var(--ink))' }}
      >
        {panelBody({ tab, run, running, error })}
      </pre>
    </div>
  )
}
