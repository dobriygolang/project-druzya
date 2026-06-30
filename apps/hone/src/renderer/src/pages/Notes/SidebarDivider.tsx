interface NotesSidebarDividerProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function NotesSidebarDivider({ collapsed, onToggle }: NotesSidebarDividerProps): JSX.Element {
  return (
    <button
      type="button"
      className="hone-notes-divider"
      aria-label="Hide notes list"
      title="Hide notes list"
      onClick={onToggle}
      style={{
        position: 'relative',
        flexShrink: 0,
        width: collapsed ? 0 : 6,
        opacity: collapsed ? 0 : 1,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: collapsed ? 'default' : 'col-resize',
        pointerEvents: collapsed ? 'none' : 'auto',
        overflow: 'hidden',
        WebkitAppRegion: 'no-drag',
      }}
    >
      <span
        className="hone-notes-divider__line"
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          bottom: 0,
          width: 1,
          transform: 'translateX(-50%)',
        }}
      />
    </button>
  );
}

/** Left-edge hit zone — expand sidebar when collapsed (Notion-style). */
export function NotesSidebarEdge({ onExpand }: { onExpand: () => void }): JSX.Element {
  return (
    <button
      type="button"
      className="hone-notes-edge"
      aria-label="Show notes list"
      title="Show notes list"
      onClick={onExpand}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 14,
        padding: 0,
        border: 'none',
        cursor: 'pointer',
        zIndex: 20,
        display: 'grid',
        placeItems: 'center',
        WebkitAppRegion: 'no-drag',
      }}
    >
      <span
        aria-hidden
        className="hone-notes-edge__handle"
        style={{
          width: 2,
          borderRadius: 99,
        }}
      />
    </button>
  );
}
