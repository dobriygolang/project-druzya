import { useEffect, useMemo, useRef, useState } from 'react';

import { translate } from '@d9-i18n';

import { Icon, type IconName } from './primitives/Icon';
import { trackEvent } from '../api/events';
import { zIndex } from '../lib/z-index';

export type PageId =
  | 'home'
  | 'today'
  | 'notes'
  | 'stats'
  | 'schedule'
  | 'settings';

export type PaletteAction = PageId | 'day-shutdown';

interface PaletteProps {
  onClose: () => void;
  onOpen: (id: PaletteAction) => void;
}

interface PaletteItem {
  id: string;
  label: string;
  icon: IconName;
  shortcut?: string[];
  run: () => void;
  section: string;
}

const ITEMS_BY_SECTION: { section: string; items: Omit<PaletteItem, 'run' | 'section'>[] }[] = [
  {
    section: 'Daily',
    items: [
      { id: 'today', label: 'Today', icon: 'sun', shortcut: ['T'] },
      { id: 'schedule', label: 'Schedule', icon: 'calendar', shortcut: ['Y'] },
      { id: 'stats', label: 'Stats', icon: 'bars', shortcut: ['S'] },
    ],
  },
  {
    section: 'Capture',
    items: [
      { id: 'notes', label: 'Notes', icon: 'note', shortcut: ['N'] },
      { id: 'day-shutdown', label: translate('hone.palette.day_shutdown'), icon: 'sun' },
    ],
  },
  {
    section: 'System',
    items: [{ id: 'settings', label: 'Settings', icon: 'settings', shortcut: [','] }],
  },
];

export function Palette({ onClose, onOpen }: PaletteProps) {
  const [idx, setIdx] = useState(0);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const items: PaletteItem[] = useMemo(
    () =>
      ITEMS_BY_SECTION.flatMap(({ section, items: groupItems }) =>
        groupItems.map((it) => ({
          ...it,
          section,
          run: () => onOpen(it.id as PaletteAction),
        })),
      ),
    [onOpen],
  );

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => i.label.toLowerCase().includes(s));
  }, [q, items]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setIdx(0);
  }, [q]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const it = filtered[idx];
      if (it) {
        trackEvent('palette_select', { id: it.id, source: 'keyboard' });
        it.run();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastSection: string | null = null;

  return (
    <div
      className="fadein"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: zIndex.dropdown,
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="scale-pop"
        style={{
          width: 348,
          maxWidth: '92%',
          height: 'fit-content',
          background: 'rgba(12,12,12,0.96)',
          border: '1px solid rgb(var(--ink-rgb) / 0.07)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 28px 70px -14px rgba(0,0,0,0.85)',
        }}
      >
        <div
          style={{
            padding: '9px 11px',
            display: 'grid',
            gridTemplateColumns: 'auto 1fr auto',
            gap: 7,
            alignItems: 'center',
            borderBottom: '1px solid rgb(var(--ink-rgb) / 0.05)',
          }}
        >
          <span style={{ color: 'var(--ink-40)', display: 'flex' }}>
            <Icon name="search" size={11} />
          </span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={translate('hone.palette.placeholder')}
            aria-label="Command search"
            style={{
              width: '100%',
              fontSize: 11,
              color: 'var(--ink)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
            }}
          />
          <Chip>esc</Chip>
        </div>

        <div role="listbox" aria-label="Commands" style={{ padding: '4px 0' }}>
          {filtered.map((it, i) => {
            const active = i === idx;
            const showHeader = !q.trim() && it.section !== lastSection;
            lastSection = it.section;
            return (
              <div key={it.id}>
                {showHeader && <SectionHeader>{it.section}</SectionHeader>}
                <button
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => {
                    trackEvent('palette_select', { id: it.id, source: 'click' });
                    it.run();
                    onClose();
                  }}
                  role="option"
                  aria-selected={active}
                  className="row"
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '26px 1fr auto',
                    gap: 6,
                    alignItems: 'center',
                    padding: '7px 10px',
                    background: active ? 'var(--ink-tint-06)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color var(--motion-dur-micro) var(--motion-ease-decelerate)',
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 20,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 6,
                      background: 'var(--ink-tint-04)',
                      color: active ? 'var(--ink)' : 'var(--ink-60)',
                      transition: 'color var(--motion-dur-micro) var(--motion-ease-decelerate)',
                    }}
                  >
                    <Icon name={it.icon} size={11} />
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: active ? 'var(--ink)' : 'var(--ink-90)',
                      transition: 'color var(--motion-dur-micro) var(--motion-ease-decelerate)',
                    }}
                  >
                    {it.label}
                  </span>
                  <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {(it.shortcut ?? []).map((k, ki) => (
                      <span
                        key={ki}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        {ki > 0 && (
                          <span style={{ color: 'var(--ink-40)', fontSize: 7, opacity: 0.6 }}>·</span>
                        )}
                        <Chip>{k}</Chip>
                      </span>
                    ))}
                  </span>
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ padding: '14px 11px', color: 'var(--ink-40)', fontSize: 9 }}>
              No matches.
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '7px 11px',
            borderTop: '1px solid rgb(var(--ink-rgb) / 0.05)',
            fontSize: 7,
            color: 'var(--ink-40)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Chip>↑</Chip>
            <Chip>↓</Chip> select
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Chip>↵</Chip> open
          </span>
          <span style={{ flex: 1 }} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Chip>⌘</Chip>
            <Chip>K</Chip>
          </span>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '7px 11px 3px',
        fontSize: 7,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--ink-40)',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        userSelect: 'none',
      }}
    >
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mono"
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        minWidth: 14,
        height: 14,
        padding: '0 4px',
        fontSize: 7,
        letterSpacing: '0.04em',
        color: 'var(--ink-60)',
        background: 'var(--ink-tint-04)',
        border: '1px solid var(--ink-tint-08)',
        borderRadius: 4,
      }}
    >
      {children}
    </span>
  );
}
