import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useT } from '@d9-i18n';

import type { BoardSummary } from '@features/whiteboard/api/whiteboardClient';
import { Icon } from '@shared/ui/primitives/Icon';

const MENU_W = 168;

export interface BoardRowProps {
  board: BoardSummary;
  active: boolean;
  cloudEnabled: boolean;
  onSelect: (id: string) => void;
  onShare?: () => void;
  onPublish?: () => void;
  onDelete: (id: string) => Promise<void>;
}

export const BoardRow = memo(function BoardRow({
  board,
  active,
  cloudEnabled,
  onSelect,
  onShare,
  onPublish,
  onDelete,
}: BoardRowProps) {
  const t = useT();
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);

  const showMore = hover || menuOpen;
  const rowLabel = board.title || t('hone.whiteboard.untitled');

  const updateMenuPos = useCallback(() => {
    const el = moreRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.right - MENU_W });
  }, []);

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
    const onScroll = (e: Event) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    // Use click (not mousedown) so menu item clicks register before the menu closes.
    window.addEventListener('click', onDoc);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', updateMenuPos);
    return () => {
      window.removeEventListener('click', onDoc);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', updateMenuPos);
    };
  }, [menuOpen, updateMenuPos]);

  const handleDelete = useCallback(async () => {
    setMenuOpen(false);
    try {
      await onDelete(board.id);
    } catch {
      /* surfaced in WhiteboardPage */
    }
  }, [board.id, onDelete]);

  return (
    <>
      <div
        ref={rowRef}
        className="hone-note-row-wrap"
        data-active={active ? 'true' : 'false'}
        data-menu-open={menuOpen ? 'true' : 'false'}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => onSelect(board.id)}
      >
        <span className="hone-note-row__icon" aria-hidden>
          <Icon name="grid" size={16} strokeWidth={1.5} />
        </span>
        <span className="hone-note-row__label">{rowLabel}</span>

        <button
          ref={moreRef}
          type="button"
          className="hone-note-row-more focus-ring"
          data-visible={showMore ? 'true' : 'false'}
          data-open={menuOpen ? 'true' : 'false'}
          aria-label={t('hone.whiteboard.menu.more')}
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
          <div
            ref={menuRef}
            className="hone-note-menu"
            style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: MENU_W }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            role="menu"
          >
            {cloudEnabled && active && onShare && (
              <button
                type="button"
                className="hone-note-menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  onShare();
                }}
              >
                <span className="hone-note-menu__icon" aria-hidden>
                  <Icon name="link" size={14} />
                </span>
                <span className="hone-note-menu__text">{t('hone.whiteboard.share')}</span>
              </button>
            )}
            {cloudEnabled && active && onPublish && (
              <button
                type="button"
                className="hone-note-menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  onPublish();
                }}
              >
                <span className="hone-note-menu__icon" aria-hidden>
                  <Icon name="external" size={14} />
                </span>
                <span className="hone-note-menu__text">{t('hone.whiteboard.publish')}</span>
              </button>
            )}
            {cloudEnabled && active && (onShare || onPublish) && (
              <div className="hone-note-menu__divider" role="separator" />
            )}
            <button
              type="button"
              className="hone-note-menu__item"
              data-danger="true"
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete();
              }}
            >
              <span className="hone-note-menu__icon" aria-hidden>
                <Icon name="trash" size={14} />
              </span>
              <span className="hone-note-menu__text">{t('hone.whiteboard.menu.delete')}</span>
            </button>
          </div>,
          document.body,
        )}
    </>
  );
});
