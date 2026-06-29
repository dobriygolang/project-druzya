import React, { useEffect, useRef, useState } from 'react';
import type { Folder, NoteSummary } from '../../api/notesClient';
import { isLocalNoteId } from '../../api/localNotes';
import type { NoteMeta } from '../../api/storage';
import { Icon } from '../../components/primitives/Icon';
import { FileIcon, FolderIcon } from './icons';
import { RowDropdown } from './RowDropdown';

// NoteTreeRow — compact note-row для tree-режима. Зеркалит FolderRow по
// высоте/паддингам, отличается file-icon вместо folder-icon. Hover'ом
// показывается «···» (3-точки), клик открывает RowDropdown. Timestamp
// в tree не показываем (Obsidian-style, шум). RowDropdown переиспользуем
// чтобы не дублировать publish/encrypt/move/delete UI.
export interface NoteTreeRowProps {
  note: NoteSummary;
  active: boolean;
  encrypted: boolean;
  level: number;
  folders: Folder[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
  onEncrypt: (id: string) => void;
  onSyncToCloud: (id: string) => void;
  onCloudToLocal: (id: string) => void;
  onMove: (noteId: string, folderId: string | null) => void;
}

export function NoteTreeRow({
  note,
  active,
  encrypted,
  level,
  folders,
  onSelect,
  onDelete,
  onPublish,
  onUnpublish,
  onSyncToCloud,
  onCloudToLocal,
  onMove,
}: NoteTreeRowProps) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const isLocal = isLocalNoteId(note.id);
  const indent = level * 14;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div
      ref={rowRef}
      draggable
      onDragStart={(e) => {
        // Кладём id в две формы: typed mime для FolderRow drop-handler'а
        // и text/plain как fallback (некоторые platform'ы блочат custom mime).
        e.dataTransfer.setData('application/x-hone-note-id', note.id);
        e.dataTransfer.setData('text/plain', note.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onSelect(note.id)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: `4px 8px 4px ${14 + indent}px`,
        borderRadius: 6,
        margin: '1px 4px',
        cursor: 'pointer',
        background: active
          ? 'var(--ink-tint-08)'
          : hover
            ? 'var(--ink-tint-04)'
            : 'transparent',
        transition: 'background var(--motion-dur-small) var(--motion-ease-standard)',
      }}
    >
      {/* Caret-placeholder — для visual alignment с FolderRow chevron'ами. */}
      <span style={{ width: 14, height: 14, flexShrink: 0 }} />
      <FileIcon color={active ? 'var(--ink-60)' : 'var(--ink-40)'} />
      <span
        style={{
          flex: 1,
          fontSize: 12.5,
          color: active ? 'var(--ink-90)' : 'var(--ink-60)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
        }}
      >
        {note.title || 'Untitled'}
      </span>
      {encrypted && (
        <span
          title="Encrypted (E2E vault)"
          style={{ color: 'var(--ink-40)', fontSize: 9, lineHeight: 1, flexShrink: 0 }}
        >
          🔒
        </span>
      )}
      {hover && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          title="More"
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink-40)',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-40)')}
        >
          <Icon name="more" size={12} />
        </button>
      )}
      {menuOpen && (
        <RowDropdown
          isLocal={isLocal}
          published={false}
          folders={folders}
          currentFolderId={note.folderId ?? null}
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
          }}
          onUnpublish={() => {
            setMenuOpen(false);
            onUnpublish(note.id);
          }}
          onDelete={() => {
            setMenuOpen(false);
            onDelete(note.id);
          }}
          onMove={(folderId) => {
            setMenuOpen(false);
            onMove(note.id, folderId);
          }}
        />
      )}
    </div>
  );
}

