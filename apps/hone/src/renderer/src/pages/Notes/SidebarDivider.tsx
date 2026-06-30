import { useState } from 'react';

interface NotesSidebarDividerProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function NotesSidebarDivider({ collapsed, onToggle }: NotesSidebarDividerProps): JSX.Element | null {
  const [hover, setHover] = useState(false);

  if (collapsed) return null;

  return (
    <button
      type="button"
      aria-label="Toggle notes list"
      title="Hide notes list"
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'col-resize',
        WebkitAppRegion: 'no-drag',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 1,
          transform: 'translateX(-50%)',
          background: hover ? 'rgb(var(--ink-rgb) / 0.28)' : 'rgb(var(--ink-rgb) / 0.12)',
          transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard)',
        }}
      />
    </button>
  );
}
