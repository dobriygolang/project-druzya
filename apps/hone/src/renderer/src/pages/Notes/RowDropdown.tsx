import { useT } from '@d9-i18n';

import type { Folder } from '@features/notes/api/notesClient';
import { DropdownLabel, DropdownItem, DropdownDivider } from './Dropdown';
import { TrashIcon, FolderIcon } from './icons';

export interface RowDropdownProps {
  folders: Folder[];
  currentFolderId: string | null | undefined;
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
}

export function RowDropdown({ folders, currentFolderId, onDelete, onMove }: RowDropdownProps) {
  const t = useT();
  return (
    <div
      className="fadein"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: 'calc(100% - 4px)',
        right: 8,
        zIndex: 30,
        minWidth: 200,
        padding: 6,
        borderRadius: 10,
        background: 'rgba(20,20,22,0.96)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid var(--ink-tint-08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animationDuration: '140ms',
      }}
    >
      {folders.length > 0 && (
        <>
          <DropdownLabel>{t('hone.notes.row.move_to_folder')}</DropdownLabel>
          {currentFolderId && (
            <DropdownItem
              icon={<FolderIcon />}
              label={t('hone.notes.row.unfiled')}
              onClick={() => onMove(null)}
            />
          )}
          {folders.map((f) => (
            <DropdownItem
              key={f.id}
              icon={<FolderIcon />}
              label={f.name}
              disabled={f.id === currentFolderId}
              onClick={() => onMove(f.id)}
            />
          ))}
          <DropdownDivider />
        </>
      )}
      <DropdownItem
        icon={<TrashIcon />}
        label={t('hone.notes.row.delete')}
        onClick={onDelete}
        danger
      />
    </div>
  );
}
