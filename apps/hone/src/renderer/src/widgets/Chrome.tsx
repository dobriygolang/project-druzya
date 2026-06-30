// Chrome — top-left wordmark (traffic lights show on hover in that corner).
import { memo, type CSSProperties } from 'react';

export const HONE_HEADER_H = 40;

const WORDMARK_ROOT_STYLE: CSSProperties = {
  position: 'absolute',
  top: HONE_HEADER_H,
  left: 32,
  zIndex: 10,
  pointerEvents: 'none',
};

const WORDMARK_LABEL_STYLE: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '0.32em',
  color: 'var(--ink)',
  paddingBottom: 6,
  borderBottom: '1px solid var(--ink-60)',
  display: 'inline-block',
};

export const Wordmark = memo(function Wordmark() {
  return (
    <div style={WORDMARK_ROOT_STYLE} className="no-select mono">
      <div style={WORDMARK_LABEL_STYLE}>FRIENDS</div>
    </div>
  );
});
