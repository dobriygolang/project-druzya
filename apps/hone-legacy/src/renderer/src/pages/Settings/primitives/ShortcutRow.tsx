import { memo } from 'react';

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10 };
const keysStyle: React.CSSProperties = { display: 'inline-flex', gap: 4 };
const labelStyle: React.CSSProperties = { fontSize: 12.5, color: 'var(--ink-60)' };

export const ShortcutRow = memo(function ShortcutRow({
  keys,
  label,
}: {
  keys: string[];
  label: string;
}) {
  return (
    <div style={rowStyle}>
      <span style={keysStyle}>
        {keys.map((k, i) => (
          <span key={i} className="kbd mono">
            {k}
          </span>
        ))}
      </span>
      <span style={labelStyle}>{label}</span>
    </div>
  );
});
