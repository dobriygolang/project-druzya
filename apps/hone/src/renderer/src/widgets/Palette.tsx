import { useEffect, useMemo, useRef, useState } from 'react';

import { translate } from '@d9-i18n';

import { Icon, type IconName } from '@shared/ui/primitives/Icon';
import { zIndex } from '@shared/lib/z-index';
import { formatWhenChip } from '@pages/TaskBoard/lib/dates';

export type PageId =
  | 'home'
  | 'today'
  | 'notes'
  | 'stats'
  | 'settings';

export type PaletteAction = PageId | 'stats';

interface PaletteProps {
  onClose: () => void;
  onOpen: (id: PaletteAction) => void;
  taskDate?: Date | null;
  onCreateTask?: (title: string, date: Date) => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: IconName;
  shortcut?: string[];
  run: () => void;
  section: string;
}

type Row =
  | { kind: 'nav'; item: NavItem; index: number }
  | { kind: 'task'; title: string; index: number };

const ITEMS_BY_SECTION: { section: string; items: Omit<NavItem, 'run' | 'section'>[] }[] = [
  {
    section: 'Daily',
    items: [
      { id: 'today', label: 'Today', icon: 'sun', shortcut: ['T'] },
      { id: 'stats', label: 'Stats', icon: 'bars', shortcut: ['S'] },
    ],
  },
  {
    section: 'Capture',
    items: [{ id: 'notes', label: 'Notes', icon: 'note', shortcut: ['N'] }],
  },
  {
    section: 'System',
    items: [{ id: 'settings', label: 'Settings', icon: 'settings', shortcut: [','] }],
  },
];

export function Palette({ onClose, onOpen, taskDate, onCreateTask }: PaletteProps) {
  const [idx, setIdx] = useState(0);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = q.trim();
  const whenDate = taskDate ?? new Date();
  const when = formatWhenChip(whenDate);

  const navItems: NavItem[] = useMemo(
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

  const filteredNav = useMemo(() => {
    const s = trimmed.toLowerCase();
    if (!s) return navItems;
    return navItems.filter((i) => i.label.toLowerCase().includes(s));
  }, [trimmed, navItems]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    let i = 0;
    for (const item of filteredNav) {
      out.push({ kind: 'nav', item, index: i++ });
    }
    if (trimmed && onCreateTask) {
      out.push({ kind: 'task', title: trimmed, index: i++ });
    }
    return out;
  }, [filteredNav, trimmed, onCreateTask]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    setIdx(0);
  }, [q]);

  const runRow = (row: Row) => {
    if (row.kind === 'nav') {
      row.item.run();
      onClose();
      return;
    }
    onCreateTask?.(row.title, whenDate);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIdx((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = rows[idx];
      if (row) runRow(row);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastSection: string | null = null;
  const showWhenChip = Boolean(trimmed || taskDate);

  return (
    <div
      className="motion-scrim-in"
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
        className="motion-modal-in"
        style={{
          width: 512,
          maxWidth: '92%',
          minHeight: 0,
          maxHeight: 'min(347px, 72vh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(12,12,12,0.96)',
          border: '1px solid rgb(var(--ink-rgb) / 0.07)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 28px 70px -14px rgba(0,0,0,0.85)',
        }}
      >
        <div
          style={{
            padding: '11px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid rgb(var(--ink-rgb) / 0.05)',
            flexShrink: 0,
          }}
        >
          <span style={{ color: 'var(--ink-40)', display: 'flex', flexShrink: 0 }}>
            <Icon name="search" size={12} />
          </span>
          {showWhenChip && (
            <span
              className="mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                borderRadius: 8,
                background: 'rgb(var(--ink-rgb) / 0.08)',
                fontSize: 10,
                color: 'var(--ink-80)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              When: {when}
            </span>
          )}
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={
              onCreateTask ? 'Type a task to create…' : translate('hone.palette.placeholder')
            }
            aria-label="Command search"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 12,
              color: 'var(--ink)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
            }}
          />
          <Chip>esc</Chip>
        </div>

        <div
          role="listbox"
          aria-label="Commands"
          style={{ padding: '4px 0', overflowY: 'auto', flex: 1, minHeight: 0 }}
        >
          {rows.map((row, i) => {
            const active = i === idx;
            if (row.kind === 'task') {
              return (
                <button
                  key="add-task"
                  type="button"
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => runRow(row)}
                  role="option"
                  aria-selected={active}
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '28px 1fr auto',
                    gap: 8,
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: active ? 'rgb(var(--ink-rgb) / 0.08)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard)',
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgb(var(--ink-rgb) / 0.1)',
                      color: 'var(--ink)',
                    }}
                  >
                    <Icon name="plus" size={12} />
                  </span>
                  <span>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                      Add task
                    </span>
                    <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: 'var(--ink-40)' }}>
                      When: {when}
                    </span>
                  </span>
                  <Chip>↵</Chip>
                </button>
              );
            }

            const it = row.item;
            const showHeader = !trimmed && it.section !== lastSection;
            lastSection = it.section;
            return (
              <div key={it.id}>
                {showHeader && <SectionHeader>{it.section}</SectionHeader>}
                <button
                  type="button"
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => runRow(row)}
                  role="option"
                  aria-selected={active}
                  className="row"
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '26px 1fr auto',
                    gap: 6,
                    alignItems: 'center',
                    padding: '8px 14px',
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
                      fontSize: 12,
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
          {rows.length === 0 && (
            <div style={{ padding: '16px 14px', color: 'var(--ink-40)', fontSize: 10 }}>
              No matches.
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderTop: '1px solid rgb(var(--ink-rgb) / 0.05)',
            fontSize: 9,
            color: 'var(--ink-40)',
            flexShrink: 0,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Select <Chip>↑</Chip>
            <Chip>↓</Chip>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            Open <Chip>↵</Chip>
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
        padding: '8px 14px 4px',
        fontSize: 8,
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
        fontSize: 8,
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
