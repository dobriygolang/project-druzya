import { forwardRef, memo } from 'react';

import { useT } from '@d9-i18n';

import { Icon } from '@shared/ui/primitives/Icon';

export interface NoteRowMenuProps {
  published: boolean;
  cloudEnabled: boolean;
  vaultReady: boolean;
  style?: React.CSSProperties;
  onPublish: () => void;
  onCopyLink: () => void;
  onViewPublic: () => void;
  onRegenerate: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="hone-note-menu__item"
      data-danger={danger ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
    >
      <span className="hone-note-menu__icon" aria-hidden>
        {icon}
      </span>
      <span className="hone-note-menu__text">{label}</span>
    </button>
  );
}

function MenuDivider() {
  return <div className="hone-note-menu__divider" role="separator" />;
}

export const NoteRowMenu = memo(
  forwardRef<HTMLDivElement, NoteRowMenuProps>(function NoteRowMenu(
    { published, cloudEnabled, vaultReady, style, onPublish, onCopyLink, onViewPublic, onRegenerate, onUnpublish, onDelete },
    ref,
  ) {
    const t = useT();

    return (
      <div
        ref={ref}
        className="hone-note-menu fadein"
        data-published={published ? 'true' : 'false'}
        style={style}
        onClick={(e) => e.stopPropagation()}
        role="menu"
      >
        <div className="hone-note-menu__label mono">{t('hone.notes.menu.publishing')}</div>
        {published ? (
          <>
            <MenuItem
              icon={<Icon name="copy" size={14} strokeWidth={1.5} />}
              label={t('hone.notes.menu.copy_link')}
              onClick={onCopyLink}
              disabled={!cloudEnabled}
            />
            <MenuItem
              icon={<Icon name="external" size={14} strokeWidth={1.5} />}
              label={t('hone.notes.menu.view_public')}
              onClick={onViewPublic}
              disabled={!cloudEnabled}
            />
            <MenuItem
              icon={<Icon name="reset" size={14} strokeWidth={1.5} />}
              label={t('hone.notes.menu.regenerate')}
              onClick={onRegenerate}
              disabled={!cloudEnabled}
            />
            <MenuItem
              icon={<Icon name="unlink" size={14} strokeWidth={1.5} />}
              label={t('hone.notes.menu.unpublish')}
              onClick={onUnpublish}
              danger
              disabled={!cloudEnabled}
            />
          </>
        ) : (
          <MenuItem
            icon={<Icon name="link" size={14} strokeWidth={1.5} />}
            label={t('hone.notes.menu.publish')}
            onClick={onPublish}
            disabled={!cloudEnabled || !vaultReady}
          />
        )}
        <MenuDivider />
        <MenuItem
          icon={<Icon name="trash" size={14} strokeWidth={1.5} />}
          label={t('hone.notes.menu.delete')}
          onClick={onDelete}
          danger
        />
      </div>
    );
  }),
);
