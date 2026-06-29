import React, { useState } from 'react';

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 9,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--ink-40)',
        padding: '6px 10px 4px',
      }}
    >
      {children}
    </div>
  );
}

export function DropdownItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        background: !disabled && hover ? (danger ? 'rgba(255, 59, 48, 0.10)' : 'var(--ink-tint-06)') : 'transparent',
        border: 'none',
        borderRadius: 6,
        color: ((): string => {
          if (disabled) return 'var(--ink-40)';
          if (danger) return 'var(--red)';
          if (hover) return 'var(--ink)';
          return 'var(--ink-90)';
        })(),
        fontSize: 13,
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        opacity: disabled ? 0.6 : 1,
        transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
      }}
    >
      <span style={{ display: 'inline-flex', color: 'inherit' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export function DropdownDivider() {
  return (
    <div
      style={{
        margin: '4px 6px',
        height: 1,
        background: 'var(--ink-tint-06)',
      }}
    />
  );
}
