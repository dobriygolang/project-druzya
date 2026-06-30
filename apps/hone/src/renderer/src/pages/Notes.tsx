// Notes — Notion-like two-column editor.
//
// UX (Phase C-4):
//   - "+" в sidebar: instant-create новой заметки на сервере, открывает её в
//     editor'е сразу (без модальной формы). Title начинается «Untitled»,
//     body пустой; юзер сразу пишет.
//   - Right panel — title + body, без preview/edit toggle (always-edit
//     стиль Notion). MarkdownView и /preview-режим ушли — pure WYSIWYG-ish
//     edit через RichMarkdownEditor.
//   - Three-dots на каждой row sidebar'а появляется при hover, click →
//     dropdown {Publish to web | Delete Note}. Никакой DELETE-кнопки в
//     заголовке editor'а.
//   - Last updated HH:MM:SS показывается в правом нижнем углу editor'а
//     при hover на заметку (через мышь над editor'ом).
//   - Autosave: debounced 600ms на keystroke + immediate flush на
//     blur/unmount/route-change/window-blur. Никаких «save» кнопок.
//   - Hover-эффекты: смена background на rows, accent на «+», fade на
//     three-dots. Все transitions через --t-fast (180ms).
//
import { useCallback, useEffect, useRef, useState } from 'react';

import { translate } from '@d9-i18n';
import { ConnectError, Code } from '@connectrpc/connect';

import {
  listNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  moveNote,
  listFolders,
  createFolder,
  deleteFolder,
  type Note,
  type NoteSummary,
  type Folder,
} from '@features/notes/api/notesClient';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import {
  INITIAL_LIST,
  SIDEBAR_COLLAPSED_KEY,
  SIDEBAR_DEFAULT,
  SIDEBAR_KEY,
  SIDEBAR_MAX,
  SIDEBAR_MIN,
  type ListState,
} from './Notes/utils';
import { NotesExpandSidebarButton, Sidebar } from './Notes/Sidebar';
import { Editor, ResizeHandle, Toast } from './Notes/Editor';

// Toast dismiss durations (ms). Tuned to match copy length —
// short confirmations ~2.2-2.4s, longer prompts (publish/share) 2.8s,
// error / warning toasts 3.4s.
const TOAST_DISMISS_SHORT_MS = 2200;
const TOAST_DISMISS_DEFAULT_MS = 2400;
const TOAST_DISMISS_LONG_MS = 2800;
const TOAST_DISMISS_ERROR_MS = 3400;
// Save-status indicator: how long «saved» pill stays before fading to idle.
const SAVE_STATUS_FADE_MS = 1200;
// Autosave debounce: 250ms — типичный typist 4-5 keystrokes/s, схлопывает burst в один POST.
const AUTOSAVE_DEBOUNCE_MS = 250;
// Sidebar resize: повторный resize-event через 80ms для CSS-transitions, успевших настояться.
const SIDEBAR_RESIZE_SETTLE_MS = 80;

export interface NotesPageProps {
  initialSelectedId?: string | null;
  onConsumeInitial?: () => void;
}

