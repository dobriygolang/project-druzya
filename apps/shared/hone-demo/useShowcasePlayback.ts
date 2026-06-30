import { useEffect, useRef, useState } from 'react'

import { DEFAULT_SHOWCASE_TIMING, typingDelayMs, type ShowcaseTiming } from './showcaseTiming'
import type { DemoPanel } from './types'

export interface CursorState {
  x: number
  y: number
  visible: boolean
  clicking: boolean
}

export interface ShowcaseState {
  panel: DemoPanel
  cursor: CursorState
  timerRunning: boolean
  timerRemain: number
  typedLength: number
}

const POMODORO_SEC = 25 * 60

const INITIAL: ShowcaseState = {
  panel: 'home',
  cursor: { x: 50, y: 50, visible: false, clicking: false },
  timerRunning: false,
  timerRemain: POMODORO_SEC,
  typedLength: 0,
}

interface Step {
  delay: number
  run: (prev: ShowcaseState) => ShowcaseState
}

function clickStep(run: (s: ShowcaseState) => ShowcaseState, timing: ShowcaseTiming): Step[] {
  return [
    {
      delay: timing.clickMs,
      run: (s) => ({ ...s, cursor: { ...s.cursor, clicking: true } }),
    },
    {
      delay: timing.clickMs,
      run,
    },
  ]
}

function steps(fullDocument: string, timing: ShowcaseTiming): Step[] {
  const typingSteps: Step[] = []
  for (let i = 0; i < fullDocument.length; i++) {
    const len = i + 1
    typingSteps.push({
      delay: typingDelayMs(fullDocument[i] ?? '', timing),
      run: (s) => ({ ...s, typedLength: len }),
    })
  }

  return [
    {
      delay: timing.introMs,
      run: () => ({ ...INITIAL, cursor: { x: 78, y: 88, visible: true, clicking: false } }),
    },
    {
      delay: timing.cursorToPlayMs,
      run: (s) => ({ ...s, cursor: { ...s.cursor, x: 78, y: 88, visible: true, clicking: false } }),
    },
    ...clickStep(
      (s) => ({ ...s, cursor: { ...s.cursor, clicking: false }, timerRunning: true }),
      timing,
    ),
    { delay: timing.homeAfterPlayMs, run: (s) => s },
    {
      delay: timing.cursorToNotesMs,
      run: (s) => ({ ...s, cursor: { x: 42, y: 88, visible: true, clicking: false } }),
    },
    ...clickStep(
      (s) => ({ ...s, cursor: { ...s.cursor, clicking: false }, panel: 'notes', typedLength: 0 }),
      timing,
    ),
    { delay: timing.notesBeforeTypeMs, run: (s) => s },
    ...typingSteps,
    { delay: timing.notesAfterTypeMs, run: (s) => s },
    {
      delay: timing.cursorToTodayMs,
      run: (s) => ({ ...s, cursor: { x: 32, y: 88, visible: true, clicking: false } }),
    },
    ...clickStep(
      (s) => ({ ...s, cursor: { ...s.cursor, clicking: false }, panel: 'today' }),
      timing,
    ),
    { delay: timing.todayHoldMs, run: (s) => s },
    {
      delay: timing.cursorToHomeMs,
      run: (s) => ({ ...s, cursor: { x: 22, y: 88, visible: true, clicking: false } }),
    },
    ...clickStep(
      (s) => ({ ...s, cursor: { ...s.cursor, clicking: false }, panel: 'home' }),
      timing,
    ),
    { delay: timing.loopGapMs, run: () => INITIAL },
  ]
}

export function useShowcasePlayback(
  enabled: boolean,
  fullDocument: string,
  timing: ShowcaseTiming = DEFAULT_SHOWCASE_TIMING,
) {
  const [state, setState] = useState<ShowcaseState>(INITIAL)
  const timersRef = useRef<number[]>([])

  useEffect(() => {
    if (!enabled) {
      setState(INITIAL)
      return
    }

    const clearAll = () => {
      for (const id of timersRef.current) window.clearTimeout(id)
      timersRef.current = []
    }

    const runLoop = () => {
      clearAll()
      setState(INITIAL)
      let elapsed = 0
      for (const step of steps(fullDocument, timing)) {
        elapsed += step.delay
        const id = window.setTimeout(() => {
          setState((prev: ShowcaseState) => step.run(prev))
        }, elapsed)
        timersRef.current.push(id)
      }
      const loopId = window.setTimeout(runLoop, elapsed)
      timersRef.current.push(loopId)
    }

    runLoop()
    return clearAll
  }, [enabled, fullDocument, timing])

  useEffect(() => {
    if (!enabled || !state.timerRunning) return
    const id = window.setInterval(() => {
      setState((s: ShowcaseState) => {
        if (!s.timerRunning || s.timerRemain <= 0) return s
        return { ...s, timerRemain: s.timerRemain - 1 }
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [enabled, state.timerRunning])

  return state
}

export function preloadNotesPanel(): void {
  void import('./NotesPanel')
}
