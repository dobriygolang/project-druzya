import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createFolder,
  createNote,
  deleteNote,
  getNote,
  listFolders,
  listNotes,
  updateNote,
  type Folder,
  type Note,
  type NoteSummary,
} from '../../api/notesClient';
import { formatTime, INITIAL_LIST, readSidebarWidth, writeSidebarWidth, type ListState } from './utils';

const AUTOSAVE_MS = 400;

export interface NotesPageProps {
  initialNoteId?: string | null;
  onConsumeInitial?: () => void;
}

export function NotesPage({ initialNoteId, onConsumeInitial }: NotesPageProps = {}) {
  const [list, setList] = useState<ListState>(INITIAL_LIST);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialNoteId ?? null);
  const [active, setActive] = useState<Note | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarW, setSidebarW] = useState(readSidebarWidth);

  const selectedIdRef = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const draftRef = useRef({ title: '', body: '' });

  selectedIdRef.current = selectedId;
  draftRef.current = { title: draftTitle, body: draftBody };

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const { notes } = await listNotes({
        limit: 200,
        folderId: folderFilter ?? undefined,
      });
      setList({ status: 'ok', notes, error: null });
    } catch (e) {
      setList({
        status: 'error',
        notes: [],
        error: e instanceof Error ? e.message : 'Failed to load notes',
      });
    }
  }, [folderFilter]);

  const refreshFolders = useCallback(async () => {
    try {
      setFolders(await listFolders());
    } catch {
      /* non-fatal */
    }
  }, []);

  useEffect(() => {
    void refreshFolders();
  }, [refreshFolders]);

  useEffect(() => {
    setList(INITIAL_LIST);
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!initialNoteId) return;
    setSelectedId(initialNoteId);
    onConsumeInitial?.();
  }, [initialNoteId, onConsumeInitial]);

  useEffect(() => {
    if (!selectedId) {
      setActive(null);
      setDraftTitle('');
      setDraftBody('');
      setLoadError(null);
      return;
    }

    let alive = true;
    setLoadError(null);
    void getNote(selectedId)
      .then((n) => {
        if (!alive || selectedIdRef.current !== selectedId) return;
        setActive(n);
        setDraftTitle(n.title);
        setDraftBody(n.bodyMd);
      })
      .catch((e) => {
        if (!alive || selectedIdRef.current !== selectedId) return;
        setLoadError(e instanceof Error ? e.message : 'Failed to load note');
        setActive(null);
      });

    return () => {
      alive = false;
    };
  }, [selectedId]);

  const flushSave = useCallback(async (id: string, title: string, body: string) => {
    setSaveStatus('saving');
    try {
      const updated = await updateNote(id, title, body);
      if (selectedIdRef.current !== id) return;
      setActive(updated);
      setList((prev) => ({
        ...prev,
        notes: prev.notes.map((n) =>
          n.id === id
            ? { ...n, title: updated.title, updatedAt: updated.updatedAt }
            : n,
        ),
      }));
      setSaveStatus('saved');
      window.setTimeout(() => setSaveStatus('idle'), 1200);
    } catch {
      setSaveStatus('idle');
      showToast('Could not save note');
    }
  }, [showToast]);

  const scheduleSave = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const { title, body } = draftRef.current;
      void flushSave(id, title, body);
    }, AUTOSAVE_MS);
  }, [flushSave]);

  useEffect(() => {
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, []);

  useEffect(() => {
    const onBlur = () => {
      const id = selectedIdRef.current;
      if (!id) return;
      const { title, body } = draftRef.current;
      void flushSave(id, title, body);
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [flushSave]);

  const handleCreate = useCallback(async () => {
    try {
      const n = await createNote('Untitled', '', folderFilter);
      setList((prev) => ({
        status: 'ok',
        error: null,
        notes: [{ ...summaryFromNote(n) }, ...prev.notes],
      }));
      setSelectedId(n.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Create failed';
      if (msg.includes('429') || msg.toLowerCase().includes('exhausted')) {
        showToast('Cloud notes limit reached — upgrade plan');
      } else {
        showToast(msg);
      }
    }
  }, [folderFilter, showToast]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteNote(id);
      setList((prev) => ({
        ...prev,
        notes: prev.notes.filter((n) => n.id !== id),
      }));
      if (selectedIdRef.current === id) {
        setSelectedId(null);
      }
    } catch {
      showToast('Could not delete note');
    }
  }, [showToast]);

  const handleCreateFolder = useCallback(async () => {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;
    try {
      const f = await createFolder(name.trim(), folderFilter);
      setFolders((prev) => [...prev, f]);
      setFolderFilter(f.id);
    } catch {
      showToast('Could not create folder');
    }
  }, [folderFilter, showToast]);

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarW;
    let currentW = startW;
    const onMove = (ev: MouseEvent) => {
      currentW = Math.max(220, Math.min(400, startW + (ev.clientX - startX)));
      setSidebarW(currentW);
    };
    const onUp = () => {
      writeSidebarWidth(currentW);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div className="notes-page">
      <aside className="notes-sidebar" style={{ width: sidebarW }}>
        <div className="notes-sidebar-head">
          <span className="notes-sidebar-title">Notes</span>
          <button type="button" className="notes-icon-btn" onClick={() => void handleCreate()} title="New note">
            +
          </button>
        </div>

        <div className="notes-folder-row">
          <select
            className="notes-folder-select"
            value={folderFilter ?? ''}
            onChange={(e) => setFolderFilter(e.target.value || null)}
          >
            <option value="">All notes</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <button type="button" className="notes-icon-btn" onClick={() => void handleCreateFolder()} title="New folder">
            📁
          </button>
        </div>

        <div className="notes-list">
          {list.status === 'loading' && <p className="notes-muted">Loading…</p>}
          {list.status === 'error' && <p className="notes-error">{list.error}</p>}
          {list.status === 'ok' && list.notes.length === 0 && (
            <p className="notes-muted">No notes yet</p>
          )}
          {list.notes.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              selected={n.id === selectedId}
              onSelect={() => setSelectedId(n.id)}
              onDelete={() => void handleDelete(n.id)}
            />
          ))}
        </div>
      </aside>

      <div className="notes-resize" onMouseDown={onResizeStart} role="separator" aria-orientation="vertical" />

      <section className="notes-editor">
        {!selectedId && (
          <div className="notes-empty-editor">
            <p>Select a note or create one</p>
            <button type="button" className="btn-primary" onClick={() => void handleCreate()}>
              New note
            </button>
          </div>
        )}

        {selectedId && loadError && (
          <p className="notes-error">{loadError}</p>
        )}

        {selectedId && !loadError && (
          <>
            <div className="notes-editor-head">
              <span className="notes-save-status">
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : ''}
              </span>
              {active?.updatedAt && (
                <span className="notes-updated">{formatTime(active.updatedAt)}</span>
              )}
            </div>
            <input
              className="notes-title-input"
              value={draftTitle}
              placeholder="Untitled"
              onChange={(e) => {
                setDraftTitle(e.target.value);
                scheduleSave();
              }}
            />
            <textarea
              className="notes-body-input"
              value={draftBody}
              placeholder="Write in markdown…"
              onChange={(e) => {
                setDraftBody(e.target.value);
                scheduleSave();
              }}
            />
          </>
        )}
      </section>

      {toast && <div className="tb-toast" role="status">{toast}</div>}
    </div>
  );
}

function summaryFromNote(n: Note): NoteSummary {
  return {
    id: n.id,
    title: n.title,
    updatedAt: n.updatedAt,
    sizeBytes: n.sizeBytes,
    folderId: n.folderId,
  };
}

function NoteRow({
  note,
  selected,
  onSelect,
  onDelete,
}: {
  note: NoteSummary;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={selected ? 'notes-row selected' : 'notes-row'}>
      <button type="button" className="notes-row-btn" onClick={onSelect}>
        <span className="notes-row-title">{note.title || 'Untitled'}</span>
        <span className="notes-row-time">{formatTime(note.updatedAt)}</span>
      </button>
      <button type="button" className="notes-row-delete" onClick={onDelete} title="Delete">
        ×
      </button>
    </div>
  );
}
