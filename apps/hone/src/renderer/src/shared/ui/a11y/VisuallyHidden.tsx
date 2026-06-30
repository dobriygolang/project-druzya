/**
 * VisuallyHidden — screen-reader-only text wrapper.
 *
 * Canonical source: design/src/VisuallyHidden.tsx
 * Copied by emit.mjs into each app's a11y/ folder.
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

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span style={STYLE}>{children}</span>;
}
