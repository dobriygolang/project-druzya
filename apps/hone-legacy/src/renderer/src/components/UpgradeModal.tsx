// Goal: replace generic «Pro required» blocks с unified, pre-filled context
// modal showing «you tried X, Pro unlocks Y». Conversion lift expected from:
//   - Concrete frustration callout вместо generic copy
//   - Per-feature lift-stat («Pro users complete 2.3× more mock pipelines»)
//   - BYOK alternative-CTA так что power users не дропают если не хотят
//     платить — приносят свой ключ и Pro features unlock.
//
// Different from existing UpgradePrompt.tsx (which targets storage quota
// limits): this one fires когда заюзеру блокируется конкретная Pro feature
// (sync, calendar, deep analytics, etc.) и нужен structured comparison.
//
// Wiring — single global mount в App.tsx, state живёт в useQuotaStore
// через showUpgradeModal({ feature, label, benefit, liftStat? }) action.

import { useEffect, useState } from 'react';

import { useQuotaStore, type UpgradeContext } from '../stores/quota';
import { PRO_UPGRADE_URL_BASE, PRO_BYOK_URL } from '../api/config';
import { Modal } from './primitives/Modal';
import { motion as motionTokens } from '../lib/design-tokens';

// SupportedCurrency — keep in sync c frontend stripeCheckout.ts.
// Backend env vars STRIPE_PRICE_ID_PRO_{RUB,USD,EUR}.
type SupportedCurrency = 'RUB' | 'USD' | 'EUR';

// CURRENCY_DISPLAY — price labels per currency. Real Stripe price тянется
// из webhook; это placeholder для plans card UI.
const CURRENCY_DISPLAY: Record<SupportedCurrency, { symbol: string; price: string }> = {
  RUB: { symbol: '₽', price: '990₽' },
  USD: { symbol: '$', price: '$9' },
  EUR: { symbol: '€', price: '€9' },
};

// detectCurrency — best-effort из browser locale. Hone runs in Electron;
// navigator.language всё равно доступен. Default = RUB чтобы Russian
// юзеры видели родную валюту без клика.
function detectCurrency(): SupportedCurrency {
  if (typeof navigator === 'undefined') return 'RUB';
  const lang = (navigator.language || 'en').toLowerCase();
  if (lang.startsWith('ru')) return 'RUB';
  if (
    lang.startsWith('de') ||
    lang.startsWith('fr') ||
    lang.startsWith('es') ||
    lang.startsWith('it') ||
    lang.startsWith('nl') ||
    lang.startsWith('pt')
  )
    return 'EUR';
  return 'USD';
}

// Feature comparison rows — Free vs Pro. Source of truth — feedback_monetization.md.
// Each row: Free side либо «—» (not included) либо краткая «free version».
const MONO_CAPTION: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
};

const COMPARISON: Array<{ label: string; free: string; pro: string }> = [
  { label: 'Cloud-synced notes', free: '10', pro: 'Unlimited' },
  { label: 'Live code rooms / month', free: '5', pro: '30' },
  { label: 'Concurrent live rooms', free: '1', pro: '5' },
  { label: 'Code runs / day', free: '50', pro: '500' },
  { label: 'Google Calendar sync', free: '—', pro: 'Two-way' },
  { label: 'AI insights / day', free: '5', pro: '50' },
];

export function UpgradeModal() {
  const ctx = useQuotaStore((s) => s.upgradeModalContext);
  const dismiss = useQuotaStore((s) => s.dismissUpgradeModal);
  const [open, setOpen] = useState(true);

  // Smooth exit: flip open → CSS exit anim → store dismiss.
  const close = () => {
    setOpen(false);
    window.setTimeout(dismiss, motionTokens.dur.medium);
  };

  if (!ctx) return null;

  return (
    <Modal open={open} onClose={close} size="md">
      <ModalBody ctx={ctx} onClose={close} />
    </Modal>
  );
}