export function NotesPage({ initialSelectedId, onConsumeInitial }: NotesPageProps = {}) {
  const [list, setList] = useState<ListState>(INITIAL_LIST);
  // listRef — всегда указывает на свежий list. Используется callback'ами
  // (handleDelete, etc) которые НЕ должны зависеть от list в useCallback
  // deps (иначе их identity меняется на каждый list update и React.memo
  // на NoteRow становится бесполезен — все rows ре-рендерятся).
  const listRef = useRef<ListState>(INITIAL_LIST);
  listRef.current = list;
  // activeRef + selectedIdRef — для async getNote effect: проверяет «не
  // ушёл ли юзер на другую заметку пока мы fetch'или». Без этого race:
  // юзер кликает A → fetch starts → переключается на B → fetch A
  // resolves → setActive(A) поверх B = wrong note rendered.
  const activeRef = useRef<Note | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null);
  const [folders, setFolders] = useState<Folder[]>([]);
  // 'all' оставлен в типе для backwards-совместимости с handlers,
  // но default теперь null (tree-режим, root). User не должен видеть
  // pseudo-folder «All Notes» поверх настоящих папок.
  const [selectedFolder, setSelectedFolder] = useState<string | null | 'all'>(null);
  const [active, setActive] = useState<Note | null>(null);
  // Keep refs in lockstep with state for async-callback access.
  activeRef.current = active;
  selectedIdRef.current = selectedId;
  const [activeError, setActiveError] = useState<string | null>(null);
  // saveStatus — индикатор для UI: 'idle' (всё сохранено), 'saving'
  // (POST в полёте), 'saved' (только что закончили; через 1.2s → idle).
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);

  // Sidebar resize.
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

  // Global ⌘S toggle — listen `hone:toggle-sidebar` event from App.tsx.
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

  const [sidebarW, setSidebarW] = useState<number>(() => {
    if (typeof window === 'undefined') return SIDEBAR_DEFAULT;
    const raw = window.localStorage.getItem(SIDEBAR_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n)) return SIDEBAR_DEFAULT;
    return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, n));
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, String(sidebarW));
    } catch {
      /* ignore */
    }
  }, [sidebarW]);
  const dragRef = useRef<{ x: number; w: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.x;
      setSidebarW(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, dragRef.current.w + dx)));
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  // Load folders once on mount.
  useEffect(() => {
    let cancelled = false;
    listFolders()
      .then((folders) => {
        if (!cancelled) setFolders(folders);
      })
      .catch(() => {
        // Folders — secondary navigation; sidebar still functional с flat
        // list если RPC лёг. Sync poll выгребет на retry.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Initial list fetch + reactive refetch on SSE-bridged events.
  // hone:sync-changed диспатчит App.tsx когда server push приходит —
  // мы re-fetch'аем list, чтобы sidebar видел изменения с других девайсов
  // мгновенно. Игнорируем temp:id rows при merge (они не на сервере).
  useEffect(() => {
    let cancelled = false;

    const fetchList = () => {
      if (cancelled) return;

      void listNotes()
        .then((res) => {
          if (cancelled) return;
          setList((prev) => {
            const temps = prev.notes.filter((n) => n.id.startsWith('temp:'));
            const merged = [...temps, ...res.notes];
            const tempSet = new Set(temps.map((t) => t.id));
            merged.sort((a, b) => {
              if (tempSet.has(a.id) && !tempSet.has(b.id)) return -1;
              if (!tempSet.has(a.id) && tempSet.has(b.id)) return 1;
              const at = a.updatedAt?.getTime() ?? 0;
              const bt = b.updatedAt?.getTime() ?? 0;
              return at > bt ? -1 : 1;
            });
            return {
              status: 'ok',
              notes: merged,
              error: null,
              errorCode: null,
            };
          });
          const firstId = res.notes[0]?.id ?? null;
          if (firstId) setSelectedId((cur) => cur ?? firstId);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const ce = ConnectError.from(err);
          // На последующих refresh'ах (sync-bridged) не валим в error если
          // у нас УЖЕ есть list — оставляем что было.
          setList((prev) => {
            if (prev.status === 'ok' && prev.notes.length > 0) return prev;
            return {
              status: 'error',
              notes: [],
              error: ce.rawMessage || ce.message,
              errorCode: ce.code,
            };
          });
        });
    };

    fetchList();
    const onSync = () => fetchList();
    window.addEventListener(HONE_EVENTS.syncChanged, onSync);
    return () => {
      cancelled = true;
      window.removeEventListener(HONE_EVENTS.syncChanged, onSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load active note on selection change.
  useEffect(() => {
    if (!selectedId) {
      setActive(null);
      return;
    }
    if (selectedId.startsWith('temp:')) return;
    if (activeRef.current?.id === selectedId) return;

    let cancelled = false;
    setActiveError(null);

    getNote(selectedId)
      .then((n) => {
        if (cancelled) return;
        if (selectedIdRef.current !== selectedId) return;
        // Если у нас есть локальные unsaved changes (lastSavedRef !==
        // current draft), НЕ переписываем draft — иначе потеряем юзеровский
        // ввод. Active мета-инфо обновляем (title/updated_at в sidebar
        // remains accurate).
        const ds = draftRef.current;
        const localDirty = ds.activeId === selectedId &&
          (ds.title !== n.title || ds.body !== n.bodyMd) &&
          (lastSavedRef.current.title !== ds.title || lastSavedRef.current.body !== ds.body);
        setActive(n);
        if (!localDirty) {
          setDraftTitle(n.title);
          setDraftBody(n.bodyMd);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const ce = ConnectError.from(err);
        // Если уже есть cached active — не сбрасываем UI, только log.
        if (!activeRef.current) {
          setActiveError(ce.rawMessage || ce.message);
          setActive(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // ─── Persistence ────────────────────────────────────────────────────────

  // We keep the latest draft in a ref so flushNow() reads the current value
  // даже когда вызывается из beforeunload / unmount (closure-captured state
  // там устарел).
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
    // Optimistic create в полёте: temp-id не существует на сервере,
    // updateNote 404'нет. Пропускаем — flush сработает при следующем
    // edit'е когда id будет уже real (handleCreate подменит после
    // successful POST).
    if (activeId.startsWith('temp:')) return;
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
      const ce = ConnectError.from(err);
      setActiveError(ce.rawMessage || ce.message);
      setSaveStatus('idle');
    }
  }, []);

  // Debounced autosave on keystroke. 250ms — quick «saved» feedback
  // без забивания сети (типичный typist 4-5 keystroke/s, debounce
  // схлопывает burst в один POST).
  useEffect(() => {
    if (!active) return;
    if (draftTitle === active.title && draftBody === active.bodyMd) return;
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void flushNow(), AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    };
  }, [draftTitle, draftBody, active, flushNow]);

  // Immediate flush on window blur (alt-tab) и beforeunload (close/reload).
  useEffect(() => {
    const onBlur = () => void flushNow();
    const onBeforeUnload = () => {
      // Best-effort sync save через keepalive — fetch'и в beforeunload
      // обрезаются браузером, но updateNote проходит через Connect и
      // обычно успевает на ~50ms. Не идеально, но приемлемо для MVP.
      void flushNow();
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('beforeunload', onBeforeUnload);
      // Финальный flush на unmount (route-change Notes → Today).
      void flushNow();
    };
  }, [flushNow]);

  // Single-shot consume initialSelectedId on mount.
  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
      onConsumeInitial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⌘N create note.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // ─── Actions ────────────────────────────────────────────────────────────

  // Optimistic create: instant feedback. Flow:
  //   1. Generate temp-id, добавляем фейковую row в list немедленно,
  //      переключаем selectedId на неё → юзер уже видит редактор.
  //   2. flushNow() в фоне (если был активный редактор).
  //   3. createNote() в фоне; на успех — заменяем temp-id на real,
  //      перенаправляем selectedId; на ошибку — удаляем фейк + toast.
  //
  // Trick: temp-id формата `temp:<uuid>` — Connect-RPC signature
  // принимает любую string на client'е, на server'е id GENERATES сам.
  // Local в IndexedDB не пишем (это origin only — не sync до того как
  // server присвоил постоянный id, иначе rebuild сломается).
  const handleCreate = useCallback(async () => {
    void flushNow();

    const tempId = `temp:${crypto.randomUUID()}`;
    const now = new Date();
    const tempNote: NoteSummary = {
      id: tempId,
      title: 'Untitled',
      sizeBytes: 0,
      updatedAt: now,
      folderId: null,
    };
    // Optimistic UI:
    setList((prev) => ({ ...prev, notes: [tempNote, ...prev.notes] }));
    setSelectedId(tempId);
    // Затравочный draft — Editor покажет пустое поле для немедленного
    // ввода. Когда придёт server-id, мы пере-select'нем и effect загрузит
    // (пустое) тело без flicker'а.
    setActive({
      id: tempId,
      title: 'Untitled',
      bodyMd: '',
      sizeBytes: 0,
      createdAt: now,
      updatedAt: now,
    } as Note);
    setDraftTitle('Untitled');
    setDraftBody('');

    try {
      const n = await createNote('Untitled', '');
      // Replace temp-row with real one, swap selectedId.
      setList((prev) => ({
        ...prev,
        notes: prev.notes.map((row) =>
          row.id === tempId
            ? { id: n.id, title: n.title, updatedAt: n.updatedAt, sizeBytes: n.sizeBytes, folderId: n.folderId }
            : row,
        ),
      }));
      setSelectedId((cur) => (cur === tempId ? n.id : cur));
      // Active note: подменяем id, draft уже совпадает.
      setActive((cur) => (cur && cur.id === tempId ? { ...cur, id: n.id } : cur));
    } catch (err: unknown) {
      const ce = ConnectError.from(err);
      // Откатываем: удалить temp-row и сбросить selection.
      setList((prev) => ({ ...prev, notes: prev.notes.filter((r) => r.id !== tempId) }));
      setSelectedId((cur) => (cur === tempId ? null : cur));
      setActive((cur) => (cur && cur.id === tempId ? null : cur));
      // Quota-exhausted (Connect ResourceExhausted = HTTP 429 в connect-go
      // mapping; Code value 8) → показываем UpgradePrompt вместо обычной
      // ошибки. Refresh quota чтобы UI отображал свежий count.
      if (ce.code === Code.ResourceExhausted) {
        setActiveError('Note limit reached');
      } else {
        setActiveError(ce.rawMessage || ce.message);
      }
    }
  }, [flushNow]);

  // onSelectNote — stable identity (нужно для React.memo Sidebar/NoteRow).
  // flushNow — useCallback([]) тоже стабильный, ОК в deps.
  const onSelectNote = useCallback(
    (id: string) => {
      void flushNow();
      setSelectedId(id);
    },
    [flushNow],
  );

  // Stable identity (no list.notes / selectedId in deps). Internal state
  // mutations через functional setState — без замыкания на устаревшие
  // значения. Это критично для React.memo на NoteRow: иначе callback
  // меняется на каждый list.notes update и memo перерисовывает все rows.
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteNote(id);
      setList((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }));
      setSelectedId((cur) => {
        if (cur !== id) return cur;
        const next = listRef.current.notes.find((n) => n.id !== id);
        return next?.id ?? null;
      });
    } catch (err: unknown) {
      const ce = ConnectError.from(err);
      setActiveError(ce.rawMessage || ce.message);
    }
  }, []);

  const handleSidebarCollapse = useCallback(() => setSidebarCollapsed(true), []);

  // Stable wrapper для Sidebar onSelect: inline arrow ломал memo Sidebar
  // (а через него — всех NoteRow). Теперь identity стабильно между
  // re-render'ами при keystroke в editor.
  const handleSidebarSelectNote = useCallback(
    (id: string) => {
      onSelectNote(id);
    },
    [onSelectNote],
  );

  const handleCreateFolder = useCallback(async (name: string, parentId?: string | null) => {
    try {
      const f = await createFolder(name, parentId);
      setFolders((prev) => [...prev, f].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast(`Could not create folder: ${msg}`);
      window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
    }
  }, []);

  const handleDeleteFolder = useCallback(async (id: string) => {
    try {
      await deleteFolder(id, true);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setList((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)),
      }));
      if (selectedFolder === id) setSelectedFolder('all');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast(`Could not delete folder: ${msg}`);
      window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
    }
  }, [selectedFolder]);

  const handleMoveNote = useCallback(async (noteId: string, folderId: string | null) => {
    try {
      await moveNote(noteId, folderId);
      setList((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === noteId ? { ...n, folderId } : n)),
      }));
    } catch (err) {
      console.error('moveNote failed', err);
      setToast(translate('hone.notes.toast.move_failed'));
      window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
    }
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────

  const gridCols = sidebarCollapsed ? `1fr` : `${sidebarW}px 6px 1fr`;

  return (
    <div
      className="fadein"
      style={{
        position: 'absolute',
        inset: 0,
        paddingTop: 80,
        paddingBottom: 80,
        display: 'grid',
        // КРИТИЧНО: при collapsed — single-column grid + right panel,
        // иначе Editor с одним in-flow child'ом auto-flow'ится в column 1
        // и схлопывается до нуля ширины (NotesExpandSidebarButton —
        // position:absolute, в grid flow не участвует).
        gridTemplateColumns: gridCols,
        animationDuration: '320ms',
      }}
    >
      {!sidebarCollapsed && (
        <Sidebar
          list={list}
          selectedId={selectedId}
          onSelect={handleSidebarSelectNote}
          folders={folders}
          selectedFolder={selectedFolder}
          onSelectFolder={setSelectedFolder}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveNote={handleMoveNote}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onToggleCollapse={handleSidebarCollapse}
        />
      )}

      {!sidebarCollapsed && (
        <ResizeHandle
          onMouseDown={(e) => {
            dragRef.current = { x: e.clientX, w: sidebarW };
          }}
        />
      )}
      {sidebarCollapsed && (
        <NotesExpandSidebarButton onClick={() => setSidebarCollapsed(false)} />
      )}

      <Editor
          list={list}
          active={active}
          activeError={activeError}
          draftTitle={draftTitle}
          draftBody={draftBody}
          saveStatus={saveStatus}
          folders={folders}
          onTitleChange={setDraftTitle}
          onBodyChange={setDraftBody}
          onCreate={handleCreate}
        />

      {toast && <Toast text={toast} />}
    </div>
  );
}
