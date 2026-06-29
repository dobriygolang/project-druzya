import { useCallback, useMemo } from 'react';

import {
  IdentityCard,
  PRODUCTS,
  type ProductInfo,
} from '../../../components/onboarding/IdentityCard';
import {
  resetIdentityIntroShown,
} from '../../../components/onboarding/IdentityIntroModal';
import { openCueInstall, openDruz9Web } from '../../../lib/cross-app-links';
import { HONE_EVENTS } from '../../../lib/custom-events';

// EcosystemSection — identity-discovery surface в Settings.
// Renders the same 3-card trio как IdentityIntroModal, плюс «Show intro
// again» button.
const cardsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'stretch',
};

const ctaRowStyle: React.CSSProperties = {
  marginTop: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
};

const ctaBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid var(--ink-tint-12)',
  color: 'rgb(var(--ink-rgb) / 0.7)',
  borderRadius: 5,
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const ctaHintStyle: React.CSSProperties = { fontSize: 12, color: 'var(--ink-40)', lineHeight: 1.5 };

function handleReopenIntro(): void {
  // Clear flag + dispatch event — App.tsx subscribes and opens modal без
  // полного reload (отличается от Onboarding flow, который reload'ит чтобы
  // re-trigger profile wizard).
  resetIdentityIntroShown();
  window.dispatchEvent(new CustomEvent(HONE_EVENTS.openIdentityIntro));
}

export function EcosystemSection() {
  const onOpenWeb = useCallback(() => {
    openDruz9Web();
  }, []);
  const onOpenCue = useCallback(() => {
    openCueInstall();
  }, []);
  const products = useMemo<ProductInfo[]>(
    () => [
      { ...PRODUCTS.hone, current: true },
      { ...PRODUCTS.web, onCta: onOpenWeb },
      { ...PRODUCTS.cue, onCta: onOpenCue },
    ],
    [onOpenWeb, onOpenCue],
  );
  return (
    <div>
      <div style={cardsRowStyle}>
        {products.map((p) => (
          <IdentityCard key={p.key} info={p} />
        ))}
      </div>
      <div style={ctaRowStyle}>
        <button
          type="button"
          onClick={handleReopenIntro}
          className="mono focus-ring"
          style={ctaBtnStyle}
        >
          show intro again
        </button>
        <span style={ctaHintStyle}>Re-opens the first-run identity intro modal.</span>
      </div>
    </div>
  );
}
