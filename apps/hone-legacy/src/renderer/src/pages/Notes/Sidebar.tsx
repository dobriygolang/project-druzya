import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useT } from '@d9-i18n';

import type { Folder, NoteSummary } from '../../api/notesClient';
import type { NoteMeta } from '../../api/storage';
import { QuotaUsageBar } from '../../components/QuotaUsageBar';
import { Icon } from '../../components/primitives/Icon';
import { DropdownItem } from './Dropdown';
import { FolderTreeBranch } from './FolderTree';
import { FolderIcon } from './icons';
import { NoteRow } from './NoteRow';
import { type ListState, readExpandedFolders, writeExpandedFolders } from './utils';
import { HONE_EVENTS } from '../../lib/custom-events';

// Delay before focusing the folder-name input after the inline form mounts.
// 40ms gives React time to commit the DOM and CSS-transition to start.
const FOLDER_INPUT_FOCUS_DELAY_MS = 40;

export interface SidebarProps {
  list: ListState;
  selectedId: string | null;
  metaMap: Map<string, NoteMeta>;
  folders: Folder[];
  selectedFolder: string | null | 'all';
  onSelectFolder: (id: string | null | 'all') => void;
  onCreateFolder: (name: string, parentId?: string | null) => void;
  onDeleteFolder: (id: string) => void;
  onMoveNote: (noteId: string, folderId: string | null) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
  onEncrypt: (id: string) => void;
  onUnpublish: (id: string) => void;
  onSyncToCloud: (id: string) => void;
  onCloudToLocal: (id: string) => void;
  onToggleCollapse: () => void;
}

export function NotesExpandSidebarButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="focus-ring fadein"
      title="Show sidebar"
      style={{
        position: 'absolute',
        top: 92,
        left: 10,
        width: 28,
        height: 28,
        borderRadius: 7,
        background: 'rgba(20,20,22,0.78)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--ink-tint-08)',
        cursor: 'pointer',
        color: 'var(--ink-60)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 30,
        animationDuration: 'var(--motion-dur-small)',
        transition: 'color var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--ink)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--ink-60)';
      }}
    >
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
        <path d="M12 10l2 2-2 2" />
      </svg>
    </button>
  );
}

// Sidebar memoized: keystroke в Editor (draftTitle / draftBody) НЕ должен
// триггерить re-render всех NoteRow. Memo сравнивает props по reference;
// мы стабилизируем все callbacks через useCallback в parent — иначе memo
// бесполезен. См. Notes parent: handleCreate, handleDelete, handlePublish,
// handleUnpublish, handleEncrypt — все useCallback с устойчивыми deps.
export const Sidebar = memo(SidebarImpl);

