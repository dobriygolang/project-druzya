import { memo, useState, type ReactNode } from 'react';

import { Icon } from '@shared/ui/primitives/Icon';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import type { NoteSummary } from '@features/notes/api/notesClient';
import { NoteRow } from './NoteRow';
import { type ListState } from './utils';

export interface SidebarProps {
  list: ListState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

function SidebarIconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        background: hover ? 'rgb(var(--ink-rgb) / 0.08)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: hover ? 'var(--ink)' : 'var(--ink-60)',
        display: 'grid',
        placeItems: 'center',
        transition:
          'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
      }}
    >
      {children}
    </button>
  );
}

export const Sidebar = memo(function Sidebar({ list, selectedId, onSelect, onCreate }: SidebarProps) {
  return (
    <aside
      style={{
        padding: '8px 12px 24px',
        overflowY: 'auto',
        minHeight: 0,
        alignSelf: 'stretch',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 4px 16px',
        }}
      >
        <SidebarIconButton
          title="Back"
          onClick={() => window.dispatchEvent(new Event(HONE_EVENTS.navHome))}
        >
          <Icon name="chevron-left" size={14} strokeWidth={1.6} />
        </SidebarIconButton>
        <span
          className="mono"
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            color: 'var(--ink-60)',
          }}
        >
          NOTES
        </span>
        <SidebarIconButton title="New note" onClick={onCreate}>
          <Icon name="plus" size={14} strokeWidth={1.8} />
        </SidebarIconButton>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {list.notes.map((n) => (
          <NoteRow key={n.id} note={n} active={selectedId === n.id} onSelect={onSelect} />
        ))}
      </div>
    </aside>
  );
});

export function NotesExpandSidebarButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      className="fadein"
      title="Show notes list"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        top: 92,
        left: 10,
        width: 28,
        height: 28,
        borderRadius: 7,
        background: hover ? 'rgb(var(--ink-rgb) / 0.08)' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        color: hover ? 'var(--ink)' : 'var(--ink-60)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 30,
        transition:
          'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
      }}
    >
      <Icon name="note" size={14} />
    </button>
  );
}
