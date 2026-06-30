import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useT } from '@d9-i18n';

import type { NoteSummary, PublishStatus } from '@features/notes/api/notesClient';
import { getPublishStatus, isNoteVaultLocked } from '@features/notes/api/notesClient';
import { Icon } from '@shared/ui/primitives/Icon';
import { isSyncEnabled } from '@shared/sync/syncConfig';
import { isVaultReadyForPublish } from '@pages/Settings/sections/VaultSection';

import { NoteRowMenu } from './NoteRowMenu';

const MENU_W = 160;

export interface NoteRowProps {
  note: NoteSummary;
  active: boolean;
  onSelect: (id: string) => void;
  onPublish: (id: string) => Promise<PublishStatus | void>;
  onUnpublish: (id: string) => Promise<void>;
  onRegenerate: (id: string) => Promise<PublishStatus | void>;
  onDelete: (id: string) => Promise<void>;
}

export const NoteRow = memo(function NoteRow({
  note,
  active,
  onSelect,
  onPublish,
  onUnpublish,
  onRegenerate,
  onDelete,
}: NoteRowProps) {
  const t = useT();
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pubStatus, setPubStatus] = useState<PublishStatus | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  const showMore = hover || menuOpen;
  const vaultLocked = isNoteVaultLocked(note);
  const rowLabel = vaultLocked
    ? t('hone.notes.vault_locked_list')
    : note.title || t('hone.notes.untitled');

  const updateMenuPos = useCallback(() => {
    const el = moreRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.right - MENU_W });
  }, []);

  useEffect(() => {
    if (!menuOpen || !isSyncEnabled()) return;
    let live = true;
    void getPublishStatus(note.id)
      .then((s) => {
        if (live) setPubStatus(s);
      })
      .catch(() => {
        /* offline or not synced yet */
      });
    return () => {
      live = false;
    };
  }, [menuOpen, note.id]);

  useEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!rowRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onScroll = () => setMenuOpen(false);
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', updateMenuPos);
    return () => {
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', updateMenuPos);
    };
  }, [menuOpen, updateMenuPos]);

  const copyLink = useCallback(async () => {
    const url = pubStatus?.url;
    if (!url) return;
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* ignore */
    }
  }, [pubStatus?.url]);

  const viewPublic = useCallback(() => {
    const url = pubStatus?.url;
    if (!url) return;
    setMenuOpen(false);
    const open = window.hone?.shell.openExternal;
    if (open) void open(url);
    else window.open(url, '_blank', 'noopener,noreferrer');
  }, [pubStatus?.url]);

  const handlePublish = useCallback(async () => {
    setMenuOpen(false);
    try {
      const res = await onPublish(note.id);
      if (res) setPubStatus(res);
    } catch {
      /* error surfaced in NotesPage */
    }
  }, [note.id, onPublish]);

  const handleUnpublish = useCallback(async () => {
    setMenuOpen(false);
    try {
      await onUnpublish(note.id);
      setPubStatus({ published: false });
    } catch {
      /* error surfaced in NotesPage */
    }
  }, [note.id, onUnpublish]);

  const handleRegenerate = useCallback(async () => {
    setMenuOpen(false);
    try {
      const res = await onRegenerate(note.id);
      if (res) setPubStatus(res);
    } catch {
      /* error surfaced in NotesPage */
    }
  }, [note.id, onRegenerate]);

  const handleDelete = useCallback(async () => {
    setMenuOpen(false);
    try {
      await onDelete(note.id);
    } catch {
      /* error surfaced in NotesPage */
    }
  }, [note.id, onDelete]);

  return (
    <>
      <div
        ref={rowRef}
        className="hone-note-row-wrap"
        data-active={active ? 'true' : 'false'}
        data-menu-open={menuOpen ? 'true' : 'false'}
        data-vault-locked={vaultLocked ? 'true' : 'false'}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => onSelect(note.id)}
      >
        <span className="hone-note-row__icon" aria-hidden>
          <Icon name={vaultLocked ? 'lock' : 'file'} size={16} strokeWidth={1.5} />
        </span>
        <span className="hone-note-row__label">{rowLabel}</span>

        <button
          ref={moreRef}
          type="button"
          className="hone-note-row-more focus-ring"
          data-visible={showMore ? 'true' : 'false'}
          data-open={menuOpen ? 'true' : 'false'}
          aria-label={t('hone.notes.menu.more')}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
        >
          <Icon name="more" size={14} />
        </button>
      </div>

      {menuOpen &&
        menuPos &&
        createPortal(
          <NoteRowMenu
            ref={menuRef}
            published={!!pubStatus?.published}
            cloudEnabled={isSyncEnabled()}
            vaultReady={isVaultReadyForPublish()}
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: MENU_W }}
            onPublish={() => void handlePublish()}
            onCopyLink={() => void copyLink()}
            onViewPublic={viewPublic}
            onRegenerate={() => void handleRegenerate()}
            onUnpublish={() => void handleUnpublish()}
            onDelete={() => void handleDelete()}
          />,
          document.body,
        )}
    </>
  );
});
