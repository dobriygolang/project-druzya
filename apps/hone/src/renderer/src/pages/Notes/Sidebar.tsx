import { memo } from 'react';

import { useT } from '@d9-i18n';

import { Icon } from '@shared/ui/primitives/Icon';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import type { PublishStatus } from '@features/notes/api/notesClient';
import { NoteRow } from './NoteRow';
import { type ListState } from './utils';

export interface SidebarProps {
  list: ListState;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onPublish: (id: string) => Promise<PublishStatus | void>;
  onUnpublish: (id: string) => Promise<void>;
  onRegenerate: (id: string) => Promise<PublishStatus | void>;
  onDelete: (id: string) => Promise<void>;
}

export const Sidebar = memo(function Sidebar({
  list,
  selectedId,
  onSelect,
  onCreate,
  onPublish,
  onUnpublish,
  onRegenerate,
  onDelete,
}: SidebarProps) {
  const t = useT();
  return (
    <aside className="hone-vault-sidebar">
      <div className="hone-vault-sidebar__toolbar">
        <button
          type="button"
          className="hone-vault-sidebar__btn hone-icon-btn"
          title={t('hone.notes.back')}
          onClick={() => window.dispatchEvent(new Event(HONE_EVENTS.navHome))}
        >
          <Icon name="chevron-left" size={16} strokeWidth={1.6} />
        </button>
        <span className="hone-vault-sidebar__label">{t('hone.notes.sidebar_title')}</span>
        <button
          type="button"
          className="hone-vault-sidebar__btn hone-icon-btn"
          title={t('hone.notes.new')}
          onClick={onCreate}
        >
          <Icon name="plus" size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="hone-vault-sidebar__list">
        {list.notes.map((n) => (
          <NoteRow
            key={n.id}
            note={n}
            active={selectedId === n.id}
            onSelect={onSelect}
            onPublish={onPublish}
            onUnpublish={onUnpublish}
            onRegenerate={onRegenerate}
            onDelete={onDelete}
          />
        ))}
      </div>
    </aside>
  );
});
