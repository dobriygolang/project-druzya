// Chrome — persistent corner widgets.
//
//   Wordmark   — HONE top-left, always.
//   Versionmark — top-right druz9.online link. Always shown (no esc-hint
//                 variant; the hotkey-toggle pattern in App.tsx handles
//                 navigation back to home without a visible button).
//
// Wordmark uses pointerEvents: 'none' so it doesn't intercept hover events
// from the TrafficLightsHover area underneath — otherwise macOS traffic
// lights flicker when the cursor crosses the logo.
import { memo, useCallback, type CSSProperties } from 'react';

const WEB_HOST = 'druz9.online';

const WORDMARK_ROOT_STYLE: CSSProperties = {
  position: 'absolute',
  // top: 28 ставил HONE ровно под нижним краем macOS traffic-light
  // кнопок (которые сидят y≈14-28) — когда юзер hover'ил угол,
  // визуально кнопки «приклеивались» к логотипу. 48 даёт ~20px
  // breathing room ниже зоны кнопок.
  top: 48,
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

const VERSIONMARK_ROOT_STYLE = {
  position: 'absolute',
  top: 28,
  right: 32,
  zIndex: 10,
  textAlign: 'right',
  WebkitAppRegion: 'no-drag',
} as CSSProperties;

const VERSIONMARK_BTN_STYLE: CSSProperties = {
  fontSize: 10,
  color: 'var(--ink-40)',
  letterSpacing: '0.08em',
  background: 'transparent',
  padding: 0,
};

const onWebHostEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.color = 'var(--ink-90)';
};
const onWebHostLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.color = 'var(--ink-40)';
};

export const Wordmark = memo(function Wordmark() {
  return (
    <div style={WORDMARK_ROOT_STYLE} className="no-select">
      <div className="mono" style={WORDMARK_LABEL_STYLE}>
        HONE
      </div>
    </div>
  );
});

interface VersionmarkProps {
  // Kept in the prop signature for backward compatibility with App.tsx; the
  // values are intentionally unused — the button is always the web link.
  escHint?: boolean;
  onEsc?: () => void;
}

export const Versionmark = memo(function Versionmark(_: VersionmarkProps) {
  const openWebsite = useCallback(() => {
    void window.hone?.shell.openExternal(`https://${WEB_HOST}`);
  }, []);
  return (
    <div style={VERSIONMARK_ROOT_STYLE} className="no-select">
      <button
        type="button"
        onClick={openWebsite}
        className="mono focus-ring"
        style={VERSIONMARK_BTN_STYLE}
        onMouseEnter={onWebHostEnter}
        onMouseLeave={onWebHostLeave}
      >
        {WEB_HOST}
      </button>
    </div>
  );
});
