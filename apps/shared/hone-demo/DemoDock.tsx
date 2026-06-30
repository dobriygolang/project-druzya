import { useEffect, useState, type ReactNode } from 'react'

import type { DemoMode, DemoPanel, HoneDemoLabels } from './types'

const POMODORO_SEC = 25 * 60

function MenuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden>
      <path d="M3 2.5v8l7-4-7-4z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor" aria-hidden>
      <rect x="2.5" y="2" width="2.5" height="9" rx="0.5" />
      <rect x="8" y="2" width="2.5" height="9" rx="0.5" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3.5 3.5A5 5 0 1 1 3 7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M3 2v2.5H5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

interface DemoDockProps {
  labels: HoneDemoLabels
  compact?: boolean
  mode: DemoMode
  panel: DemoPanel
  onPanelChange?: (panel: DemoPanel) => void
  timerRunning?: boolean
  timerRemain?: number
  onToggleTimer?: () => void
  onResetTimer?: () => void
  navHighlight?: DemoPanel | null
}

export function DemoDock({
  labels,
  compact,
  mode,
  panel,
  onPanelChange,
  timerRunning: timerRunningProp,
  timerRemain: timerRemainProp,
  onToggleTimer,
  onResetTimer,
  navHighlight,
}: DemoDockProps) {
  const [remain, setRemain] = useState(POMODORO_SEC)
  const [running, setRunning] = useState(false)

  const timerRunning = timerRunningProp ?? running
  const timerRemain = timerRemainProp ?? remain

  useEffect(() => {
    if (mode === 'showcase' || !running || remain <= 0) return
    const id = window.setInterval(() => {
      setRemain((s: number) => {
        if (s <= 1) {
          setRunning(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [mode, running, remain])

  const mm = String(Math.floor(timerRemain / 60)).padStart(2, '0')
  const ss = String(timerRemain % 60).padStart(2, '0')

  const toggle = () => {
    if (onToggleTimer) {
      onToggleTimer()
      return
    }
    setRunning((r: boolean) => !r)
  }

  const reset = () => {
    if (onResetTimer) {
      onResetTimer()
      return
    }
    setRunning(false)
    setRemain(POMODORO_SEC)
  }

  const bottom = compact ? 20 : 36
  const interactive = mode === 'interactive'

  return (
    <div
      className="hone-demo-dock-wrap"
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
        <DockBtn title={labels.menu} ariaLabel={labels.menu} variant="menu" disabled={!interactive}>
          <MenuIcon />
        </DockBtn>
        <Divider />
        <NavBtn
          label={labels.dockHome}
          active={panel === 'home'}
          highlight={navHighlight === 'home'}
          onClick={() => onPanelChange?.('home')}
          disabled={!interactive}
        />
        <NavBtn
          label={labels.dockToday}
          active={panel === 'today'}
          highlight={navHighlight === 'today'}
          onClick={() => onPanelChange?.('today')}
          disabled={!interactive}
        />
        <NavBtn
          label={labels.dockNotes}
          active={panel === 'notes'}
          highlight={navHighlight === 'notes'}
          onClick={() => onPanelChange?.('notes')}
          disabled={!interactive}
        />
        <Divider />
        <div className="hone-demo-dock-timer">
          <div className="hone-demo-dock-timer-layer hone-demo-dock-timer-layer--time">
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 99,
                background: timerRunning ? 'var(--ink)' : 'transparent',
                border: `1px solid ${timerRunning ? 'var(--ink)' : 'var(--ink-60)'}`,
              }}
            />
            <span
              className="font-mono"
              style={{ fontSize: compact ? 12 : 14, letterSpacing: '0.04em', color: 'var(--ink)' }}
            >
              {mm}:{ss}
            </span>
          </div>
          {interactive && (
            <div className="hone-demo-dock-timer-layer hone-demo-dock-timer-layer--reset">
              <DockBtn
                onClick={reset}
                title={labels.reset}
                ariaLabel={labels.reset}
                small
                variant="action"
              >
                <ResetIcon />
              </DockBtn>
            </div>
          )}
        </div>
        <Divider />
        <DockBtn
          onClick={toggle}
          title={timerRunning ? labels.pause : labels.play}
          ariaLabel={timerRunning ? labels.pause : labels.play}
          ariaPressed={timerRunning}
          variant="action"
          disabled={!interactive && mode !== 'showcase'}
          data-demo-target="play"
        >
          {timerRunning ? <PauseIcon /> : <PlayIcon />}
        </DockBtn>
      </div>
    </div>
  )
}

function NavBtn({
  label,
  active,
  highlight,
  onClick,
  disabled,
}: {
  label: string
  active: boolean
  highlight?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`hone-demo-nav-btn${active ? ' hone-demo-nav-btn--active' : ''}${highlight ? ' hone-demo-nav-btn--highlight' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      data-demo-target={label.toLowerCase()}
    >
      {label.slice(0, 1)}
    </button>
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
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  title?: string
  small?: boolean
  ariaLabel?: string
  ariaPressed?: boolean
  variant?: 'menu' | 'action'
  disabled?: boolean
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
      disabled={disabled}
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
        margin: '0 2px',
      }}
    />
  )
}
