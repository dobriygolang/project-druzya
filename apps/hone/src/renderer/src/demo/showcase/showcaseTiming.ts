export interface ShowcaseTiming {
  introMs: number;
  cursorMoveMs: number;
  clickMs: number;
  homeAfterPlayMs: number;
  paletteOpenMs: number;
  notesBeforeTypeMs: number;
  typeCharMs: number;
  typeNewlineMul: number;
  typeHeadingMul: number;
  typeSpaceMul: number;
  notesAfterTypeMs: number;
  todayLoadMs: number;
  dragMs: number;
  todayHoldMs: number;
  loopGapMs: number;
}

export const DEFAULT_SHOWCASE_TIMING: ShowcaseTiming = {
  introMs: 800,
  cursorMoveMs: 580,
  clickMs: 150,
  homeAfterPlayMs: 2200,
  paletteOpenMs: 420,
  notesBeforeTypeMs: 550,
  typeCharMs: 28,
  typeNewlineMul: 4.5,
  typeHeadingMul: 2,
  typeSpaceMul: 0.5,
  notesAfterTypeMs: 1600,
  todayLoadMs: 900,
  dragMs: 720,
  todayHoldMs: 2400,
  loopGapMs: 1200,
};

export function typingDelayMs(char: string, timing: ShowcaseTiming): number {
  if (char === '\n') return Math.round(timing.typeCharMs * timing.typeNewlineMul);
  if (char === ' ') return Math.round(timing.typeCharMs * timing.typeSpaceMul);
  if (char === '#' || char === '-') return Math.round(timing.typeCharMs * timing.typeHeadingMul);
  return timing.typeCharMs;
}

export const SHOWCASE_NOTE_TEXT =
  '## Today\n\n- Ship landing demo\n- Drag tasks across days\n- Stay in flow\n';
