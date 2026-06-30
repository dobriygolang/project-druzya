import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'

import { CanvasBg } from './CanvasBg'
import { DemoCursor } from './DemoCursor'
import { DemoDock } from './DemoDock'
import { DemoPanels } from './DemoPanels'
import { ThemePicker } from './ThemePicker'
import { defaultCanvasTheme } from './helpers'
import { useShowcaseRollback, type UserDemoSnapshot } from './useShowcaseRollback'
import { SHOWCASE_INITIAL, useShowcasePlayback, type ShowcaseState } from './useShowcasePlayback'
import type { CanvasThemeId, DemoPanel, HoneWorkspaceDemoProps } from './types'

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

function snapshotFromShowcase(state: ShowcaseState): UserDemoSnapshot {
  return {
    panel: state.panel,
    timerRunning: state.timerRunning,
    timerRemain: state.timerRemain,
  }
}

export function HoneWorkspaceDemo({
  siteTheme,
  labels,
  mode = 'interactive',
  compact = false,
  className,
  assetBase = '/hone-demo/backgrounds',
  showThemePicker = mode === 'interactive',
}: HoneWorkspaceDemoProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [canvasTheme, setCanvasTheme] = useState<CanvasThemeId>(() => defaultCanvasTheme(siteTheme))
  const [panel, setPanel] = useState<DemoPanel>('home')

  const fullNoteDoc = `# ${labels.noteTitle}\n\n${labels.noteBody}`
  const showcaseEnabled = mode === 'showcase' && !reducedMotion
  const { state: showcaseState, pause, resume } = useShowcasePlayback(showcaseEnabled, fullNoteDoc)

  const [userActive, setUserActive] = useState(false)
  const [rollingBack, setRollingBack] = useState(false)
  const [userState, setUserState] = useState<UserDemoSnapshot>(() => snapshotFromShowcase(SHOWCASE_INITIAL))
  const checkpointRef = useRef<ShowcaseState | null>(null)
  const exitSnapshotRef = useRef<UserDemoSnapshot | null>(null)

  const handleRollbackComplete = useCallback(() => {
    setRollingBack(false)
    exitSnapshotRef.current = null
    checkpointRef.current = null
    resume()
  }, [resume])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    setCanvasTheme(defaultCanvasTheme(siteTheme))
  }, [siteTheme])

  useEffect(() => {
    if (!userActive || !userState.timerRunning) return
    const id = window.setInterval(() => {
      setUserState((s) => ({
        ...s,
        timerRemain: s.timerRemain > 0 ? s.timerRemain - 1 : 0,
        timerRunning: s.timerRemain > 1,
      }))
    }, 1000)
    return () => window.clearInterval(id)
  }, [userActive, userState.timerRunning])

  const handleMouseEnter = () => {
    if (mode !== 'showcase' || reducedMotion || rollingBack) return
    pause()
    checkpointRef.current = { ...showcaseState }
    setUserState(snapshotFromShowcase(showcaseState))
    setUserActive(true)
  }

  const handleMouseLeave = () => {
    if (mode !== 'showcase' || reducedMotion || !userActive || !checkpointRef.current) return
    exitSnapshotRef.current = { ...userState }
    setUserActive(false)
    setRollingBack(true)
  }

  const rollbackTypedFrom =
    exitSnapshotRef.current?.panel === 'notes'
      ? fullNoteDoc.length
      : checkpointRef.current?.typedLength ?? 0

  const rollbackDisplay = useShowcaseRollback(
    rollingBack,
    exitSnapshotRef.current,
    checkpointRef.current,
    rollbackTypedFrom,
    checkpointRef.current?.typedLength ?? 0,
    handleRollbackComplete,
  )

  const isShowcaseAutoplay = mode === 'showcase' && !userActive && !rollingBack

  let activePanel: DemoPanel = panel
  let timerRunning = false
  let timerRemain = POMODORO_SEC
  let typedText: string | undefined
  let panelFade = 1

  if (mode === 'showcase') {
    if (rollingBack && rollbackDisplay) {
      activePanel = rollbackDisplay.panel
      timerRunning = rollbackDisplay.timerRunning
      timerRemain = rollbackDisplay.timerRemain
      typedText = fullNoteDoc.slice(0, rollbackDisplay.typedLength)
      panelFade = rollbackDisplay.panelOpacity
    } else if (userActive) {
      activePanel = userState.panel
      timerRunning = userState.timerRunning
      timerRemain = userState.timerRemain
      typedText = activePanel === 'notes' ? fullNoteDoc : undefined
    } else {
      activePanel = showcaseState.panel
      timerRunning = showcaseState.timerRunning
      timerRemain = showcaseState.timerRemain
      typedText = fullNoteDoc.slice(0, showcaseState.typedLength)
    }
  }

  const wordmarkTop = compact ? 18 : 28
  const wordmarkLeft = compact ? 18 : 28

  return (
    <div
      className={`hone-demo${compact ? ' hone-demo--compact' : ''} ${className ?? ''}`.trim()}
      data-theme={siteTheme}
      data-mode={mode}
      data-user-active={userActive ? 'true' : undefined}
      data-rolling-back={rollingBack ? 'true' : undefined}
      role="img"
      aria-label={labels.ariaLabel}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <CanvasBg theme={canvasTheme} assetBase={assetBase} reducedMotion={reducedMotion} />

      <div style={{ ...WORDMARK_STYLE, top: wordmarkTop, left: wordmarkLeft }}>
        <div style={{ ...WORDMARK_LABEL, fontSize: compact ? 11 : 13 }}>FRIENDS</div>
      </div>

      {showThemePicker && !reducedMotion && (
        <ThemePicker
          value={canvasTheme}
          onChange={setCanvasTheme}
          labels={labels}
          compact={compact}
        />
      )}

      <div
        className="hone-demo-panels-wrap"
        style={{ opacity: panelFade, transition: rollingBack ? 'opacity 0.28s ease' : undefined }}
      >
        <DemoPanels
          panel={activePanel}
          labels={labels}
          compact={compact}
          typedText={typedText}
          preloadNotes={showcaseEnabled}
          notesInteractive={userActive}
        />
      </div>

      <DemoDock
        labels={labels}
        compact={compact}
        mode={mode}
        forceInteractive={userActive}
        panel={activePanel}
        onPanelChange={
          userActive
            ? (p) => setUserState((s) => ({ ...s, panel: p }))
            : mode === 'interactive'
              ? setPanel
              : undefined
        }
        timerRunning={mode === 'showcase' ? timerRunning : undefined}
        timerRemain={mode === 'showcase' ? timerRemain : undefined}
        onToggleTimer={
          userActive
            ? () => setUserState((s) => ({ ...s, timerRunning: !s.timerRunning }))
            : undefined
        }
        onResetTimer={
          userActive
            ? () => setUserState((s) => ({ ...s, timerRunning: false, timerRemain: POMODORO_SEC }))
            : undefined
        }
        navHighlight={isShowcaseAutoplay ? showcaseState.panel : null}
      />

      {isShowcaseAutoplay && <DemoCursor cursor={showcaseState.cursor} />}

      {mode === 'interactive' && !compact && (
        <p className="hone-demo-hint" aria-hidden>
          {labels.hint}
        </p>
      )}

      {userActive && compact && (
        <p className="hone-demo-hint hone-demo-hint--takeover" aria-hidden>
          {labels.hint}
        </p>
      )}
    </div>
  )
}
