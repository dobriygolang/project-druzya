import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { DemoCursor } from './DemoCursor';
import { SHOWCASE_INITIAL_CURSOR, runShowcaseLoop, type ShowcaseActions } from './runShowcase';
import type { CursorState } from './domUtils';
import { DEFAULT_SHOWCASE_TIMING } from './showcaseTiming';

interface DemoShowcaseProps {
  enabled: boolean;
  rootRef: RefObject<HTMLElement | null>;
  actions: ShowcaseActions;
}

export function DemoShowcase({ enabled, rootRef, actions }: DemoShowcaseProps) {
  const [cursor, setCursor] = useState<CursorState>(SHOWCASE_INITIAL_CURSOR);
  const pausedRef = useRef(false);
  const genRef = useRef(0);

  const pause = useCallback(() => {
    pausedRef.current = true;
    const root = rootRef.current;
    if (root) root.dataset.showcasePaused = 'true';
  }, [rootRef]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    const root = rootRef.current;
    if (root) root.dataset.showcasePaused = 'false';
  }, [rootRef]);

  useEffect(() => {
    if (!enabled) {
      genRef.current += 1;
      setCursor(SHOWCASE_INITIAL_CURSOR);
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const gen = genRef.current + 1;
    genRef.current = gen;

    void runShowcaseLoop(
      root,
      actions,
      setCursor,
      () => pausedRef.current,
      () => genRef.current !== gen,
      DEFAULT_SHOWCASE_TIMING,
    );

    return () => {
      genRef.current += 1;
    };
  }, [enabled, rootRef, actions]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !enabled) return;

    const hoverEl = (root.closest('.hone-embed-frame') as HTMLElement | null) ?? root;
    const onEnter = () => pause();
    const onLeave = () => resume();

    hoverEl.addEventListener('mouseenter', onEnter);
    hoverEl.addEventListener('mouseleave', onLeave);
    return () => {
      hoverEl.removeEventListener('mouseenter', onEnter);
      hoverEl.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled, rootRef, pause, resume]);

  if (!enabled) return null;

  return <DemoCursor cursor={cursor} />;
}
