// Notes — Obsidian-minimal vault: file list + markdown editor (local-only).
// Sidebar instant-create (⌘N), debounced autosave to localStorage.
//
import { useCallback, useEffect, useRef, useState } from 'react';

import { useT } from '@d9-i18n';

import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  publishNoteToWeb,
  unpublishNoteFromWeb,
  regeneratePublicLink,
  deleteNote,
  type Note,
  type PublishStatus,
  isNoteVaultLocked,
} from '@features/notes/api/notesClient';
import { getServerId } from '@shared/sync/idMap';
import { isVaultEnabledSync } from '@shared/crypto/vaultPrefs';
import { subscribeVault } from '@shared/crypto/vault';
import { isVaultReadyForPublish } from '@pages/Settings/sections/VaultSection';
import { isSyncEnabled } from '@shared/sync/syncConfig';
import { HONE_HEADER_H } from '@widgets/Chrome';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import {
  INITIAL_LIST,
  SIDEBAR_COLLAPSED_KEY,
  errorMessage,
  type ListState,
} from './Notes/utils';
import { Sidebar } from './Notes/Sidebar';
import { NotesSidebarDivider, NotesSidebarEdge } from '@pages/Notes/SidebarDivider';
import { Editor } from './Notes/Editor';

const SAVE_STATUS_FADE_MS = 1200;
const AUTOSAVE_DEBOUNCE_MS = 250;
const SIDEBAR_RESIZE_SETTLE_MS = 80;

export interface NotesPageProps {
  initialSelectedId?: string | null;
  onConsumeInitial?: () => void;
}

