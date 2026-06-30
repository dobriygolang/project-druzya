import { useEffect, useRef, useState } from 'react'

import type { DemoPanel } from './types'
import type { ShowcaseState } from './useShowcasePlayback'

export interface UserDemoSnapshot {
  panel: DemoPanel
  timerRunning: boolean
  timerRemain: number
}

export interface RollbackDisplay extends UserDemoSnapshot {
  typedLength: number
  panelOpacity: number
}

const ROLLBACK_MS = 520

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function useShowcaseRollback(
  active: boolean,
  from: UserDemoSnapshot | null,
  to: ShowcaseState | null,
  typedFrom: number,
  typedTo: number,
  onComplete: () => void,
) {
  const [progress, setProgress] = useState(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useEffect(() => {
    if (!active || !from || !to) {
      setProgress(0)
      return
    }

    const t0 = performance.now()
    let raf = 0

    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ROLLBACK_MS)
      setProgress(p)
      if (p < 1) {
        raf = requestAnimationFrame(tick)
        return
      }
      onCompleteRef.current()
    }

    raf = requestAnimationFrame(tick)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [active, from, to, typedFrom, typedTo])

  if (!active || !from || !to) return null

  const eased = easeOutCubic(progress)
  const panel = progress < 0.42 ? from.panel : to.panel
  const panelOpacity = progress < 0.42 ? 1 - progress / 0.42 : (progress - 0.42) / 0.58

  return {
    panel,
    timerRunning: progress >= 0.92 ? to.timerRunning : from.timerRunning,
    timerRemain: Math.round(from.timerRemain + (to.timerRemain - from.timerRemain) * eased),
    typedLength: Math.round(typedFrom + (typedTo - typedFrom) * eased),
    panelOpacity: progress < 0.42 ? 1 : 0.35 + panelOpacity * 0.65,
  } satisfies RollbackDisplay
}
