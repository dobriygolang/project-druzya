import { useCallback, useState } from 'react';

import { analytics } from '../../../lib/analytics';
import { Toggle } from '../primitives/Toggle';

// AnalyticsConsentSection — opt-in toggle.
// Reads current state from the analytics SDK (which hydrated from
// localStorage on App.tsx init), writes via setOptedIn() which mirrors
// to localStorage + best-effort backend SetConsent для cross-device sync.
const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };

const noteStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: 'var(--ink-50, rgb(var(--ink-rgb) / 0.5))',
  maxWidth: 540,
  lineHeight: 1.5,
};

export function AnalyticsConsentSection() {
  const [opted, setOpted] = useState<boolean>(() => analytics.isOptedIn());
  const handleChange = useCallback((v: boolean) => {
    setOpted(v);
    analytics.setOptedIn(v);
  }, []);
  return (
    <div style={wrapStyle}>
      <Toggle value={opted} onChange={handleChange} label="Share anonymous usage events" />
      <p style={noteStyle}>
        No PII. Tracks aggregate signals like «focus session started» so we
        can prioritise the features you actually use. Toggle off anytime —
        we drop unsent events from memory immediately.
      </p>
    </div>
  );
}
