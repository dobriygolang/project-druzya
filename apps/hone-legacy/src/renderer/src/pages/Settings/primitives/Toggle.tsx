import { memo, useCallback } from 'react';

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 12,
  cursor: 'pointer',
  padding: 0,
  background: 'transparent',
  border: 'none',
};

const trackOnStyle: React.CSSProperties = {
  position: 'relative',
  width: 38,
  height: 22,
  borderRadius: 999,
  background: 'rgb(var(--ink-rgb) / 0.85)',
  border: '1px solid var(--hair-2)',
  transition: 'background-color var(--t-fast)',
};

const trackOffStyle: React.CSSProperties = {
  ...trackOnStyle,
  background: 'rgb(var(--ink-rgb) / 0.1)',
};

const thumbBase: React.CSSProperties = {
  position: 'absolute',
  top: 2,
  width: 16,
  height: 16,
  borderRadius: '50%',
  transition: 'left var(--t-base), background-color var(--t-fast)',
};

const thumbOnStyle: React.CSSProperties = { ...thumbBase, left: 18, background: 'var(--bg)' };
const thumbOffStyle: React.CSSProperties = { ...thumbBase, left: 2, background: 'var(--ink)' };

const labelStyle: React.CSSProperties = { fontSize: 13, color: 'var(--ink-90)' };

export const Toggle = memo(function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (b: boolean) => void;
  label: string;
}) {
  const handleClick = useCallback(() => onChange(!value), [onChange, value]);
  return (
    <button
      onClick={handleClick}
      role="switch"
      aria-checked={value}
      aria-pressed={value}
      aria-label={label}
      className="focus-ring"
      style={btnStyle}
    >
      <span style={value ? trackOnStyle : trackOffStyle}>
        <span style={value ? thumbOnStyle : thumbOffStyle} />
      </span>
      <span style={labelStyle}>{label}</span>
    </button>
  );
});
