import { memo, useCallback } from 'react';

const wrapStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 18 };
const inputStyle: React.CSSProperties = { flex: 1, height: 4, accentColor: '#fff', cursor: 'pointer' };
const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--ink)',
  minWidth: 64,
  textAlign: 'right',
};

export const Slider = memo(function Slider({
  min,
  max,
  step,
  value,
  onChange,
  unit,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  unit: string;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(parseInt(e.target.value, 10)),
    [onChange],
  );
  return (
    <div style={wrapStyle}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleChange}
        style={inputStyle}
      />
      <span className="mono" style={labelStyle}>
        {value} {unit}
      </span>
    </div>
  );
});
