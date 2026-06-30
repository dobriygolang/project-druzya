// Chrome — top-left wordmark + top-right version (home screen).
import { memo, useEffect, useState, type CSSProperties } from 'react';

import { readAppVersion } from '@shared/lib/updater';

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

function formatVersionLabel(version: string): string {
  if (version === 'dev') return 'dev';
  return version.startsWith('v') ? version : `v${version}`;
}

const VERSION_BADGE_STYLE: CSSProperties = {
  position: 'absolute',
  top: HONE_HEADER_H,
  right: 32,
  zIndex: 10,
  pointerEvents: 'none',
};

export const AppVersionBadge = memo(function AppVersionBadge() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    void readAppVersion().then(setVersion);
  }, []);

  if (!version) return null;

  const label = formatVersionLabel(version);

  return (
    <div
      className="hone-app-version no-select mono"
      style={VERSION_BADGE_STYLE}
      aria-label={`Version ${label}`}
    >
      {label}
    </div>
  );
});
