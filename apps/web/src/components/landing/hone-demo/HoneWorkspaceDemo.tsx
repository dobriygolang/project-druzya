import { useEffect, useState, type CSSProperties } from 'react'
import { Menu, Pause, Play, RotateCcw } from 'lucide-react'

import { useI18n } from '@/lib/i18n'
import { useSiteTheme } from '@/lib/site/useSiteTheme'

import { CanvasBg } from './CanvasBg'

const POMODORO_SEC = 25 * 60

const WORDMARK_STYLE: CSSProperties = {
  position: 'absolute',
  top: 28,
  left: 28,
  zIndex: 10,
  pointerEvents: 'none',
}

const WORDMARK_LABEL: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.32em',
  color: 'var(--ink)',
  paddingBottom: 6,
  borderBottom: '1px solid var(--ink-60)',
  display: 'inline-block',
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
}

interface DemoProps {
  className?: string
  compact?: boolean
}

export function HoneWorkspaceDemo({ className, compact = false }: DemoProps) {
  const { theme } = useSiteTheme()
  const { t } = useI18n()
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const canvasTheme = theme === 'dark' ? 'particles' : 'winter'

  return (
    <div
      className={`hone-demo ${className ?? ''}`.trim()}
      data-theme={theme}
      role="img"
      aria-label={t('welcome.demoAriaLabel')}
    >
      <CanvasBg theme={canvasTheme} reducedMotion={reducedMotion} />

      <div style={WORDMARK_STYLE}>
        <div style={WORDMARK_LABEL}>FRIENDS</div>
      </div>

      <DemoDock compact={compact} />

      {!compact && (
        <p
          className="pointer-events-none absolute bottom-3 right-4 z-10 m-0 font-mono text-[10px] uppercase tracking-widest text-[rgb(var(--ink-rgb)/0.35)]"
          aria-hidden
        >
          {t('welcome.demoHint')}
        </p>
      )}
    </div>
  )
}

function DemoDock({ compact }: { compact: boolean }) {
  const { t } = useI18n()
  const [remain, setRemain] = useState(POMODORO_SEC)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running || remain <= 0) return
    const id = window.setInterval(() => {
      setRemain((s) => {
        if (s <= 1) {
          setRunning(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running, remain])

  const mm = String(Math.floor(remain / 60)).padStart(2, '0')
  const ss = String(remain % 60).padStart(2, '0')

  const reset = () => {
    setRunning(false)
    setRemain(POMODORO_SEC)
  }

  const bottom = compact ? 20 : 36

  return (
    <div
      style={{
        position: 'absolute',
        bottom,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
      }}
    >
      <div
        className="hone-demo-dock select-none"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 6,
          borderRadius: 14,
          border: '1px solid var(--ink-tint-06)',
        }}
      >
        <DockBtn title={t('welcome.demoMenu')} ariaLabel={t('welcome.demoMenu')} variant="menu">
          <Menu size={14} strokeWidth={2} />
        </DockBtn>
        <Divider />
        <div className="hone-demo-dock-timer">
          <div className="hone-demo-dock-timer-layer hone-demo-dock-timer-layer--time">
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 99,
                background: running ? 'var(--ink)' : 'transparent',
                border: `1px solid ${running ? 'var(--ink)' : 'var(--ink-60)'}`,
              }}
            />
            <span
              className="font-mono"
              style={{ fontSize: 14, letterSpacing: '0.04em', color: 'var(--ink)' }}
            >
              {mm}:{ss}
            </span>
          </div>
          <div className="hone-demo-dock-timer-layer hone-demo-dock-timer-layer--reset">
            <DockBtn
              onClick={reset}
              title={t('welcome.demoReset')}
              ariaLabel={t('welcome.demoReset')}
              small
              variant="action"
            >
              <RotateCcw size={14} strokeWidth={1.6} />
            </DockBtn>
          </div>
        </div>
        <Divider />
        <DockBtn
          onClick={() => setRunning((r) => !r)}
          title={running ? t('welcome.demoPause') : t('welcome.demoPlay')}
          ariaLabel={running ? t('welcome.demoPause') : t('welcome.demoPlay')}
          ariaPressed={running}
          variant="action"
        >
          {running ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />}
        </DockBtn>
      </div>
    </div>
  )
}

function DockBtn({
  children,
  onClick,
  title,
  small = false,
  ariaLabel,
  ariaPressed,
  variant = 'action',
}: {
  children: React.ReactNode
  onClick?: () => void
  title?: string
  small?: boolean
  ariaLabel?: string
  ariaPressed?: boolean
  variant?: 'menu' | 'action'
}) {
  const size = small ? 28 : 36
  const radius = small ? 8 : 10
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-pressed={ariaPressed}
      data-variant={variant}
      className="hone-demo-dock-btn"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        height: 16,
        background: 'rgb(var(--ink-rgb) / 0.18)',
        margin: '0 4px',
      }}
    />
  )
}
