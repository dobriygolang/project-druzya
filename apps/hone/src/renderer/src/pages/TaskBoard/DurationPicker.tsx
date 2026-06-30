import { useEffect, useRef, useState } from 'react';

import { zIndex } from '@shared/lib/z-index';
import { formatDurationShort } from './lib/dates';

export const DURATION_PRESETS_MIN = [10, 15, 20, 30, 45, 60, 120, 180, 240, 360, 480] as const;

interface DurationPickerProps {
  valueMin: number;
  disabled?: boolean;
  onChange: (minutes: number) => void;
}

export function DurationPicker({ valueMin, disabled, onChange }: DurationPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
        className="mono"
        style={{
          border: 'none',
          background: open ? 'rgb(var(--ink-rgb) / 0.1)' : 'transparent',
          color: 'var(--ink-40)',
          fontSize: 10,
          padding: '2px 4px',
          borderRadius: 4,
          cursor: disabled ? 'default' : 'pointer',
          transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard)',
        }}
        onMouseEnter={(e) => {
          if (!disabled && !open) e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.06)';
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = 'transparent';
        }}
      >
        {formatDurationShort(valueMin)}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Task duration"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 72,
            padding: '4px 0',
            background: 'rgb(22 22 22 / 0.98)',
            border: '1px solid rgb(var(--ink-rgb) / 0.1)',
            borderRadius: 8,
            boxShadow: '0 12px 32px rgb(0 0 0 / 0.45)',
            zIndex: zIndex.dropdown,
          }}
        >
          {DURATION_PRESETS_MIN.map((min) => {
            const active = min === valueMin;
            return (
              <button
                key={min}
                type="button"
                role="option"
                aria-selected={active}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(min);
                  setOpen(false);
                }}
                className="mono"
                style={{
                  display: 'block',
                  width: '100%',
                  border: 'none',
                  background: active ? 'rgb(var(--ink-rgb) / 0.12)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-60)',
                  fontSize: 11,
                  textAlign: 'left',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  transition: 'background-color var(--motion-dur-micro) var(--motion-ease-standard)',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.08)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                {formatDurationShort(min)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
