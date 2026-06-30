/** Showcase autoplay pacing — tune delays here. */
export interface ShowcaseTiming {
  /** Pause after loop reset before cursor appears. */
  introMs: number
  /** Cursor move + dwell before clicking Play. */
  cursorToPlayMs: number
  /** Click press duration. */
  clickMs: number
  /** Hold on home after timer starts. */
  homeAfterPlayMs: number
  /** Cursor move to Notes tab. */
  cursorToNotesMs: number
  /** Pause after Notes panel opens, before first character. */
  notesBeforeTypeMs: number
  /** Base interval per typed character. */
  typeCharMs: number
  /** Multiplier after a newline (paragraph pause). */
  typeNewlineMul: number
  /** Multiplier after `#` or `-` (structure pause). */
  typeHeadingMul: number
  /** Multiplier for spaces (faster). */
  typeSpaceMul: number
  /** Hold after typing finishes. */
  notesAfterTypeMs: number
  /** Cursor move to Today tab. */
  cursorToTodayMs: number
  /** Hold on Today panel. */
  todayHoldMs: number
  /** Cursor move back to Home. */
  cursorToHomeMs: number
  /** Pause before the loop restarts. */
  loopGapMs: number
}

export const DEFAULT_SHOWCASE_TIMING: ShowcaseTiming = {
  introMs: 700,
  cursorToPlayMs: 1300,
  clickMs: 160,
  homeAfterPlayMs: 2400,
  cursorToNotesMs: 1100,
  notesBeforeTypeMs: 500,
  typeCharMs: 26,
  typeNewlineMul: 5,
  typeHeadingMul: 2.2,
  typeSpaceMul: 0.55,
  notesAfterTypeMs: 1800,
  cursorToTodayMs: 1100,
  todayHoldMs: 3000,
  cursorToHomeMs: 1100,
  loopGapMs: 1400,
}

export function typingDelayMs(char: string, timing: ShowcaseTiming): number {
  if (char === '\n') return Math.round(timing.typeCharMs * timing.typeNewlineMul)
  if (char === ' ') return Math.round(timing.typeCharMs * timing.typeSpaceMul)
  if (char === '#' || char === '-') return Math.round(timing.typeCharMs * timing.typeHeadingMul)
  return timing.typeCharMs
}