function SidebarImpl({ list, selectedId, metaMap, folders, selectedFolder, onSelectFolder, onCreateFolder, onDeleteFolder, onMoveNote, onSelect, onCreate, onDelete, onPublish, onUnpublish, onEncrypt, onSyncToCloud, onCloudToLocal, onToggleCollapse }: SidebarProps) {
  const t = useT();
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState<{ parentId: string | null } | null>(null);
  const [folderInputRef] = useState(() => ({ current: null as HTMLInputElement | null }));
  const [expanded, setExpanded] = useState<Set<string>>(() => readExpandedFolders());

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeExpandedFolders(next);
      return next;
    });
  }, []);

  // childrenByParent — карта «parent_id → folder[]». null parent = корневые
  // папки. Один проход по списку.
  //
  // Resilience: если у папки parent_id указывает на несуществующую папку
  // (orphan — может случиться при race'е delete или старом backend'е без
  // re-parent'а в DeleteFolder), её всё равно показываем — promote'им в
  // root. Без этого юзер видит «папка пропала» после удаления родителя
  // и думает, что content потерян.
  const childrenByParent = useMemo(() => {
    const m = new Map<string | null, Folder[]>();
    const idSet = new Set(folders.map((f) => f.id));
    for (const f of folders) {
      const rawParent = f.parentId ?? null;
      const k = rawParent !== null && !idSet.has(rawParent) ? null : rawParent;
      const arr = m.get(k) ?? [];
      arr.push(f);
      m.set(k, arr);
    }
    // Stable sort by name внутри каждой группы — UX consistency.
    for (const arr of m.values()) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return m;
  }, [folders]);

  // notesByFolder — карта «folder_id → notes[]» (folder_id=null для root-
  // level loose заметок). Полный объект заметок, не только count — в
  // Obsidian-tree рендерим заметки как children своей папки внутри
  // FolderTreeBranch'а.
  const notesByFolder = useMemo(() => {
    const m = new Map<string | null, NoteSummary[]>();
    for (const n of list.notes) {
      const k = n.folderId ?? null;
      const arr = m.get(k) ?? [];
      arr.push(n);
      m.set(k, arr);
    }
    // Stable sort: newest updatedAt first (как было в flat-list).
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const ta = a.updatedAt instanceof Date ? a.updatedAt.getTime() : 0;
        const tb = b.updatedAt instanceof Date ? b.updatedAt.getTime() : 0;
        return tb - ta;
      });
    }
    return m;
  }, [list.notes]);

  const notesCountByFolder = useMemo(() => {
    const m = new Map<string | null, number>();
    for (const [k, arr] of notesByFolder) {
      m.set(k, arr.length);
    }
    return m;
  }, [notesByFolder]);

  // showFlatList = selectedFolder='all' — flat-режим для быстрого обзора.
  // В flat-mode tree скрыто, рендерится плоский notes-list. В tree-mode
  // (selectedFolder=null или конкретная папка) показываем дерево.
  const showFlatList = selectedFolder === 'all';
  const visibleNotes = useMemo(() => list.notes, [list.notes]);
  return (
    <aside
      // slide-from-left анимация удалена для симметрии open/close.
      style={{
        animationDuration: '320ms',
        borderRight: '1px solid var(--ink-tint-06)',
        padding: '0 8px',
        overflowY: 'auto',
      }}
    >
      <SidebarHeader
        status={list.status}
        onCreate={onCreate}
        onCreateFolder={() => {
          // Phase 0.12 — single create entry-point. Folder action lives
          // in the header split-button now; the duplicate "+" inside the
          // Folders strip below is gone. Inline form opens at the root.
          setCreatingFolder({ parentId: null });
          window.setTimeout(() => folderInputRef.current?.focus(), FOLDER_INPUT_FOCUS_DELAY_MS);
        }}
        onToggleCollapse={onToggleCollapse}
      />

      {/* Folder tree — рендерится ВСЕГДА (даже если folders=0). Phase
          0.12 — кнопка "+ folder" перенесена в header split-button,
          здесь остаётся только заголовок + сам список. */}
      <div style={{ marginBottom: 4 }}>
          <div style={{
            padding: '4px 14px 2px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{
              flex: 1,
              fontSize: 9.5,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--ink-40)',
            }}>
              Folders
            </span>
          </div>

          {creatingFolder && creatingFolder.parentId === null && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = newFolderName.trim();
                if (name) { onCreateFolder(name, null); }
                setNewFolderName('');
                setCreatingFolder(null);
              }}
              style={{ padding: '2px 10px 4px' }}
            >
              <input
                ref={(el) => { folderInputRef.current = el; }}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onBlur={() => { setCreatingFolder(null); setNewFolderName(''); }}
                onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingFolder(null); setNewFolderName(''); } }}
                placeholder={t('hone.notes.sidebar.folder_name_placeholder')}
                style={{
                  width: '100%',
                  height: 26,
                  padding: '0 8px',
                  borderRadius: 6,
                  background: 'var(--ink-tint-06)',
                  border: '1px solid var(--ink-tint-12)',
                  color: 'var(--ink)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            </form>
          )}

          {/* Obsidian-style unified tree: каждая папка expandable, при
              expanded показывает свои subfolders + notes (folderId=this).
              Корневые loose-notes (folderId=null) рендерятся ниже tree
              как «inbox»-зона — т.е. видны всегда без раскрытия Unfiled. */}
          {!showFlatList && (
            <FolderTreeBranch
              parentId={null}
              level={0}
              childrenByParent={childrenByParent}
              notesByFolder={notesByFolder}
              notesCountByFolder={notesCountByFolder}
              expanded={expanded}
              selectedFolder={selectedFolder}
              selectedNoteId={selectedId}
              metaMap={metaMap}
              folders={folders}
              onSelectFolder={onSelectFolder}
              onToggleExpand={toggleExpanded}
              onDeleteFolder={onDeleteFolder}
              onSelectNote={onSelect}
              onDeleteNote={onDelete}
              onPublishNote={onPublish}
              onUnpublishNote={onUnpublish}
              onEncryptNote={onEncrypt}
              onSyncToCloudNote={onSyncToCloud}
              onCloudToLocalNote={onCloudToLocal}
              onMoveNote={onMoveNote}
              onCreateChild={(pid) => {
                setCreatingFolder({ parentId: pid });
                window.setTimeout(() => folderInputRef.current?.focus(), FOLDER_INPUT_FOCUS_DELAY_MS);
                if (pid && !expanded.has(pid)) toggleExpanded(pid);
              }}
              inlineCreate={
                creatingFolder && creatingFolder.parentId !== null
                  ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = newFolderName.trim();
                        const parentId = creatingFolder.parentId;
                        if (name) onCreateFolder(name, parentId);
                        setNewFolderName('');
                        setCreatingFolder(null);
                      }}
                      style={{ padding: '2px 10px 4px' }}
                    >
                      <input
                        ref={(el) => { folderInputRef.current = el; }}
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onBlur={() => { setCreatingFolder(null); setNewFolderName(''); }}
                        onKeyDown={(e) => { if (e.key === 'Escape') { setCreatingFolder(null); setNewFolderName(''); } }}
                        placeholder={t('hone.notes.sidebar.subfolder_placeholder')}
                        style={{
                          width: '100%',
                          height: 24,
                          padding: '0 8px',
                          borderRadius: 6,
                          background: 'var(--ink-tint-06)',
                          border: '1px solid var(--ink-tint-12)',
                          color: 'var(--ink)',
                          fontSize: 12,
                          outline: 'none',
                        }}
                      />
                    </form>
                  )
                  : null
              }
              inlineCreateUnderId={creatingFolder?.parentId ?? null}
            />
          )}

          <div style={{ height: 1, background: 'rgb(var(--ink-rgb) / 0.05)', margin: '6px 10px 4px' }} />
      </div>

      {/* Flat-list mode (selectedFolder='all') — все заметки одним списком
          без иерархии. Удобно для глобального поиска. */}
      {showFlatList && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, padding: '0 2px' }}>
          {visibleNotes.map((n) => {
            const meta = metaMap.get(n.id);
            return (
              <NoteRow
                key={n.id}
                note={n}
                active={selectedId === n.id}
                encrypted={meta?.encrypted ?? false}
                folders={folders}
                onSelect={onSelect}
                onDelete={onDelete}
                onPublish={onPublish}
                onUnpublish={onUnpublish}
                onEncrypt={onEncrypt}
                onSyncToCloud={onSyncToCloud}
                onCloudToLocal={onCloudToLocal}
                onMove={onMoveNote}
              />
            );
          })}
        </div>
      )}
      <div style={{ padding: '4px 6px' }}>
        <QuotaUsageBar resource="synced_notes" />
      </div>
    </aside>
  );
}

