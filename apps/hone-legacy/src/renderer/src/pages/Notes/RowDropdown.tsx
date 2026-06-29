import { useT } from '@d9-i18n';

import type { Folder } from '../../api/notesClient';
import { DropdownLabel, DropdownItem, DropdownDivider } from './Dropdown';
import { LinkIcon, UnlinkIcon, TrashIcon, FolderIcon } from './icons';

export interface RowDropdownProps {
  isLocal: boolean;
  published: boolean;
  folders: Folder[];
  currentFolderId: string | null | undefined;
  onSyncToCloud: () => void;
  onCloudToLocal: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
  onMove: (folderId: string | null) => void;
}

export function RowDropdown({ isLocal, published, folders, currentFolderId, onSyncToCloud, onCloudToLocal, onPublish, onUnpublish, onDelete, onMove }: RowDropdownProps) {
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
      {/* Phase 0.11 — explicit current-status header + symmetric
          state-switch UX. Local notes can move ↑ to cloud; cloud notes
          can publish, unpublish (back to private), or move ↓ back to
          local-only. Two clicks max for any state transition.
       */}
      {isLocal ? (
        <>
          <DropdownLabel>{t('hone.notes.row.status.local_only')}</DropdownLabel>
          <DropdownItem
            icon={<LinkIcon />}
            label={t('hone.notes.row.action.sync_to_cloud')}
            onClick={onSyncToCloud}
          />
          <DropdownDivider />
        </>
      ) : published ? (
        <>
          <DropdownLabel>{t('hone.notes.row.status.public_link')}</DropdownLabel>
          <DropdownItem
            icon={<LinkIcon />}
            label={t('hone.notes.row.action.copy_public_link')}
            onClick={onPublish}
          />
          <DropdownItem
            icon={<UnlinkIcon />}
            label={t('hone.notes.row.action.make_private')}
            onClick={onUnpublish}
          />
          <DropdownItem
            icon={<UnlinkIcon />}
            label={t('hone.notes.row.action.move_to_local')}
            onClick={onCloudToLocal}
          />
          <DropdownDivider />
        </>
      ) : (
        <>
          <DropdownLabel>{t('hone.notes.row.status.synced_to_cloud')}</DropdownLabel>
          <DropdownItem
            icon={<LinkIcon />}
            label={t('hone.notes.row.action.share_to_web')}
            onClick={onPublish}
          />
          <DropdownItem
            icon={<UnlinkIcon />}
            label={t('hone.notes.row.action.move_to_local')}
            onClick={onCloudToLocal}
          />
          <DropdownDivider />
        </>
      )}
      {folders.length > 0 && (
        <>
          <DropdownDivider />
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
        </>
      )}
      <DropdownDivider />
      <DropdownItem
        icon={<TrashIcon />}
        label={t('hone.notes.row.delete')}
        onClick={onDelete}
        danger
      />
    </div>
  );
}
