import { useEffect, useState, type CSSProperties } from 'react'

import { CanvasBg } from './CanvasBg'
import { DemoCursor } from './DemoCursor'
import { DemoDock } from './DemoDock'
import { DemoPanels } from './DemoPanels'
import { ThemePicker } from './ThemePicker'
import { defaultCanvasTheme } from './helpers'
import { useShowcasePlayback } from './useShowcasePlayback'
import type { CanvasThemeId, DemoPanel, HoneWorkspaceDemoProps } from './types'

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
  const showcase = useShowcasePlayback(mode === 'showcase' && !reducedMotion, fullNoteDoc)

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

  const activePanel = mode === 'showcase' ? showcase.panel : panel
  const typedText =
    mode === 'showcase' ? fullNoteDoc.slice(0, showcase.typedLength) : undefined

  const wordmarkTop = compact ? 18 : 28
  const wordmarkLeft = compact ? 18 : 28

  return (
    <div
      className={`hone-demo${compact ? ' hone-demo--compact' : ''} ${className ?? ''}`.trim()}
      data-theme={siteTheme}
      data-mode={mode}
      role="img"
      aria-label={labels.ariaLabel}
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

      <DemoPanels
        panel={activePanel}
        labels={labels}
        compact={compact}
        typedText={typedText}
        preloadNotes={mode === 'showcase' && !reducedMotion}
      />

      <DemoDock
        labels={labels}
        compact={compact}
        mode={mode}
        panel={activePanel}
        onPanelChange={mode === 'interactive' ? setPanel : undefined}
        timerRunning={mode === 'showcase' ? showcase.timerRunning : undefined}
        timerRemain={mode === 'showcase' ? showcase.timerRemain : undefined}
        navHighlight={mode === 'showcase' ? showcase.panel : null}
      />

      {mode === 'showcase' && !reducedMotion && <DemoCursor cursor={showcase.cursor} />}

      {mode === 'interactive' && !compact && (
        <p
          className="hone-demo-hint"
          aria-hidden
        >
          {labels.hint}
        </p>
      )}
    </div>
  )
}
