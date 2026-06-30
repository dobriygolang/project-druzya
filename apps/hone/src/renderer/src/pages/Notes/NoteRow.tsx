import { memo, useEffect, useRef, useState } from 'react';
import type { Folder, NoteSummary } from '@features/notes/api/notesClient';
import { Icon } from '@shared/ui/primitives/Icon';
import { RowDropdown } from './RowDropdown';
import { formatTime } from './utils';

export interface NoteRowProps {
  note: NoteSummary;
  active: boolean;
  folders: Folder[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (noteId: string, folderId: string | null) => void;
}

export const NoteRow = memo(NoteRowImpl, (prev, next) => {
  return (
    prev.note === next.note &&
    prev.active === next.active &&
    prev.folders === next.folders &&
    prev.onSelect === next.onSelect &&
    prev.onDelete === next.onDelete &&
    prev.onMove === next.onMove
  );
});

function NoteRowImpl({ note, active, folders, onSelect, onDelete, onMove }: NoteRowProps) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const lastUpd = formatTime(note.updatedAt);

  return (
    <div
      ref={rowRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px 6px 10px',
        margin: '1px 0',
        borderRadius: 6,
        background: active
          ? 'rgb(var(--ink-rgb) / 0.07)'
          : hover
            ? 'var(--ink-tint-04)'
            : 'transparent',
        transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard)',
        cursor: 'pointer',
      }}
      onClick={() => onSelect(note.id)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: active ? 'var(--ink)' : 'var(--ink-60)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.4,
          }}
        >
          {note.title || 'Untitled'}
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-40)', marginTop: 1, lineHeight: 1.3 }}>
          {lastUpd}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((o) => !o);
        }}
        className="focus-ring"
        title="More"
        style={{
          width: 28,
          height: 28,
          display: 'grid',
          placeItems: 'center',
          background: menuOpen ? 'var(--ink-tint-08)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-60)',
          borderRadius: 5,
          opacity: hover || menuOpen ? 1 : 0,
          flexShrink: 0,
        }}
      >
        <Icon name="more" size={14} />
      </button>

      {menuOpen && (
        <RowDropdown
          folders={folders}
          currentFolderId={note.folderId}
          onDelete={() => {
            setMenuOpen(false);
            onDelete(note.id);
          }}
          onMove={(folderId) => {
            setMenuOpen(false);
            onMove(note.id, folderId);
          }}
        />
      )}
    </div>
  );
}
