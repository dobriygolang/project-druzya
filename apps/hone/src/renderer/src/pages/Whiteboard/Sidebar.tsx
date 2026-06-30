import { memo } from 'react';

import { useT } from '@d9-i18n';

import { Icon } from '@shared/ui/primitives/Icon';
import { HONE_EVENTS } from '@shared/lib/custom-events';

import { BoardRow } from './BoardRow';
import { type ListState } from './utils';

export interface SidebarProps {
  list: ListState;
  selectedId: string | null;
  cloudEnabled: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onShare: () => void;
  onPublish: () => void;
  onDelete: (id: string) => Promise<void>;
}

export const Sidebar = memo(function Sidebar({
  list,
  selectedId,
  cloudEnabled,
  onSelect,
  onCreate,
  onShare,
  onPublish,
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
        <span className="hone-vault-sidebar__label">{t('hone.whiteboard.sidebar_title')}</span>
        <button
          type="button"
          className="hone-vault-sidebar__btn hone-icon-btn"
          title={t('hone.whiteboard.new')}
          onClick={onCreate}
        >
          <Icon name="plus" size={16} strokeWidth={1.8} />
        </button>
      </div>

      <div className="hone-vault-sidebar__list">
        {list.boards.map((b) => (
          <BoardRow
            key={b.id}
            board={b}
            active={selectedId === b.id}
            cloudEnabled={cloudEnabled}
            onSelect={onSelect}
            onShare={onShare}
            onPublish={onPublish}
            onDelete={onDelete}
          />
        ))}
      </div>
    </aside>
  );
});
