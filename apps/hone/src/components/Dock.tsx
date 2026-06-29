export type PageId = 'home' | 'today' | 'notes' | 'stats' | 'schedule' | 'settings';

const NAV: { id: PageId; label: string }[] = [
  { id: 'home', label: 'Focus' },
  { id: 'today', label: 'Today' },
  { id: 'notes', label: 'Notes' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' },
];

interface DockProps {
  page: PageId;
  onNavigate: (page: PageId) => void;
}

export function Dock({ page, onNavigate }: DockProps) {
  return (
    <nav className="dock" aria-label="Main navigation">
      {NAV.map((item) => (
        <button
          key={item.id}
          type="button"
          className={page === item.id ? 'dock-item active' : 'dock-item'}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
