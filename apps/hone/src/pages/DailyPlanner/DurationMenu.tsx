import { useEffect, useRef } from 'react';

import { DURATION_OPTIONS, formatDuration } from './lib/dates';

interface DurationMenuProps {
  x: number;
  y: number;
  value: number;
  onPick: (min: number) => void;
  onClose: () => void;
}

export function DurationMenu({ x, y, value, onPick, onClose }: DurationMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="dp-duration-menu"
      style={{ top: y, left: x }}
      role="listbox"
      aria-label="Task duration"
    >
      {DURATION_OPTIONS.map((min) => (
        <button
          key={min}
          type="button"
          role="option"
          aria-selected={min === value}
          className={min === value ? 'dp-duration-opt active' : 'dp-duration-opt'}
          onClick={() => {
            onPick(min);
            onClose();
          }}
        >
          {formatDuration(min)}
        </button>
      ))}
    </div>
  );
}
