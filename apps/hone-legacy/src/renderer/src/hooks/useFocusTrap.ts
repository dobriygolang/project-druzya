/**
 * React hook around createFocusTrap.
 *
 * Canonical source: design/src/useFocusTrap.ts
 * Copied by emit.mjs into each app's hooks/ folder.
 *
 * Usage:
 *   const ref = useFocusTrap(open)
 *   return <div ref={ref}>...</div>
 *
 * When `active` flips true: traps focus inside the ref'd element.
 * When `active` flips false (or component unmounts): releases trap, restores focus.
 */

import { useCallback, useEffect, useRef } from 'react';

import { createFocusTrap, type FocusTrap } from '../lib/focus-trap';

export function useFocusTrap(active: boolean): (node: HTMLElement | null) => void {
  const trapRef = useRef<FocusTrap | null>(null);
  const nodeRef = useRef<HTMLElement | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    nodeRef.current = node;
  }, []);

  useEffect(() => {
    if (!active) {
      if (trapRef.current) {
        trapRef.current.release();
        trapRef.current = null;
      }
      return;
    }
    const node = nodeRef.current;
    if (!node) return;
    trapRef.current = createFocusTrap(node);
    return () => {
      if (trapRef.current) {
        trapRef.current.release();
        trapRef.current = null;
      }
    };
  }, [active]);

  return ref;
}