function ModalBody({ ctx, onClose }: { ctx: UpgradeContext; onClose: () => void }) {
  // Currency picker — auto-detect at mount, user can override.
  const [currency, setCurrency] = useState<SupportedCurrency>(detectCurrency());
  useEffect(() => {
    // Re-detect when modal re-opens (locale could've changed in Electron settings).
    setCurrency(detectCurrency());
  }, []);
  const priceDisplay = CURRENCY_DISPLAY[currency].price;

  const handleUpgrade = () => {
    const url = `${PRO_UPGRADE_URL_BASE}?source=hone&feature=${encodeURIComponent(ctx.feature)}&currency=${currency}`;
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (bridge) void bridge.shell.openExternal(url);
    else window.open(url, '_blank');
    onClose();
  };

  const handleBYOK = () => {
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (bridge) void bridge.shell.openExternal(PRO_BYOK_URL);
    else window.open(PRO_BYOK_URL, '_blank');
    onClose();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header eyebrow с red stripe (b/w + signal red rule) */}
      <div
        className="mono"
        style={{
          ...MONO_CAPTION,
          position: 'relative',
          paddingLeft: 12,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 2,
            bottom: 2,
            width: 1.5,
            background: 'var(--red)',
          }}
        />
        Unlock Pro
      </div>

      {/* Context callout — pre-filled frustration: «You tried X. Pro unlocks Y.» */}
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: 'var(--ink)',
            lineHeight: 1.3,
            marginBottom: 8,
          }}
        >
          You tried {ctx.label}.
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            color: 'var(--ink-60)',
            lineHeight: 1.6,
          }}
        >
          {ctx.benefit}
        </p>
      </div>

      {/* Pricing block */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '14px 16px',
          borderRadius: 10,
          border: '1px solid var(--hair-2)',
          background: 'var(--surface)',
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              lineHeight: 1,
            }}
          >
            {priceDisplay}
          </span>
          <span style={{ fontSize: 13, color: 'var(--ink-60)' }}>/ month</span>
          <span style={{ fontSize: 12, color: 'var(--ink-40)', marginLeft: 'auto' }}>
            cancel anytime
          </span>
        </div>
        {/* Currency picker — 3-button segmented, B/W only */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
          }}
        >
          <span
            className="mono"
            style={{
              ...MONO_CAPTION,
              marginRight: 4,
            }}
          >
            Currency
          </span>
          {(['RUB', 'USD', 'EUR'] as SupportedCurrency[]).map((c) => {
            const active = c === currency;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className="mono"
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid',
                  borderColor: active ? 'var(--ink)' : 'var(--hair-2)',
                  background: active ? 'var(--ink)' : 'transparent',
                  color: active ? 'var(--bg)' : 'var(--ink-60)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition:
                    'border-color var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lift stat (conditional) — text-secondary one-liner with red stripe */}
      {ctx.liftStat && (
        <div
          style={{
            position: 'relative',
            paddingLeft: 12,
            fontSize: 12.5,
            color: 'var(--ink-60)',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 3,
              bottom: 3,
              width: 1.5,
              background: 'var(--red)',
            }}
          />
          {ctx.liftStat}
        </div>
      )}

      {/* Feature comparison Free vs Pro */}
      <div
        style={{
          border: '1px solid var(--hair-2)',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <div
          className="mono"
          style={{
            ...MONO_CAPTION,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(80px, 1fr) minmax(80px, 1fr)',
            padding: '8px 12px',
            borderBottom: '1px solid var(--hair-2)',
            background: 'var(--surface)',
          }}
        >
          <span>Feature</span>
          <span>Free</span>
          <span style={{ color: 'var(--ink)' }}>Pro</span>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {COMPARISON.map((row, i) => (
            <li
              key={row.label}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.4fr) minmax(80px, 1fr) minmax(80px, 1fr)',
                fontSize: 12.5,
                padding: '8px 12px',
                borderTop: i === 0 ? 'none' : '1px solid var(--hair)',
                color: 'var(--ink-90)',
                lineHeight: 1.4,
                minWidth: 0,
              }}
            >
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{row.label}</span>
              <span style={{ color: 'var(--ink-60)', minWidth: 0, overflowWrap: 'anywhere' }}>
                {row.free}
              </span>
              <span style={{ color: 'var(--ink)', minWidth: 0, overflowWrap: 'anywhere' }}>
                {row.pro}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTAs — primary upgrade + BYOK alt + dismiss */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginTop: 4,
        }}
      >
        <button
          onClick={onClose}
          style={{
            padding: '9px 14px',
            background: 'transparent',
            border: 0,
            color: 'var(--ink-40)',
            fontSize: 13,
            cursor: 'pointer',
            transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink-60)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-40)')}
        >
          Maybe later
        </button>
        {ctx.byokAvailable !== false && (
          <button
            onClick={handleBYOK}
            title="Use your own API key — Pro features unlock, you cover provider cost"
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid var(--hair-2)',
              color: 'var(--ink-60)',
              fontSize: 13,
              cursor: 'pointer',
              transition:
                'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--hair)';
              e.currentTarget.style.color = 'var(--ink)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--ink-60)';
            }}
          >
            Use my own key (BYOK)
          </button>
        )}
        <button
          onClick={handleUpgrade}
          autoFocus
          style={{
            padding: '9px 18px',
            borderRadius: 8,
            background: 'var(--ink)',
            color: 'var(--bg)',
            border: 'none',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'transform var(--motion-dur-small) var(--motion-ease-standard)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          Upgrade to Pro →
        </button>
      </div>
    </div>
  );
}

// liftStats — placeholder per-feature numbers. TODO replace with real
const LIFT_STATS: Record<string, string> = {
  unlimited_mock: 'Pro users complete 2.3× more mock pipelines (placeholder)',
  long_session: 'Pro users average 47 min per Cue session vs 12 min on free (placeholder)',
  premium_persona: 'Premium personas score 35% sharper on internal eval (placeholder)',
  calendar_sync: 'Pro users schedule 4× more focus sessions (placeholder)',
  cross_device_sync: 'Pro users keep 8× more synced notes (placeholder)',
  llm_unlimited: 'Pro users hit Cerebras path 5× faster (placeholder)',
  deep_analytics: 'Pro users iterate on weak axes 2.1× faster (placeholder)',
};

// Convenience helper: emit an upgrade-modal request с stat подложенным
// автоматически на основе feature key. Trigger sites should prefer this
// over calling showUpgradeModal directly с manual liftStat — keeps the
// placeholder copy in one place.
export function requestUpgrade(ctx: Omit<UpgradeContext, 'liftStat'>): void {
  useQuotaStore.getState().showUpgradeModal({
    ...ctx,
    liftStat: LIFT_STATS[ctx.feature],
  });
}
