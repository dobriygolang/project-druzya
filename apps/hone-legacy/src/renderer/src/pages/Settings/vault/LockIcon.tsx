import { memo } from 'react';

// LockIcon — компактный SVG-замочек (stroke-only, 1.6 thin).
// Используется и в explainer'е (18px), и в three-dots Notes UI (12px).
export const LockIcon = memo(function LockIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
});

const glyphWrapStyle: React.CSSProperties = {
  display: 'inline-flex',
  verticalAlign: 'middle',
  margin: '0 2px',
  color: 'var(--ink)',
};

// LockGlyph — inline-glyph для текста (нативный em-size). Внутри
// предложения «click the [icon] to encrypt» юзер видит именно тот icon
// что в Notes UI.
export const LockGlyph = memo(function LockGlyph() {
  return (
    <span style={glyphWrapStyle}>
      <LockIcon size={13} />
    </span>
  );
});
