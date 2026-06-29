import { Icon } from '../../components/primitives/Icon';

export function LinkIcon() {
  return <Icon name="link" size={14} strokeWidth={1.6} />;
}

export function UnlinkIcon() {
  return <Icon name="unlink" size={14} strokeWidth={1.6} />;
}

export function TrashIcon() {
  return <Icon name="trash" size={14} strokeWidth={1.6} />;
}

export function FolderIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function FileIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
