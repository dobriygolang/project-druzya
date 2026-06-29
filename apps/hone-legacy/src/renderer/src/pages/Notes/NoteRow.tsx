import { memo, useEffect, useRef, useState } from 'react';
import type { Folder, NoteSummary } from '../../api/notesClient';
import { isLocalNoteId } from '../../api/localNotes';
import { getPublishStatus, type PublishStatus } from '../../api/storage';
import { Icon } from '../../components/primitives/Icon';
import { RowDropdown } from './RowDropdown';
import { formatTime } from './utils';

export interface NoteRowProps {
  note: NoteSummary;
  active: boolean;
  encrypted: boolean;
  folders: Folder[];
  // Callbacks принимают note.id внутри row — это позволяет parent'у
  // передать единый стабильный callback на все rows (вместо
  // `() => fn(n.id)` который создаёт новый identity per render и
  // ломает React.memo).
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onEncrypt: (id: string) => void;
  onSyncToCloud: (id: string) => void;
  onCloudToLocal: (id: string) => void;
  onMove: (noteId: string, folderId: string | null) => void;
}

// NoteRow memoized — на 30+ заметках без memo каждый keystroke в editor
// перерисовывал бы все rows = noticeable jank. Custom comparator: row
// re-render только при смене своих props (note reference, active flag,
// encrypted flag, callbacks).
export const NoteRow = memo(NoteRowImpl, (prev, next) => {
  return (
    prev.note === next.note &&
    prev.active === next.active &&
    prev.encrypted === next.encrypted &&
    prev.folders === next.folders &&
    prev.onSelect === next.onSelect &&
    prev.onDelete === next.onDelete &&
    prev.onPublish === next.onPublish &&
    prev.onUnpublish === next.onUnpublish &&
    prev.onEncrypt === next.onEncrypt &&
    prev.onSyncToCloud === next.onSyncToCloud &&
    prev.onCloudToLocal === next.onCloudToLocal &&
    prev.onMove === next.onMove
  );
});