function SidebarHeader({
  status,
  onCreate,
  onCreateFolder,
  onToggleCollapse,
}: {
  status: ListState['status'];
  onCreate: () => void;
  onCreateFolder: () => void;
  onToggleCollapse: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 14px 14px',
      }}
    >
      <button
        onClick={() => {
          // SPA-навигация Hone — нет браузерной истории. App.tsx слушает
          // 'hone:nav-home' event и делает setPage('home'). Раньше тут был
          // window.history.back() который в Electron renderer no-op'ит
          // (single-page app). Теперь явно отправляем nav-home event.
          window.dispatchEvent(new Event(HONE_EVENTS.navHome));
        }}
        className="focus-ring"
        title="Back to Home"
        style={{
          background: 'transparent',
          border: 'none',
          padding: 4,
          borderRadius: 6,
          cursor: 'pointer',
          color: 'var(--ink-60)',
          display: 'inline-flex',
          alignItems: 'center',
          transition: 'color var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--ink)';
          e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--ink-60)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <Icon name="chevron-left" size={14} strokeWidth={1.6} />
      </button>
      <span
        style={{
          flex: 1,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: 'var(--ink-60)',
        }}
      >
        {status === 'loading' ? 'Notes' : status === 'error' ? 'Offline' : 'Notes'}
      </span>
      <CreateSplitButton onCreateNote={onCreate} onCreateFolder={onCreateFolder} />
      <button
        onClick={onToggleCollapse}
        className="focus-ring"
        title="Hide sidebar"
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--ink-60)',
          display: 'grid',
          placeItems: 'center',
          transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.07)';
          e.currentTarget.style.color = 'var(--ink)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--ink-60)';
        }}
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
          <path d="M14 10l-2 2 2 2" />
        </svg>
      </button>
    </div>
  );
}