export function FolderRow({
  label,
  count,
  active,
  level = 0,
  expandable = false,
  expanded = false,
  onToggleExpand,
  onClick,
  onDelete,
  onCreateChild,
  onDropNote,
  folderId,
}: {
  label: string;
  count: number;
  active: boolean;
  level?: number;
  expandable?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onClick: () => void;
  onDelete?: () => void;
  onCreateChild?: () => void;
  /** Drop-handler: вызывается когда юзер тащит note сюда. */
  onDropNote?: (noteId: string, folderId: string | null) => void;
  /** Folder ID для drop. null = «Unfiled» / root-level. undefined = строка-
   *  не-folder (e.g. «All Notes»), drop отключён. */
  folderId?: string | null;
}) {
  const [hover, setHover] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dropEnabled = onDropNote !== undefined && folderId !== undefined;
  // Indent — Notion-style: 14px на каждый уровень (caret-area). На level=0
  // отступ задаётся padding в SidebarImpl, иначе тут добавляем 14*level.
  const indent = level * 14;
  const bg = ((): string => {
    if (dragOver) return 'rgb(var(--ink-rgb) / 0.14)';
    if (active) return 'var(--ink-tint-08)';
    if (hover) return 'var(--ink-tint-04)';
    return 'transparent';
  })();
  return (
    <div
      role="treeitem"
      aria-selected={active}
      aria-current={active ? 'page' : undefined}
      aria-expanded={expandable ? expanded : undefined}
      aria-level={level + 1}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      onDragOver={(e) => {
        if (!dropEnabled) return;
        // dataTransfer.types в onDragOver — единственный legal способ
        // понять «я могу принять этот drop». Note row кладёт type
        // 'application/x-hone-note-id'.
        if (!e.dataTransfer.types.includes('application/x-hone-note-id')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={() => {
        if (dragOver) setDragOver(false);
      }}
      onDrop={(e) => {
        if (!dropEnabled) return;
        const noteId = e.dataTransfer.getData('application/x-hone-note-id');
        if (!noteId) return;
        e.preventDefault();
        setDragOver(false);
        onDropNote(noteId, folderId);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: `4px 8px 4px ${14 + indent}px`,
        borderRadius: 6,
        margin: '1px 4px',
        cursor: 'pointer',
        background: bg,
        outline: dragOver ? '1px solid rgb(var(--ink-rgb) / 0.3)' : 'none',
        transition: 'background var(--motion-dur-small) var(--motion-ease-standard), outline-color var(--motion-dur-small) var(--motion-ease-standard)',
      }}
    >
      {/* Caret или placeholder. Когда expandable — chevron click'ом
          раскрывает/складывает; когда нет — пустое место чтобы все ряды
          выровнялись. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (expandable && onToggleExpand) onToggleExpand();
        }}
        aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
        aria-expanded={expandable ? expanded : undefined}
        aria-hidden={!expandable}
        tabIndex={expandable ? 0 : -1}
        style={{
          width: 14,
          height: 14,
          padding: 0,
          background: 'transparent',
          border: 'none',
          cursor: expandable ? 'pointer' : 'default',
          color: 'var(--ink-40)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          transition: 'transform var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          opacity: expandable ? 1 : 0,
        }}
      >
        <Icon name="chevron-right" size={9} strokeWidth={2.4} />
      </button>
      <FolderIcon color={active ? 'var(--ink-60)' : 'var(--ink-40)'} />
      <span style={{
        flex: 1,
        fontSize: 12.5,
        color: active ? 'var(--ink-90)' : 'var(--ink-60)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
      }}>
        {label}
      </span>
      <span style={{ fontSize: 10.5, color: 'var(--ink-40)', fontVariantNumeric: 'tabular-nums', marginRight: 4 }}>
        {count}
      </span>
      {onCreateChild && hover && (
        <button
          onClick={(e) => { e.stopPropagation(); onCreateChild(); }}
          title="New subfolder"
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink-40)',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ink)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-40)')}
        >
          <Icon name="plus" size={11} strokeWidth={2} />
        </button>
      )}
      {onDelete && hover && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete folder"
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--ink-40)',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-40)')}
        >
          <Icon name="x" size={10} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

// FolderTreeBranch — рекурсивно рендерит папки + заметки уровня parentId
// (Obsidian-style). Папка expandable, заметки — листья. Каждая папка при
// expanded раскрывает себя в children-ветку рекурсивно.
//
// При parentId=null рендерим root-уровень: subfolders + loose notes
// (folderId=null) — последние видны всегда без раскрытия. На вложенном
// уровне: заметки видны только когда parent expanded (потому что branch
// рендерится только из expanded блока в самой себе).
export function FolderTreeBranch({
  parentId,
  level,
  childrenByParent,
  notesByFolder,
  notesCountByFolder,
  expanded,
  selectedFolder,
  selectedNoteId,
  metaMap,
  folders,
  onSelectFolder,
  onToggleExpand,
  onDeleteFolder,
  onCreateChild,
  onSelectNote,
  onDeleteNote,
  onPublishNote,
  onUnpublishNote,
  onEncryptNote,
  onSyncToCloudNote,
  onCloudToLocalNote,
  onMoveNote,
  inlineCreate,
  inlineCreateUnderId,
}: {
  parentId: string | null;
  level: number;
  childrenByParent: Map<string | null, Folder[]>;
  notesByFolder: Map<string | null, NoteSummary[]>;
  notesCountByFolder: Map<string | null, number>;
  expanded: Set<string>;
  selectedFolder: string | 'all' | null;
  selectedNoteId: string | null;
  metaMap: Map<string, NoteMeta>;
  folders: Folder[];
  onSelectFolder: (id: string | 'all' | null) => void;
  onToggleExpand: (id: string) => void;
  onDeleteFolder: (id: string) => void;
  onCreateChild: (parentId: string | null) => void;
  onSelectNote: (id: string) => void;
  onDeleteNote: (id: string) => void;
  onPublishNote: (id: string) => void;
  onUnpublishNote: (id: string) => void;
  onEncryptNote: (id: string) => void;
  onSyncToCloudNote: (id: string) => void;
  onCloudToLocalNote: (id: string) => void;
  onMoveNote: (noteId: string, folderId: string | null) => void;
  inlineCreate: React.ReactNode;
  inlineCreateUnderId: string | null;
}) {
  const subfolders = childrenByParent.get(parentId) ?? [];
  const notesAtLevel = notesByFolder.get(parentId) ?? [];
  return (
    <>
      {subfolders.map((f) => {
        const hasSubfolders = (childrenByParent.get(f.id)?.length ?? 0) > 0;
        const hasNotes = (notesByFolder.get(f.id)?.length ?? 0) > 0;
        const isExpandable = hasSubfolders || hasNotes;
        const isExpanded = expanded.has(f.id);
        return (
          <React.Fragment key={f.id}>
            <FolderRow
              label={f.name}
              count={notesCountByFolder.get(f.id) ?? 0}
              active={selectedFolder === f.id}
              level={level}
              expandable={isExpandable}
              expanded={isExpanded}
              onToggleExpand={() => onToggleExpand(f.id)}
              onClick={() => onSelectFolder(f.id)}
              onDelete={() => onDeleteFolder(f.id)}
              onCreateChild={() => onCreateChild(f.id)}
              onDropNote={onMoveNote}
              folderId={f.id}
            />
            {inlineCreateUnderId === f.id && inlineCreate}
            {isExpanded && (
              <FolderTreeBranch
                parentId={f.id}
                level={level + 1}
                childrenByParent={childrenByParent}
                notesByFolder={notesByFolder}
                notesCountByFolder={notesCountByFolder}
                expanded={expanded}
                selectedFolder={selectedFolder}
                selectedNoteId={selectedNoteId}
                metaMap={metaMap}
                folders={folders}
                onSelectFolder={onSelectFolder}
                onToggleExpand={onToggleExpand}
                onDeleteFolder={onDeleteFolder}
                onCreateChild={onCreateChild}
                onSelectNote={onSelectNote}
                onDeleteNote={onDeleteNote}
                onPublishNote={onPublishNote}
                onUnpublishNote={onUnpublishNote}
                onEncryptNote={onEncryptNote}
                onSyncToCloudNote={onSyncToCloudNote}
                onCloudToLocalNote={onCloudToLocalNote}
                onMoveNote={onMoveNote}
                inlineCreate={inlineCreate}
                inlineCreateUnderId={inlineCreateUnderId}
              />
            )}
          </React.Fragment>
        );
      })}
      {/* Заметки текущего уровня — compact one-line rows (NoteTreeRow),
          того же стиля что FolderRow, отличаются только icon'кой. Так
          выглядит Obsidian. NoteRow с timestamp + dropdown остался для
          flat-режима «All Notes». */}
      {notesAtLevel.map((n) => {
        const meta = metaMap.get(n.id);
        return (
          <NoteTreeRow
            key={n.id}
            note={n}
            active={selectedNoteId === n.id}
            encrypted={meta?.encrypted ?? false}
            level={parentId === null ? 0 : level + 1}
            folders={folders}
            onSelect={onSelectNote}
            onDelete={onDeleteNote}
            onPublish={onPublishNote}
            onUnpublish={onUnpublishNote}
            onEncrypt={onEncryptNote}
            onSyncToCloud={onSyncToCloudNote}
            onCloudToLocal={onCloudToLocalNote}
            onMove={onMoveNote}
          />
        );
      })}
    </>
  );
}
