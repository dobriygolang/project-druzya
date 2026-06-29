/**
 * Hone Tabs — CSS transform glide (no Framer Motion in Electron renderer).
 *
 * Foundation Tabs primitive. NEW building block — does NOT replace existing
 * tab implementations (BoardsTabsChrome, EnglishTabsChrome, TutorTabsChrome,
 * inline tabs in Listening/Coach/Stats/TaskBoard). Those migrate later.
 *
 * Contract (visual-language v2):
 *  - role=tablist + role=tab + aria-selected/aria-controls + roving tabindex
 *  - ArrowLeft/ArrowRight move focus AND selection; Home/End jump; Enter/Space activate
 *  - `underline` variant: 1.5px white underline glides between active tabs via
 *    measured-rect CSS transform (no JS animation framework). Inactive color
 *    var(--ink-60); hover var(--ink).
 *  - `segmented` variant: bordered container, active tab gets
 *    var(--ink-tint-08) bg and var(--hair-2) border.
 *  - Optional count badge: small (fontSize 10, opacity 0.6).
 */

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'segmented';
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

const SIZE_PAD: Record<NonNullable<TabsProps['size']>, { px: number; py: number; fontSize: number }> = {
  sm: { px: 10, py: 6, fontSize: 12 },
  md: { px: 14, py: 8, fontSize: 13 },
};

type Rect = { left: number; width: number };

export function Tabs({
  items,
  value,
  onChange,
  variant = 'underline',
  size = 'md',
  ariaLabel,
}: TabsProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [rect, setRect] = useState<Rect | null>(null);
  const [mounted, setMounted] = useState(false);
  const pad = SIZE_PAD[size];

  const setBtnRef = useCallback(
    (id: string) => (el: HTMLButtonElement | null) => {
      if (el) btnRefs.current.set(id, el);
      else btnRefs.current.delete(id);
    },
    [],
  );

  // Measure active button rect for underline glide.
  const measure = useCallback(() => {
    const btn = btnRefs.current.get(value);
    const container = containerRef.current;
    if (!btn || !container) return;
    const containerRect = container.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    setRect({ left: btnRect.left - containerRect.left, width: btnRect.width });
  }, [value]);

  useLayoutEffect(() => {
    measure();
  }, [measure, items.length]);

  // Re-measure on resize (window) or container resize.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => measure());
      ro.observe(containerRef.current);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect();
    };
  }, [measure]);

  // After first paint, enable transitions (avoid initial glide from 0,0).
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const focusAndActivate = useCallback(
    (id: string) => {
      onChange(id);
      const el = btnRefs.current.get(id);
      el?.focus();
    },
    [onChange],
  );

  const moveFocus = useCallback(
    (delta: 1 | -1) => {
      const enabled = items.filter((it) => !it.disabled);
      if (enabled.length === 0) return;
      const idx = enabled.findIndex((it) => it.id === value);
      const nextIdx = (idx + delta + enabled.length) % enabled.length;
      focusAndActivate(enabled[nextIdx].id);
    },
    [items, value, focusAndActivate],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveFocus(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveFocus(-1);
      } else if (e.key === 'Home') {
        const first = items.find((it) => !it.disabled);
        if (first) {
          e.preventDefault();
          focusAndActivate(first.id);
        }
      } else if (e.key === 'End') {
        const enabled = items.filter((it) => !it.disabled);
        const last = enabled[enabled.length - 1];
        if (last) {
          e.preventDefault();
          focusAndActivate(last.id);
        }
      }
    },
    [items, moveFocus, focusAndActivate],
  );

  if (variant === 'segmented') {
    return (
      <div
        ref={containerRef}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        style={{
          display: 'inline-flex',
          gap: 2,
          padding: 2,
          border: '1px solid var(--hair)',
          borderRadius: 8,
          background: 'transparent',
        }}
      >
        {items.map((it) => {
          const active = it.id === value;
          return (
            <button
              key={it.id}
              ref={setBtnRef(it.id)}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`${listId}-panel-${it.id}`}
              id={`${listId}-tab-${it.id}`}
              tabIndex={active ? 0 : -1}
              disabled={it.disabled}
              onClick={() => !it.disabled && onChange(it.id)}
              style={{
                appearance: 'none',
                border: active ? '1px solid var(--hair-2)' : '1px solid transparent',
                background: active ? 'rgb(var(--ink-rgb) / 0.08)' : 'transparent',
                color: active ? 'var(--ink)' : 'var(--ink-60)',
                padding: `${pad.py}px ${pad.px}px`,
                borderRadius: 6,
                fontSize: pad.fontSize,
                lineHeight: 1.2,
                cursor: it.disabled ? 'not-allowed' : 'pointer',
                opacity: it.disabled ? 0.4 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition:
                  'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard)',
              }}
            >
              <span>{it.label}</span>
              {typeof it.count === 'number' && (
                <span style={{ fontSize: 10, opacity: 0.6 }}>{it.count}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // underline variant
  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      style={{
        position: 'relative',
        display: 'inline-flex',
        gap: 4,
        borderBottom: '1px solid var(--hair)',
      }}
    >
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            ref={setBtnRef(it.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${listId}-panel-${it.id}`}
            id={`${listId}-tab-${it.id}`}
            tabIndex={active ? 0 : -1}
            disabled={it.disabled}
            onClick={() => !it.disabled && onChange(it.id)}
            onMouseEnter={(e) => {
              if (!active && !it.disabled) {
                e.currentTarget.style.color = 'var(--ink)';
              }
            }}
            onMouseLeave={(e) => {
              if (!active && !it.disabled) {
                e.currentTarget.style.color = 'var(--ink-60)';
              }
            }}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              color: active ? 'var(--ink)' : 'var(--ink-60)',
              padding: `${pad.py}px ${pad.px}px`,
              fontSize: pad.fontSize,
              lineHeight: 1.2,
              cursor: it.disabled ? 'not-allowed' : 'pointer',
              opacity: it.disabled ? 0.4 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
            }}
          >
            <span>{it.label}</span>
            {typeof it.count === 'number' && (
              <span style={{ fontSize: 10, opacity: 0.6 }}>{it.count}</span>
            )}
          </button>
        );
      })}
      {rect && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            bottom: -1,
            height: 1.5,
            width: rect.width,
            background: 'var(--ink)',
            transform: `translateX(${rect.left}px)`,
            transition: mounted
              ? 'transform var(--motion-dur-small) var(--motion-ease-standard), width var(--motion-dur-small) var(--motion-ease-standard)'
              : 'none',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