// CreateSplitButton — Phase 0.12. Linear-style split button: main click
// on "+" creates a note (the 95% case); the "▾" stub opens a tiny
// popover with the second action ("New folder"). Hides the original
// duplicated "+ folder" button down in the Folders section so the
// sidebar has exactly one entry point for "create something".
function CreateSplitButton({
  onCreateNote,
  onCreateFolder,
}: {
  onCreateNote: () => void;
  onCreateFolder: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <button
        onClick={onCreateNote}
        className="focus-ring"
        title="New note (⌘N)"
        style={{
          width: 24,
          height: 26,
          borderTopLeftRadius: 7,
          borderBottomLeftRadius: 7,
          borderTopRightRadius: 0,
          borderBottomRightRadius: 0,
          background: 'transparent',
          border: 'none',
          borderRight: '1px solid var(--ink-tint-06)',
          cursor: 'pointer',
          color: 'var(--ink-60)',
          display: 'grid',
          placeItems: 'center',
          transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.07)';
          e.currentTarget.style.color = 'var(--ink)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--ink-60)';
        }}
        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.92)'; }}
        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <Icon name="plus" size={14} strokeWidth={1.8} />
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        className="focus-ring"
        title="More create options"
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 16,
          height: 26,
          borderTopRightRadius: 7,
          borderBottomRightRadius: 7,
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
          background: open ? 'rgb(var(--ink-rgb) / 0.07)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: open ? 'var(--ink)' : 'var(--ink-60)',
          display: 'grid',
          placeItems: 'center',
          transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.07)';
          e.currentTarget.style.color = 'var(--ink)';
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--ink-60)';
          }
        }}
      >
        <Icon name="chevron-down" size={9} strokeWidth={2.4} />
      </button>
      {open && (
        <div
          role="menu"
          className="fadein"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            zIndex: 30,
            minWidth: 168,
            padding: 6,
            borderRadius: 10,
            background: 'rgba(20,20,22,0.96)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid var(--ink-tint-08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            animationDuration: '120ms',
          }}
        >
          <DropdownItem
            icon={<Icon name="file" size={13} strokeWidth={1.6} />}
            label="New note"
            onClick={() => { setOpen(false); onCreateNote(); }}
          />
          <DropdownItem
            icon={<FolderIcon />}
            label="New folder"
            onClick={() => { setOpen(false); onCreateFolder(); }}
          />
        </div>
      )}
    </div>
  );
}
