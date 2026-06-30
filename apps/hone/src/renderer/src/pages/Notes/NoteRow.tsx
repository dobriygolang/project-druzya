import { memo, useState } from 'react';

import type { NoteSummary } from '@features/notes/api/notesClient';
import { Icon } from '@shared/ui/primitives/Icon';

export interface NoteRowProps {
  note: NoteSummary;
  active: boolean;
  onSelect: (id: string) => void;
}

export const NoteRow = memo(function NoteRow({ note, active, onSelect }: NoteRowProps) {
  const [hover, setHover] = useState(false);
  const highlighted = active || hover;

  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 8,
        border: 'none',
        background: active
          ? 'rgb(var(--ink-rgb) / 0.1)'
          : hover
            ? 'rgb(var(--ink-rgb) / 0.06)'
            : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition:
          'background-color var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)',
        transform: hover && !active ? 'translateX(2px)' : 'none',
      }}
    >
      <span
        style={{
          color: highlighted ? 'var(--ink-80)' : 'var(--ink-40)',
          display: 'flex',
          flexShrink: 0,
          transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
        }}
      >
        <Icon name="file" size={14} strokeWidth={1.5} />
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          fontWeight: active ? 500 : 400,
          color: highlighted ? 'var(--ink)' : 'var(--ink-70)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
        }}
      >
        {note.title || 'Untitled'}
      </span>
    </button>
  );
});
