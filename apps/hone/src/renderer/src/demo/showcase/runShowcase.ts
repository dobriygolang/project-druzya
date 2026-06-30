import { toDayKey } from '@pages/TaskBoard/lib/dates';

import { demoNoteAppend, demoNoteSetBody } from './demoEvents';
import {
  animateCursor,
  centerInRoot,
  clickTarget,
  query,
  simulatePointerDrag,
  sleep,
  waitWhile,
  type CursorState,
} from './domUtils';
import {
  DEFAULT_SHOWCASE_TIMING,
  SHOWCASE_NOTE_TEXT,
  typingDelayMs,
  type ShowcaseTiming,
} from './showcaseTiming';

export interface ShowcaseActions {
  openPalette: () => void;
  closePalette: () => void;
  navigate: (id: 'home' | 'today' | 'notes') => void;
  goHome: () => void;
}

export const SHOWCASE_INITIAL_CURSOR: CursorState = {
  x: 640,
  y: 360,
  visible: false,
  clicking: false,
};

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export async function runShowcaseLoop(
  root: HTMLElement,
  actions: ShowcaseActions,
  setCursor: (fn: (c: CursorState) => CursorState) => void,
  isPaused: () => boolean,
  isCancelled: () => boolean,
  timing: ShowcaseTiming = DEFAULT_SHOWCASE_TIMING,
): Promise<void> {
  while (!isCancelled()) {
    setCursor(() => SHOWCASE_INITIAL_CURSOR);
    await sleep(timing.introMs);
    if (isCancelled()) return;
    await waitWhile(isPaused);

    const playBtn = query(root, '[data-hone-demo-target="dock-play"]');
    if (playBtn) {
      await clickTarget(setCursor, playBtn, root, timing);
    }

    await sleep(timing.homeAfterPlayMs);
    if (isCancelled()) return;
    await waitWhile(isPaused);

    const menuBtn = query(root, '[data-hone-demo-target="dock-menu"]');
    if (menuBtn) {
      await clickTarget(setCursor, menuBtn, root, timing);
    }
    await sleep(timing.paletteOpenMs);
    if (isCancelled()) return;
    await waitWhile(isPaused);

    const notesBtn = query(root, '[data-hone-demo-target="palette-notes"]');
    if (notesBtn) {
      await clickTarget(setCursor, notesBtn, root, timing);
    } else {
      actions.navigate('notes');
    }
    await sleep(timing.paletteOpenMs);
    if (isCancelled()) return;
    await waitWhile(isPaused);

    demoNoteSetBody('');
    await sleep(timing.notesBeforeTypeMs);
    if (isCancelled()) return;
    await waitWhile(isPaused);

    const editor = query(root, '[data-hone-demo-target="note-editor"]');
    if (editor) {
      await animateCursor(setCursor, centerInRoot(editor, root), timing.cursorMoveMs);
    }

    for (const char of SHOWCASE_NOTE_TEXT) {
      if (isCancelled()) return;
      await waitWhile(isPaused);
      demoNoteAppend(char);
      await sleep(typingDelayMs(char, timing));
    }

    await sleep(timing.notesAfterTypeMs);
    if (isCancelled()) return;
    await waitWhile(isPaused);

    const menuBtn2 = query(root, '[data-hone-demo-target="dock-menu"]');
    if (menuBtn2) {
      await clickTarget(setCursor, menuBtn2, root, timing);
    }
    await sleep(timing.paletteOpenMs);
    if (isCancelled()) return;
    await waitWhile(isPaused);

    const todayBtn = query(root, '[data-hone-demo-target="palette-today"]');
    if (todayBtn) {
      await clickTarget(setCursor, todayBtn, root, timing);
    } else {
      actions.navigate('today');
    }
    await sleep(timing.todayLoadMs);
    if (isCancelled()) return;
    await waitWhile(isPaused);

    const taskEl = query(root, '[data-task-id]');
    const tomorrowKey = toDayKey(addDays(new Date(), 1));
    const targetDay = query(root, `[data-day-key="${tomorrowKey}"]`);

    if (taskEl && targetDay) {
      await animateCursor(setCursor, centerInRoot(taskEl, root), timing.cursorMoveMs);
      setCursor((c) => ({ ...c, clicking: true }));
      await sleep(timing.clickMs);
      setCursor((c) => ({ ...c, clicking: false }));
      await simulatePointerDrag(taskEl, targetDay);
      await animateCursor(setCursor, centerInRoot(targetDay, root), timing.dragMs);
    }

    await sleep(timing.todayHoldMs);
    if (isCancelled()) return;
    await waitWhile(isPaused);

    actions.goHome();
    setCursor(() => SHOWCASE_INITIAL_CURSOR);
    await sleep(timing.loopGapMs);
  }
}