export function NotesPage({ initialSelectedId, onConsumeInitial }: NotesPageProps = {}) {
  const t = useT();
  const [list, setList] = useState<ListState>(INITIAL_LIST);
  const listRef = useRef<ListState>(INITIAL_LIST);
  listRef.current = list;
  const activeRef = useRef<Note | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [active, setActive] = useState<Note | null>(null);
  activeRef.current = active;
  selectedIdRef.current = selectedId;
  const [activeError, setActiveError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const saveTimer = useRef<number | null>(null);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  });
  const sidebarMountedRef = useRef(false);
  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!sidebarMountedRef.current) {
      sidebarMountedRef.current = true;
      return;
    }
    const t1 = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    const t2 = window.setTimeout(() => window.dispatchEvent(new Event('resize')), SIDEBAR_RESIZE_SETTLE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [sidebarCollapsed]);

  useEffect(() => {
    const onToggle = () => setSidebarCollapsed((c) => !c);
    window.addEventListener(HONE_EVENTS.toggleSidebar, onToggle as EventListener);
    return () => window.removeEventListener(HONE_EVENTS.toggleSidebar, onToggle as EventListener);
  }, []);

  useEffect(() => {
    const onOpen = (e: Event): void => {
      const noteId = (e as CustomEvent<{ noteId?: string }>).detail?.noteId;
      if (noteId) setSelectedId(noteId);
    };
    window.addEventListener(HONE_EVENTS.openNote, onOpen);
    return () => window.removeEventListener(HONE_EVENTS.openNote, onOpen);
  }, []);

  const loadList = useCallback(() => {
    void listNotes()
      .then((res) => {
        setList({ status: 'ok', notes: res.notes, error: null });
        const firstId = res.notes[0]?.id ?? null;
        if (firstId) setSelectedId((cur) => cur ?? firstId);
      })
      .catch((err: unknown) => {
        setList((prev) => {
          if (prev.status === 'ok' && prev.notes.length > 0) return prev;
          return { status: 'error', notes: [], error: errorMessage(err) };
        });
      });
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const unsub = subscribeVault(() => {
      loadList();
      const id = selectedIdRef.current;
      if (!id) return;
      void getNote(id)
        .then((n) => {
          if (selectedIdRef.current !== id) return;
          setActive(n);
          if (!isNoteVaultLocked(n)) {
            setDraftTitle(n.title);
            setDraftBody(n.bodyMd);
          }
          setActiveError(null);
        })
        .catch(() => {
          /* keep current pane */
        });
    });
    return unsub;
  }, [loadList]);

  useEffect(() => {
    const onSync = () => {
      void (async () => {
        const prevSelected = selectedIdRef.current;
        if (prevSelected) {
          const mapped = await getServerId('notes', prevSelected);
          if (mapped && mapped !== prevSelected) setSelectedId(mapped);
        }
        loadList();
      })();
    };
    window.addEventListener(HONE_EVENTS.syncChanged, onSync);
    return () => window.removeEventListener(HONE_EVENTS.syncChanged, onSync);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setActive(null);
      return;
    }
    if (activeRef.current?.id === selectedId) return;

    let cancelled = false;
    setActiveError(null);

    void getNote(selectedId)
      .then((n) => {
        if (cancelled) return;
        if (selectedIdRef.current !== selectedId) return;
        const ds = draftRef.current;
        const localDirty =
          ds.activeId === selectedId &&
          (ds.title !== n.title || ds.body !== n.bodyMd) &&
          (lastSavedRef.current.title !== ds.title || lastSavedRef.current.body !== ds.body);
        setActive(n);
        if (!localDirty && !isNoteVaultLocked(n)) {
          setDraftTitle(n.title);
          setDraftBody(n.bodyMd);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (!activeRef.current) {
          setActiveError(errorMessage(err));
          setActive(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const draftRef = useRef({ title: '', body: '', activeId: '' });
  draftRef.current = {
    title: draftTitle,
    body: draftBody,
    activeId: active?.id ?? '',
  };
  const lastSavedRef = useRef({ title: '', body: '' });
  useEffect(() => {
    if (active) lastSavedRef.current = { title: active.title, body: active.bodyMd };
  }, [active]);

  const flushNow = useCallback(async () => {
    const { activeId, title, body } = draftRef.current;
    if (!activeId) return;
    if (activeRef.current && isNoteVaultLocked(activeRef.current)) return;
    if (lastSavedRef.current.title === title && lastSavedRef.current.body === body) return;

    setSaveStatus('saving');
    try {
      const n = await updateNote(activeId, title, body);
      lastSavedRef.current = { title: n.title, body: n.bodyMd };
      setActive((cur) => (cur && cur.id === n.id ? n : cur));
      setList((prev) => ({
        ...prev,
        notes: prev.notes.map((row) =>
          row.id === activeId
            ? { ...row, title: n.title, updatedAt: n.updatedAt, sizeBytes: n.sizeBytes }
            : row,
        ),
      }));
      setSaveStatus('saved');
      window.setTimeout(() => {
        setSaveStatus((cur) => (cur === 'saved' ? 'idle' : cur));
      }, SAVE_STATUS_FADE_MS);
    } catch (err: unknown) {
      setActiveError(errorMessage(err));
      setSaveStatus('idle');
    }
  }, []);

  useEffect(() => {
    if (!active || isNoteVaultLocked(active)) return;
    if (draftTitle === active.title && draftBody === active.bodyMd) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flushNow(), AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [draftTitle, draftBody, active, flushNow]);

  useEffect(() => {
    const onBlur = () => void flushNow();
    const onBeforeUnload = () => void flushNow();
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
      void flushNow();
    };
  }, [flushNow]);

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      onConsumeInitial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = useCallback(async () => {
    await flushNow();
    try {
      const n = await createNote('Untitled', '');
      setList((prev) => ({
        ...prev,
        notes: [
          {
            id: n.id,
            title: n.title,
            updatedAt: n.updatedAt,
            sizeBytes: n.sizeBytes,
          },
          ...prev.notes,
        ],
      }));
      setSelectedId(n.id);
      setActive(n);
      setDraftTitle(n.title);
      setDraftBody(n.bodyMd);
      setActiveError(null);
    } catch (err: unknown) {
      setActiveError(errorMessage(err));
    }
  }, [flushNow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        void handleCreate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCreate]);

  const onSelectNote = useCallback(
    (id: string) => {
      void flushNow();
      setSelectedId(id);
    },
    [flushNow],
  );

  const handlePublish = useCallback(
    async (id: string): Promise<PublishStatus | void> => {
      if (!isSyncEnabled()) {
        setActiveError(t('hone.notes.menu.publish_requires_cloud'));
        return;
      }
      if (!isVaultReadyForPublish()) {
        setActiveError(t('hone.settings.vault.locked_publish'));
        return;
      }
      if (isVaultEnabledSync()) {
        const ok = window.confirm(t('hone.notes.menu.publish_e2ee_warning'));
        if (!ok) return;
      }
      try {
        if (selectedIdRef.current === id) await flushNow();
        return await publishNoteToWeb(id);
      } catch (err: unknown) {
        setActiveError(errorMessage(err));
      }
    },
    [flushNow, t],
  );

  const handleUnpublish = useCallback(
    async (id: string) => {
      if (!isSyncEnabled()) {
        setActiveError(t('hone.notes.menu.publish_requires_cloud'));
        return;
      }
      try {
        await unpublishNoteFromWeb(id);
      } catch (err: unknown) {
        setActiveError(errorMessage(err));
      }
    },
    [t],
  );

  const handleRegenerate = useCallback(
    async (id: string): Promise<PublishStatus | void> => {
      if (!isSyncEnabled()) {
        setActiveError(t('hone.notes.menu.publish_requires_cloud'));
        return;
      }
      try {
        if (selectedIdRef.current === id) await flushNow();
        return await regeneratePublicLink(id);
      } catch (err: unknown) {
        setActiveError(errorMessage(err));
      }
    },
    [flushNow, t],
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      try {
        if (selectedIdRef.current === id) await flushNow();
        await deleteNote(id);
        setList((prev) => {
          const notes = prev.notes.filter((n) => n.id !== id);
          if (selectedIdRef.current === id) {
            const next = notes[0]?.id ?? null;
            setSelectedId(next);
            if (!next) {
              setActive(null);
              setDraftTitle('');
              setDraftBody('');
            }
          }
          return { ...prev, notes };
        });
      } catch (err: unknown) {
        setActiveError(errorMessage(err));
      }
    },
    [flushNow],
  );

  const SIDEBAR_W = 252;

  return (
    <div className="hone-vault" style={{ paddingTop: HONE_HEADER_H }}>
      <aside
        className="hone-vault-sidebar-wrap"
        data-collapsed={sidebarCollapsed ? 'true' : 'false'}
        style={{ width: sidebarCollapsed ? 0 : SIDEBAR_W }}
      >
        <div className="hone-vault-sidebar-wrap__inner" style={{ width: SIDEBAR_W }}>
          <Sidebar
            list={list}
            selectedId={selectedId}
            onSelect={onSelectNote}
            onCreate={handleCreate}
            onPublish={handlePublish}
            onUnpublish={handleUnpublish}
            onRegenerate={handleRegenerate}
            onDelete={handleDeleteNote}
          />
        </div>
      </aside>

      <NotesSidebarDivider
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(true)}
      />

      <div className="hone-vault-main">
        {sidebarCollapsed && <NotesSidebarEdge onExpand={() => setSidebarCollapsed(false)} />}
        <Editor
          list={list}
          active={active}
          activeError={activeError}
          draftTitle={draftTitle}
          draftBody={draftBody}
          saveStatus={saveStatus}
          onTitleChange={setDraftTitle}
          onBodyChange={setDraftBody}
          onCreate={handleCreate}
          onRetryList={loadList}
        />
      </div>
    </div>
  );
}
