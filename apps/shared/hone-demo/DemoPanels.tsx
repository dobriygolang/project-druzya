import { Suspense, lazy, useEffect } from 'react'

import { preloadNotesPanel } from './useShowcasePlayback'
import type { HoneDemoLabels, DemoPanel } from './types'

const NotesPanel = lazy(() => import('./NotesPanel').then((m) => ({ default: m.NotesPanel })))

interface DemoPanelsProps {
  panel: DemoPanel
  labels: HoneDemoLabels
  compact?: boolean
  typedText?: string
  preloadNotes?: boolean
}

function PanelFallback() {
  return <div className="hone-demo-panel hone-demo-panel--loading" aria-hidden />
}

export function DemoPanels({ panel, labels, compact, typedText, preloadNotes }: DemoPanelsProps) {
  useEffect(() => {
    if (preloadNotes) preloadNotesPanel()
  }, [preloadNotes])

  const notesVisible = panel === 'notes'
  const mountNotes = preloadNotes || notesVisible

  return (
    <>
      {mountNotes && (
        <div
          className={`hone-demo-panel hone-demo-panel--notes${notesVisible ? '' : ' hone-demo-panel--preloaded'}`}
          aria-hidden={!notesVisible}
        >
          <Suspense fallback={notesVisible ? <PanelFallback /> : null}>
            <NotesPanel
              labels={labels}
              compact={compact}
              typedText={notesVisible ? typedText : ''}
              readOnly={typedText !== undefined}
            />
          </Suspense>
        </div>
      )}

      {panel === 'today' && (
        <div className="hone-demo-panel hone-demo-panel--today">
          <p className="hone-demo-today-heading">{labels.todayHeading}</p>
          <ul className="hone-demo-task-list">
            <li>{labels.task1}</li>
            <li>{labels.task2}</li>
            <li className="hone-demo-task-list__done">{labels.task3}</li>
          </ul>
        </div>
      )}
    </>
  )
}
