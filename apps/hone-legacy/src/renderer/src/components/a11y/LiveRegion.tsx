/**
 * LiveRegion — wraps content in an aria-live region for screen readers.
 *
 * Canonical source: design/src/LiveRegion.tsx
 * Copied by emit.mjs into each app's a11y/ folder.
 *
 * Use politeness="polite" (default) for non-critical updates (toast, status).
 * Use politeness="assertive" for important interruptions (error, warning).
 */

import { type ReactNode } from 'react';

const STYLE = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
} as const;

export interface LiveRegionProps {
  politeness?: 'polite' | 'assertive';
  atomic?: boolean;
  children: ReactNode;
}

export function LiveRegion({ politeness = 'polite', atomic = true, children }: LiveRegionProps) {
  return (
    <div role={politeness === 'assertive' ? 'alert' : 'status'} aria-live={politeness} aria-atomic={atomic} style={STYLE}>
      {children}
    </div>
  );
}
