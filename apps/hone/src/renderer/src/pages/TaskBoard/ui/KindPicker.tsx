// KindPicker — compact 6-kind dropdown surfaced from a task chip or
// CategorizeToast «Set to…» button.
//
// UX shape: anchored popover with vertical list of {icon, label}; click =
// select + close. ESC / outside-click closes. Highlights `current` kind с
// hairline outline (без fill — B/W rule).
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties, type JSX } from 'react';

import type { TaskKind } from '@features/tasks/api/tasks';

import { ALL_KINDS, KINDS, KindIcon } from '../lib/kinds';

interface KindPickerProps {
  current: TaskKind;
  onPick: (next: TaskKind) => void;
  onClose: () => void;
  // anchor screen coords; picker positions itself так, чтобы не выходить
  // за viewport (auto-flips up/left как ContextMenu в TaskBoard).
  anchor: { x: number; y: number };
}

const VIEWPORT_PADDING = 12;

const HEADER_STYLE: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
  padding: '6px 10px 4px',
};

const CURRENT_LABEL_STYLE: CSSProperties = {
  fontSize: 9,
  color: 'var(--ink-40)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export const KindPicker = memo(function KindPicker({ current, onPick, onClose, anchor }: KindPickerProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(anchor);

  // Position-correct after mount: if popover would clip the viewport, flip.
  useEffect(() => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    let nx = anchor.x;
    let ny = anchor.y;
    if (r.right > window.innerWidth) nx = window.innerWidth - r.width - VIEWPORT_PADDING;
    if (r.bottom > window.innerHeight) ny = anchor.y - r.height - 8;
    if (nx < VIEWPORT_PADDING) nx = VIEWPORT_PADDING;
    if (ny < VIEWPORT_PADDING) ny = VIEWPORT_PADDING;
    setPos({ x: nx, y: ny });
  }, [anchor.x, anchor.y]);

  // Outside-click + ESC closes.
  useEffect(() => {
    const onClickAnywhere = (e: MouseEvent): void => {
      if (!ref.current) return;
      if (e.target instanceof Node && ref.current.contains(e.target)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    // setTimeout 0 — defer registration so the same click that opened the
    // picker doesn't immediately close it.
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onClickAnywhere);
      window.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onClickAnywhere);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const rootStyle: CSSProperties = {
    position: 'fixed',
    left: pos.x,
    top: pos.y,
    minWidth: 180,
    background: 'var(--surface-2)',
    border: '1px solid var(--ink-20)',
    borderRadius: 8,
    padding: 4,
    zIndex: 700,
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    animation: 'fadein var(--motion-dur-small) var(--motion-ease-standard)',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Pick task kind"
      onClick={stopPropagation}
      style={rootStyle}
    >
      <div style={HEADER_STYLE}>
        Set kind
      </div>
      {ALL_KINDS.map((k) => (
        <KindItem key={k} k={k} active={k === current} onPick={onPick} onClose={onClose} />
      ))}
    </div>
  );
});

const KindItem = memo(function KindItem({
  k,
  active,
  onPick,
  onClose,
}: {
  k: TaskKind;
  active: boolean;
  onPick: (next: TaskKind) => void;
  onClose: () => void;
}) {
  const def = KINDS[k];
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPick(k);
    onClose();
  }, [k, onPick, onClose]);

  const style: CSSProperties = {
    ...PICKER_ITEM_BASE,
    border: active ? '1px solid var(--ink-40)' : '1px solid transparent',
    background: active ? 'var(--ink-tint-04)' : 'transparent',
    color: active ? 'var(--ink)' : 'var(--ink-60)',
  };

  return (
    <button
      role="menuitem"
      type="button"
      onClick={handleClick}
      style={style}
    >
      <KindIcon kind={k} size={13} color={active ? def.color : 'currentColor'} />
      <span style={ITEM_LABEL_STYLE}>{def.label}</span>
      {active && (
        <span style={CURRENT_LABEL_STYLE}>
          current
        </span>
      )}
    </button>
  );
});

const ITEM_LABEL_STYLE: CSSProperties = { flex: 1 };

const PICKER_ITEM_BASE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '7px 10px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 5,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  transition:
    'background var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard)',
};
