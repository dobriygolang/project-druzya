import { memo } from 'react';

export const VaultButton = memo(function VaultButton({
  children,
  onClick,
  disabled,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const btnStyle: React.CSSProperties = {
    padding: '7px 14px',
    fontSize: 12.5,
    background: primary ? 'var(--ink-tint-08)' : 'transparent',
    border: '1px solid var(--ink-20)',
    borderRadius: 8,
    color: 'var(--ink-90)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition:
      'background-color var(--motion-dur-small) var(--motion-ease-standard), opacity var(--motion-dur-small) var(--motion-ease-standard)',
  };

  const handleEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled) e.currentTarget.style.background = 'var(--ink-tint-12)';
  };

  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = primary ? 'var(--ink-tint-08)' : 'transparent';
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-ring"
      style={btnStyle}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
    </button>
  );
});

// B/W rule: unlocked → bright ink, locked → dim, none → ghost. Никаких
// зелёных hue'ов.
const STATE_COLOR: Record<'none' | 'locked' | 'unlocked', string> = {
  unlocked: 'rgb(var(--ink))',
  locked: 'var(--ink-60)',
  none: 'var(--ink-40)',
};

const STATE_LABEL: Record<'none' | 'locked' | 'unlocked', string> = {
  none: 'NOT SET UP',
  locked: 'LOCKED',
  unlocked: 'UNLOCKED',
};

export const VaultStatusBadge = memo(function VaultStatusBadge({
  state,
}: {
  state: 'none' | 'locked' | 'unlocked';
}) {
  const color = STATE_COLOR[state];
  const badgeStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.08em',
    padding: '4px 10px',
    borderRadius: 999,
    border: `1px solid ${color}`,
    color,
  };
  return (
    <span className="mono" style={badgeStyle}>
      {STATE_LABEL[state]}
    </span>
  );
});