function NoteRowImpl({ note, active, encrypted, folders, onSelect, onDelete, onPublish, onUnpublish, onSyncToCloud, onCloudToLocal, onMove }: NoteRowProps) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pubStatus, setPubStatus] = useState<PublishStatus | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const isLocal = isLocalNoteId(note.id);
  // Eager-load publish status on mount (not on hover как раньше). Lock-
  // icon в row отображает publish-state — должен быть правильным сразу,
  // а не только после первого hover'а. fetch идёмpotent + cached server-
  // side, дёшево.
  useEffect(() => {
    if (isLocal || pubStatus) return;
    let live = true;
    void getPublishStatus(note.id)
      .then((s) => {
        if (live) setPubStatus(s);
      })
      .catch(() => {
        /* silent — network blip → assume not published, lock-icon red */
      });
    return () => {
      live = false;
    };
  }, [pubStatus, note.id, isLocal]);

  // Close menu on outside click / Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const lastUpd = formatTime(note.updatedAt);

  return (
    <div
      ref={rowRef}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
      }}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px 6px 10px',
        margin: '1px 0',
        borderRadius: 6,
        background: active
          ? 'rgb(var(--ink-rgb) / 0.07)'
          : hover
            ? 'var(--ink-tint-04)'
            : 'transparent',
        transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard)',
        cursor: 'pointer',
      }}
      onClick={() => onSelect(note.id)}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: active ? 'var(--ink)' : 'var(--ink-60)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {/* Vault-encrypted indicator — 11px lock at title leading edge.
              Distinct from the publish/private button on the row trailing
              edge: this one is read-only and indicates body-encryption
              (vault-locked), not publish state. */}
          {encrypted && (
            <span
              title="Vault-encrypted note"
              aria-label="Vault-encrypted"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                color: 'var(--ink-60)',
                flexShrink: 0,
              }}
            >
              <Icon name="lock" size={11} strokeWidth={2} />
            </span>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {note.title || 'Untitled'}
          </span>
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: 'var(--ink-40)',
            marginTop: 1,
            lineHeight: 1.3,
          }}
        >
          {lastUpd}
        </div>
      </div>

      {/* Phase C-7 lock-icon — два режима:
            - encrypted=true → filled lock, всегда видна (badge), клик
              просто открывает note (decrypt flow в Editor'е).
            - encrypted=false → outline lock, fade-on-hover, клик →
              encrypt flow (prompt password если vault locked).
         */}
      {isLocal ? (
        // Local-only — показываем «device» badge вместо lock'а. Encrypt
        // flow не применим (vault — для cloud-нот, у local плейн в IDB).
        <span
          title="Local-only (this device)"
          style={{
            width: 22,
            height: 22,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--ink-40)',
            flexShrink: 0,
            pointerEvents: 'none',
          }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="4" width="16" height="12" rx="2" />
            <path d="M8 20h8M12 16v4" />
          </svg>
        </span>
      ) : (
        // Lock-icon = publish state.
        //   🔒 red    = private (не опубликована)  → click → publish
        //   🔓 green  = public  (опубликована)     → click → unpublish
        //
        // Раньше lock = encryption-state (encrypted vs plaintext) — юзер не
        // понимал, click locked'а ничего не делал (pointerEvents:none). Сейчас
        // lock зеркалит publish state'ом, что более intuitive: «закрыто =
        // приватно, открыто = в интернете». Encryption переехало в dropdown
        // (см. RowDropdown «Encrypt note» item).
        //
        // Animation: shackle path морфит open↔closed на 220ms. Цвет тоже
        // плавно меняется через color transition.
        (() => {
          const isPublic = !!pubStatus?.published;
          const lockColor = isPublic
            ? 'var(--ink)'      // bright ink — published (noteworthy state)
            : 'var(--ink-60)';  // dimmed ink — private (default state)
          const lockBg = isPublic
            ? 'var(--ink-tint-08)'
            : 'transparent';
          const lockBorder = isPublic
            ? 'rgb(var(--ink-rgb) / 0.22)'
            : 'rgb(var(--ink-rgb) / 0.10)';
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isPublic) {
                  onUnpublish(note.id);
                  setPubStatus({ published: false });
                } else {
                  onPublish(note.id);
                  // Optimistic flip — handlePublish сам toast'нёт результат.
                  setPubStatus({ published: true });
                }
              }}
              className="focus-ring"
              title={isPublic ? 'Public on web — click to unpublish' : 'Private — click to publish to web'}
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 28,
                height: 28,
                background: lockBg,
                border: `1px solid ${lockBorder}`,
                borderRadius: 5,
                cursor: 'pointer',
                color: lockColor,
                flexShrink: 0,
                transition:
                  'background-color var(--motion-dur-medium) var(--motion-ease-standard), border-color var(--motion-dur-medium) var(--motion-ease-standard), color var(--motion-dur-medium) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="11" width="16" height="10" rx="2" />
                {/* Animated shackle: closed (M8 11 V7 a4 4 0 0 1 8 0 v4) vs
                    open (shackle вправо). Реализовали через condional path
                    + CSS transition — браузер интерполирует morph между двумя
                    discrete path'ами как opacity-fade поскольку SVG path data
                    не animatable без SMIL. Простое решение: 2 layered paths,
                    кросс-fade opacity. */}
                <path
                  d="M8 11V7a4 4 0 0 1 8 0v4"
                  style={{
                    opacity: isPublic ? 0 : 1,
                    transition: 'opacity var(--motion-dur-medium) var(--motion-ease-standard)',
                  }}
                />
                <path
                  d="M8 11V7a4 4 0 0 1 7-2"
                  style={{
                    opacity: isPublic ? 1 : 0,
                    transition: 'opacity var(--motion-dur-medium) var(--motion-ease-standard)',
                  }}
                />
              </svg>
            </button>
          );
        })()
      )}

      {/* Three-dots — также fade-in при hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((o) => !o);
        }}
        className="focus-ring"
        title="More"
        style={{
          width: 28,
          height: 28,
          display: 'grid',
          placeItems: 'center',
          background: menuOpen ? 'var(--ink-tint-08)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-60)',
          borderRadius: 5,
          opacity: hover || menuOpen ? 1 : 0,
          transition: 'opacity var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--ink)';
          if (!menuOpen) e.currentTarget.style.background = 'var(--ink-tint-06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--ink-60)';
          if (!menuOpen) e.currentTarget.style.background = 'transparent';
        }}
      >
        <Icon name="more" size={14} />
      </button>

      {menuOpen && (
        <RowDropdown
          isLocal={isLocal}
          published={!!pubStatus?.published}
          onSyncToCloud={() => {
            setMenuOpen(false);
            onSyncToCloud(note.id);
          }}
          onCloudToLocal={() => {
            setMenuOpen(false);
            onCloudToLocal(note.id);
          }}
          onPublish={() => {
            setMenuOpen(false);
            onPublish(note.id);
            // Optimistic update: после publish меню должно сразу показывать
            // «Unpublish». Раньше pubStatus был stale до next-hover refetch'а
            // → юзер не видел unpublish-кнопки и не понимал как отозвать
            // публикацию. Setting pubStatus={published:true} на parent click
            // → drop-down ре-рендерится с unpublish item'ом сразу.
            setPubStatus({ published: true });
          }}
          onUnpublish={() => {
            setMenuOpen(false);
            onUnpublish(note.id);
            setPubStatus({ published: false });
          }}
          onDelete={() => {
            // Прямое удаление без двойного confirm — юзер просил.
            setMenuOpen(false);
            onDelete(note.id);
          }}
          folders={folders}
          currentFolderId={note.folderId}
          onMove={(folderId) => {
            setMenuOpen(false);
            onMove(note.id, folderId);
          }}
        />
      )}
    </div>
  );
}
