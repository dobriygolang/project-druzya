// UpgradePrompt — global modal которая показывается при попадании юзером
// в quota limit. Источник message — `useQuotaStore.upgradePromptMessage`.
//
// Триггеры (calls в коде):
//   - Notes handleCreate ловит 402 от backend → showUpgradePrompt('note quota')
//   - Boards/Rooms create аналогично
//   - При попытке cross-device sync на free tier (Settings)
//
// UX: blocking modal с двумя actions — Upgrade (открывает /pricing в default

import { memo, useCallback, useState, type CSSProperties } from 'react';

import { useQuotaStore } from '../stores/quota';
import { Modal } from './primitives/Modal';
import { motion as motionTokens } from '../lib/design-tokens';

const EYEBROW_STYLE: CSSProperties = {
  position: 'relative',
  fontSize: 10,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
  marginBottom: 10,
  paddingLeft: 12,
};

const STRIPE_STYLE: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 2,
  bottom: 2,
  width: 1.5,
  background: 'var(--red)',
};

const TITLE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  color: 'var(--ink)',
  lineHeight: 1.3,
  marginBottom: 12,
};

const MESSAGE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: 13.5,
  color: 'var(--ink-60)',
  lineHeight: 1.6,
  marginBottom: 22,
};

const ACTIONS_ROW_STYLE: CSSProperties = { display: 'flex', gap: 10, justifyContent: 'flex-end' };

const CANCEL_BTN_STYLE: CSSProperties = {
  padding: '9px 16px',
  borderRadius: 8,
  background: 'transparent',
  border: '1px solid var(--hair-2)',
  color: 'var(--ink-60)',
  fontSize: 13,
  cursor: 'pointer',
  transition:
    'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
};

const UPGRADE_BTN_STYLE: CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  background: 'var(--ink)',
  color: 'var(--bg)',
  border: 'none',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition:
    'transform var(--motion-dur-small) var(--motion-ease-standard)',
};

const onCancelEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'var(--hair)';
  e.currentTarget.style.color = 'var(--ink)';
};
const onCancelLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'transparent';
  e.currentTarget.style.color = 'var(--ink-60)';
};

export const UpgradePrompt = memo(function UpgradePrompt() {
  const message = useQuotaStore((s) => s.upgradePromptMessage);
  const tier = useQuotaStore((s) => s.tier);
  const dismiss = useQuotaStore((s) => s.dismissUpgradePrompt);
  const [open, setOpen] = useState(true);

  // Smooth exit: flip open → Modal exit anim → store dismiss.
  const close = useCallback(() => {
    setOpen(false);
    window.setTimeout(dismiss, motionTokens.dur.medium);
  }, [dismiss]);

  const handleUpgrade = useCallback(() => {
    const url = 'https://druz9.online/pricing';
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (bridge) void bridge.shell.openExternal(url);
    else window.open(url, '_blank');
    close();
  }, [close]);

  if (!message) return null;

  return (
    <Modal open={open} onClose={close} size="sm">
      <div className="mono" style={EYEBROW_STYLE}>
        <span aria-hidden="true" style={STRIPE_STYLE} />
        {tier === 'free' ? 'Free tier limit' : 'Quota exceeded'}
      </div>
      <h2 style={TITLE_STYLE}>
        Time to upgrade
      </h2>
      <p style={MESSAGE_STYLE}>
        {message}
      </p>
      <div style={ACTIONS_ROW_STYLE}>
        <button
          type="button"
          onClick={close}
          style={CANCEL_BTN_STYLE}
          onMouseEnter={onCancelEnter}
          onMouseLeave={onCancelLeave}
        >
          Not now
        </button>
        <button type="button" onClick={handleUpgrade} style={UPGRADE_BTN_STYLE}>
          View plans →
        </button>
      </div>
    </Modal>
  );
});
