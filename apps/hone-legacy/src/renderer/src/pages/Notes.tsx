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
} from '../api/notesClient';
import {
  unpublishNote,
  shareNoteToWeb,
  makeNotePrivate,
  getNotesMeta,
  type NoteMeta,
} from '../api/storage';
import { getRow } from '../api/localCache';
import { trackEvent } from '../api/events';
import { analytics, ANALYTICS_EVENTS } from '../lib/analytics';
import { HONE_EVENTS } from '../lib/custom-events';
import { useSessionStore } from '../stores/session';
import { useQuotaStore } from '../stores/quota';
import {
  createLocalNote,
  listLocalNotes,
  getLocalNote,
  updateLocalNote,
  deleteLocalNote,
  isLocalNoteId,
  promoteToCloud,
  type LocalNote,
} from '../api/localNotes';
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
  // metaMap — per-note flags (encrypted/published). Заполняется bulkMeta
  // на mount + на hone:sync-changed. Ref для async-callback access без
  // запутывания useCallback-deps.
  const [metaMap, setMetaMap] = useState<Map<string, NoteMeta>>(new Map());
  const metaMapRef = useRef(metaMap);
  metaMapRef.current = metaMap;
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
      // Local-only notes (free-tier и ниже) — параллельно с network list'ом
      // тянем из IndexedDB. local: id префикс однозначно отличает их от
      // cloud-нот, sidebar отрисует одним списком (sorted by updatedAt).
      const localPromise = listLocalNotes().catch((): LocalNote[] => []);

      void Promise.all([listNotes(), localPromise])
        .then(([res, locals]) => {
          if (cancelled) return;
          const localRows: NoteSummary[] = locals.map((n) => ({
            id: n.id,
            title: n.title,
            updatedAt: new Date(n.updatedAt),
            sizeBytes: new Blob([n.bodyMd]).size,
            folderId: null,
          }));
          setList((prev) => {
            // Сохраняем temp:id rows которые ещё не на сервере (optimistic
            // create в полёте).
            const temps = prev.notes.filter((n) => n.id.startsWith('temp:'));
            const merged = [...temps, ...localRows, ...res.notes];
            // Stable sort: local + cloud по updatedAt desc, temps всегда top.
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
          const firstId = localRows[0]?.id ?? res.notes[0]?.id ?? null;
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

    const fetchMeta = () => {
      if (cancelled) return;
      void getNotesMeta()
        .then((items) => {
          if (cancelled) return;
          const m = new Map<string, NoteMeta>();
          for (const it of items) m.set(it.id, it);
          setMetaMap(m);
        })
        .catch(() => {
          /* silent — sidebar просто без флагов до следующего refresh'а */
        });
    };

    fetchList();
    fetchMeta();
    const onSync = () => {
      fetchList();
      fetchMeta();
    };
    window.addEventListener(HONE_EVENTS.syncChanged, onSync);
    return () => {
      cancelled = true;
      window.removeEventListener(HONE_EVENTS.syncChanged, onSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load active note on selection change. Cache-first read для instant
  // open: пытаемся IndexedDB (Phase C-5) до сети, если есть — рендерим
  // сразу. В фоне — refresh из сети, replace state когда придёт.
  //
  // Skip-fetch cases:
  //   - temp:id → уже inline-loaded в handleCreate (server ещё не знает
  //     этот id, fetch вернёт 404).
  //   - active.id === selectedId → уже in-memory от optimistic-flow
  //     (например после createNote'а где мы вручную swap'нули id).
  useEffect(() => {
    if (!selectedId) {
      setActive(null);
      return;
    }
    if (selectedId.startsWith('temp:')) return;
    // Already loaded — не сбрасываем active (избегаем flicker'а пустого
    // экрана). Network refresh всё равно выполнится через SSE event
    // или 30s polling.
    if (activeRef.current?.id === selectedId) return;

    // Local-only note: читаем из IndexedDB, никаких network calls.
    if (isLocalNoteId(selectedId)) {
      let cancelledLocal = false;
      void getLocalNote(selectedId).then((ln) => {
        if (cancelledLocal || !ln) return;
        if (selectedIdRef.current !== selectedId) return;
        const note: Note = {
          id: ln.id,
          title: ln.title,
          bodyMd: ln.bodyMd,
          sizeBytes: new Blob([ln.bodyMd]).size,
          createdAt: new Date(ln.createdAt),
          updatedAt: new Date(ln.updatedAt),
        } as Note;
        setActive(note);
        setDraftTitle(note.title);
        setDraftBody(note.bodyMd);
      });
      return () => {
        cancelledLocal = true;
      };
    }

    let cancelled = false;
    setActiveError(null);

    // Cache-first: instant render если в IndexedDB есть row.
    void (async () => {
      const uid = useSessionStore.getState().userId;
      if (!uid) return;
      try {
        const cached = await getRow<Record<string, unknown>>(uid, 'hone_notes', selectedId);
        if (cancelled || !cached) return;
        // Если за время cache-fetch'а пользователь ушёл на другую заметку
        // (selectedId сменился) — не пишем stale data.
        if (selectedIdRef.current !== selectedId) return;
        const note: Note = {
          id: String(cached.id),
          title: typeof cached.title === 'string' ? cached.title : 'Untitled',
          bodyMd: typeof cached.body_md === 'string' ? cached.body_md : '',
          sizeBytes: typeof cached.size_bytes === 'number' ? cached.size_bytes : 0,
          createdAt: typeof cached.created_at === 'string' ? new Date(cached.created_at) : new Date(),
          updatedAt: typeof cached.updated_at === 'string' ? new Date(cached.updated_at) : new Date(),
        } as Note;
        setActive(note);
        setDraftTitle(note.title);
        setDraftBody(note.bodyMd);
      } catch {
        /* IDB miss — упадём на network */
      }
    })();

    // Network refresh — всегда, чтобы поймать изменения с других девайсов.
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

    // Local-only note → persist в IndexedDB вместо REST. Никакого
    // encrypt-path: vault не применим к local-only (E2E смысла нет —
    // данные не покидают устройство; OS-level encryption уже даёт
    // baseline защиту).
    if (isLocalNoteId(activeId)) {
      setSaveStatus('saving');
      try {
        const updated = await updateLocalNote(activeId, { title, bodyMd: body });
        lastSavedRef.current = { title, body };
        if (updated) {
          setList((prev) => ({
            ...prev,
            notes: prev.notes.map((row) =>
              row.id === activeId
                ? { ...row, title: updated.title, updatedAt: new Date(updated.updatedAt), sizeBytes: new Blob([updated.bodyMd]).size }
                : row,
            ),
          }));
        }
        setSaveStatus('saved');
        window.setTimeout(() => setSaveStatus((cur) => (cur === 'saved' ? 'idle' : cur)), SAVE_STATUS_FADE_MS);
      } catch {
        setSaveStatus('idle');
      }
      return;
    }

    setSaveStatus('saving');

    // Re-encrypt path. Если active note encrypted, body — plaintext
    // (decrypted в EncryptedEditorView), который мы должны снова
    // encrypt'нуть и отправить через /vault/notes/{id}/encrypt вместо
    // обычного UpdateNote (иначе server запишет plaintext в body_md →
    // encryption-гарантия нарушена).
    //
    // Title тоже всё равно сохраняем через UpdateNote — title остаётся
    // plaintext'ом (видим в sidebar для всех заметок включая encrypted).
    const isEncrypted = metaMapRef.current.get(activeId)?.encrypted ?? false;
    try {
      if (isEncrypted) {
        const { isUnlocked, encryptNote } = await import('../api/vault');
        if (!isUnlocked()) {
          // Vault stale-locked во время сессии редактирования. Сохранение
          // plaintext'а будет утечкой → отказ. Юзер увидит «Saving…»
          // зависшим — следующий attempt при unlock'е сработает.
          setSaveStatus('idle');
          return;
        }
        // Title: сохраняем через обычный path (он перетирает body_md тоже,
        // но мы немедленно за ним push'ним свежий ciphertext через
        // /vault/notes/{id}/encrypt — итоговое состояние корректное:
        // title=user input, body_md=ciphertext, encrypted=true).
        await updateNote(activeId, title, lastSavedRef.current.body); // body не трогаем, оставляем prev ciphertext
        await encryptNote(activeId, body);
        // После encryptNote'а server'ный body_md = свежий ciphertext.
        // lastSavedRef держим plaintext чтобы следующий keystroke снова
        // не trigger'ил save если ничего не изменилось.
        lastSavedRef.current = { title, body };
      } else {
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
      }
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
    void flushNow(); // не await: pending save поедет фоном

    // Free-tier: создаём local-only заметку (никогда не идёт на бэкенд).
    // Юзер всё равно может отдельно "Sync to cloud" если quota позволит.
    const tier = useQuotaStore.getState().tier;
    if (tier === 'free') {
      try {
        const ln = await createLocalNote('Untitled', '');
        const row: NoteSummary = {
          id: ln.id,
          title: ln.title,
          updatedAt: new Date(ln.updatedAt),
          sizeBytes: 0,
          folderId: null,
        };
        setList((prev) => ({ ...prev, notes: [row, ...prev.notes] }));
        setSelectedId(ln.id);
        setActive({
          id: ln.id,
          title: ln.title,
          bodyMd: '',
          sizeBytes: 0,
          createdAt: new Date(ln.createdAt),
          updatedAt: new Date(ln.updatedAt),
        } as Note);
        setDraftTitle(ln.title);
        setDraftBody('');
      } catch (err) {
        setActiveError(err instanceof Error ? err.message : String(err));
      }
      return;
    }

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
      trackEvent('note_create');
      // Cross-product taxonomy mirror. `source` distinguishes empty-shell
      // creations (this branch) от promote-from-link (см ниже).
      analytics.track(ANALYTICS_EVENTS.note_created, { source: 'sidebar_new' });
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
      // Quota counter: SYNCED N/M в sidebar должен +1. Без этого
      // юзер видит «0 / 10» сколько бы заметок ни создал, до hourly
      // auto-refresh.
      void useQuotaStore.getState().refresh();

      // Default-encrypt: если vault unlocked'ed (а он по дефолту unlocked
      // через VaultUnlockGate), сразу encrypt'аем свежесозданную note.
      // Body=пустой, но мы прокинем через `encryptNote` чтобы server
      // взвёл encrypted=true flag — следующий save будет encrypted-path.
      // Если vault locked (race-window, юзер lock'нул прямо сейчас) —
      // оставляем plaintext, юзер может вручную encrypt'нуть позже из
      // 3-точек.
      try {
        const { isUnlocked, encryptNote: encryptApi } = await import('../api/vault');
        if (isUnlocked()) {
          await encryptApi(n.id, '');
          setMetaMap((prev) => {
            const next = new Map(prev);
            const cur = next.get(n.id);
            next.set(n.id, {
              id: n.id,
              published: cur?.published ?? false,
              encrypted: true,
            });
            return next;
          });
        }
      } catch {
        /* encrypt-fail — note всё равно создалась, просто без E2E */
      }
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
        const { useQuotaStore, quotaExceededMessage } = await import('../stores/quota');
        useQuotaStore.getState().showUpgradePrompt(quotaExceededMessage('note'));
        void useQuotaStore.getState().refresh();
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
      if (isLocalNoteId(id)) {
        await deleteLocalNote(id);
      } else {
        await deleteNote(id);
      }
      setList((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== id) }));
      // Quota counter: server-side count изменился, sidebar quota-bar
      // (`SYNCED N / OVER LIMIT M`) должен decrement'нуться. Раньше юзер
      // удалял notes, а счётчик оставался прежним до hourly auto-refresh.
      // Trigger immediate re-fetch.
      if (!isLocalNoteId(id)) {
        const { useQuotaStore } = await import('../stores/quota');
        void useQuotaStore.getState().refresh();
      }
      // Используем functional setSelectedId с inspection через setList
      // чтобы избежать stale closure'а на selectedId. Closure'нем через
      // отдельный set: если deleted == текущий, выбрать первый оставшийся.
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

  // Sync local note → cloud. Создаёт server row через CreateNote (с
   // текущим title+body), затем удаляет local copy и пере-select'ает на
   // новый server id. На quota-exhausted показываем upgrade prompt и
   // оставляем local copy intact.
  const handleSyncToCloud = useCallback(async (id: string) => {
    if (!isLocalNoteId(id)) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // Offline-guard: без internet'а sync обречён на network error.
      // Раньше юзер кликал, видел «Sync failed» через 30s timeout — теперь
      // моментальный feedback что мы offline.
      setToast("You're offline · sync paused");
      window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
      return;
    }
    try {
      await flushNow(); // ensure latest content в local store
      const ln = await getLocalNote(id);
      if (!ln) return;
      const created = await createNote(ln.title, ln.bodyMd);
      // Удаляем local после успешного create.
      await deleteLocalNote(id);
      setList((prev) => ({
        ...prev,
        notes: prev.notes.map((row) =>
          row.id === id
            ? { id: created.id, title: created.title, updatedAt: created.updatedAt, sizeBytes: created.sizeBytes, folderId: created.folderId }
            : row,
        ),
      }));
      setSelectedId((cur) => (cur === id ? created.id : cur));
      setActive((cur) => (cur && cur.id === id ? created : cur));
      setToast('Synced to cloud');
      window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
      void useQuotaStore.getState().refresh();
    } catch (err) {
      const ce = ConnectError.from(err);
      if (ce.code === Code.ResourceExhausted) {
        const { quotaExceededMessage } = await import('../stores/quota');
        useQuotaStore.getState().showUpgradePrompt(quotaExceededMessage('note'));
        void useQuotaStore.getState().refresh();
      } else {
        setToast('Sync failed');
        window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
      }
    }
  }, [flushNow]);

  // handlePublish ("Share to web") — atomic decrypt + publish. UX:
  // 1) flush draft so the latest body is persisted; 2) load note and, if
  // encrypted, prompt for vault passphrase + decrypt locally; 3) POST
  // /share-to-web with the plaintext — server clears `encrypted` and
  // creates the public slug in one transaction. Other devices never see
  // an intermediate "decrypted but private" state.
  const handlePublish = useCallback(async (id: string) => {
    try {
      await flushNow();
      let effectiveId = id;
      if (isLocalNoteId(id)) {
        effectiveId = await promoteToCloud(id);
        setList((prev) => ({
          ...prev,
          notes: prev.notes.map((n) => (n.id === id ? { ...n, id: effectiveId } : n)),
        }));
        setSelectedId((cur) => (cur === id ? effectiveId : cur));
        void useQuotaStore.getState().refresh();
      }

      // The proto Note doesn't carry the encrypted flag — resolve it via
      // the bulk meta endpoint which is the authoritative source.
      const meta = await getNotesMeta();
      const isEncrypted = meta.find((m) => m.id === effectiveId)?.encrypted ?? false;
      const note = await getNote(effectiveId);
      let plaintextMd = note.bodyMd ?? '';
      if (isEncrypted) {
        const { isUnlocked, unlockVault, fetchSalt, decryptText } =
          await import('../api/vault');
        if (!isUnlocked()) {
          const salt = await fetchSalt();
          if (!salt) {
            setToast('Set up Vault in Settings first');
            window.setTimeout(() => setToast(null), TOAST_DISMISS_LONG_MS);
            return;
          }
          const pwd = window.prompt('Vault password to share this note:');
          if (!pwd) return;
          await unlockVault(pwd);
        }
        plaintextMd = await decryptText(note.bodyMd ?? '');
      }

      const result = await shareNoteToWeb(effectiveId, plaintextMd);
      trackEvent('note_publish');
      if (result.url) {
        try {
          await navigator.clipboard.writeText(result.url);
          setToast('Public link copied');
        } catch {
          setToast(`Public: ${result.url}`);
        }
        window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast(`Share failed: ${msg}`);
      window.setTimeout(() => setToast(null), TOAST_DISMISS_ERROR_MS);
    }
  }, [flushNow]);

  // handleUnpublish ("Make private") — atomic encrypt + unpublish. Loads
  // the current plaintext, encrypts locally, POSTs /make-private — server
  // writes ciphertext, sets encrypted=true, clears the public slug, wipes
  // embedding, all in one UPDATE. If the note is already private we
  // short-circuit with an idempotent toast.
  const handleUnpublish = useCallback(async (id: string) => {
    try {
      await flushNow();
      const meta = await getNotesMeta();
      const isEncrypted = meta.find((m) => m.id === id)?.encrypted ?? false;
      const note = await getNote(id);
      if (isEncrypted) {
        // Already encrypted+private; legacy unpublish (clear slug only) handles
        // the rare "encrypted-but-still-published" state by just dropping the slug.
        await unpublishNote(id);
        setToast('Made private');
        window.setTimeout(() => setToast(null), TOAST_DISMISS_SHORT_MS);
        return;
      }
      const { isUnlocked, unlockVault, fetchSalt, encryptText } =
        await import('../api/vault');
      if (!isUnlocked()) {
        const salt = await fetchSalt();
        if (!salt) {
          setToast('Set up Vault in Settings first');
          window.setTimeout(() => setToast(null), TOAST_DISMISS_LONG_MS);
          return;
        }
        const pwd = window.prompt('Vault password to make this note private:');
        if (!pwd) return;
        await unlockVault(pwd);
      }
      const ciphertextB64 = await encryptText(note.bodyMd ?? '');
      await makeNotePrivate(id, ciphertextB64);
      setToast('Made private');
      window.setTimeout(() => setToast(null), TOAST_DISMISS_SHORT_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast(`Make-private failed: ${msg}`);
      window.setTimeout(() => setToast(null), TOAST_DISMISS_ERROR_MS);
    }
  }, [flushNow]);

  // Bring a cloud note BACK to local-only.
  //
  // Symmetric counterpart to handleSyncToCloud: read the latest cloud
  // body, materialise it into IndexedDB as a local note, then delete the
  // cloud row. Encrypted notes are decrypted first (vault prompt) so the
  // local copy holds plaintext — local notes don't carry encryption.
  // If the note is currently published the share-slug must be cleared
  // first; we run unpublishNote to be idempotent.
  const handleCloudToLocal = useCallback(async (id: string) => {
    if (isLocalNoteId(id)) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setToast("You're offline · come back when you have internet");
      window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
      return;
    }
    try {
      await flushNow();
      const meta = await getNotesMeta();
      const m = meta.find((row) => row.id === id);
      const isEncrypted = m?.encrypted ?? false;
      const isPublished = !!m?.published;
      const note = await getNote(id);
      let plaintextMd = note.bodyMd ?? '';
      if (isEncrypted) {
        const { isUnlocked, unlockVault, fetchSalt, decryptText } =
          await import('../api/vault');
        if (!isUnlocked()) {
          const salt = await fetchSalt();
          if (!salt) {
            setToast('Set up Vault in Settings first');
            window.setTimeout(() => setToast(null), TOAST_DISMISS_LONG_MS);
            return;
          }
          const pwd = window.prompt('Vault password to bring this note local:');
          if (!pwd) return;
          await unlockVault(pwd);
        }
        plaintextMd = await decryptText(note.bodyMd ?? '');
      }
      // Public link goes away first so the cloud row can be deleted next.
      if (isPublished) {
        try { await unpublishNote(id); } catch { /* ignore — delete still works */ }
      }
      const local = await createLocalNote(note.title ?? 'Untitled', plaintextMd);
      await deleteNote(id);
      setList((prev) => ({
        ...prev,
        notes: prev.notes.map((row) =>
          row.id === id
            ? {
                id: local.id,
                title: local.title,
                // LocalNote.updatedAt is ISO string; NoteSummary expects
                // Date|null — sidebar formatters handle null gracefully.
                updatedAt: local.updatedAt ? new Date(local.updatedAt) : null,
                sizeBytes: local.bodyMd.length,
                folderId: null,
              }
            : row,
        ),
      }));
      setSelectedId((cur) => (cur === id ? local.id : cur));
      setActive((cur) => (cur && cur.id === id ? { ...cur, id: local.id } : cur));
      setToast('Moved to local-only');
      window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
      void useQuotaStore.getState().refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast(`Move-local failed: ${msg}`);
      window.setTimeout(() => setToast(null), TOAST_DISMISS_ERROR_MS);
    }
  }, [flushNow]);

  // Encrypt note. Lock-icon в sidebar row → этот handler.
  // Flow:
  //   1. Если vault не unlocked — prompt password, derive key.
  //   2. Если note ещё в Yjs/CodeMirror migration — flush сначала чтобы
  //      зашифровать самую свежую версию body_md (а не вчерашнюю).
  //   3. Encrypt body локально + POST /vault/notes/{id}/encrypt.
  //   4. Toast confirmation, локальный list state обновится через
  //      next pull (SSE event, или 30s).
  const handleEncrypt = useCallback(async (id: string) => {
    try {
      const { isUnlocked, unlockVault, fetchSalt, encryptNote: encryptApi } =
        await import('../api/vault');
      if (!isUnlocked()) {
        const salt = await fetchSalt();
        if (!salt) {
          setToast('Set up Vault in Settings first');
          window.setTimeout(() => setToast(null), TOAST_DISMISS_LONG_MS);
          return;
        }
        const pwd = window.prompt('Vault password to encrypt this note:');
        if (!pwd) return;
        await unlockVault(pwd);
      }
      // Flush текущего drafr'а если encrypting active note — иначе
      // зашифруем yesterday's bytes. Если encrypting другую заметку
      // (не selected) — flushNow на ней noop, getNote() ниже подтянет
      // server-truth.
      await flushNow();
      let effectiveId = id;
      if (isLocalNoteId(id)) {
        effectiveId = await promoteToCloud(id);
        setList((prev) => ({
          ...prev,
          notes: prev.notes.map((n) => (n.id === id ? { ...n, id: effectiveId } : n)),
        }));
        setSelectedId((cur) => (cur === id ? effectiveId : cur));
        void useQuotaStore.getState().refresh();
      }
      const note = await getNote(effectiveId);
      if (note.bodyMd === undefined) {
        setToast('Could not load note body');
        window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
        return;
      }
      await encryptApi(effectiveId, note.bodyMd);
      setToast('Note encrypted');
      window.setTimeout(() => setToast(null), TOAST_DISMISS_SHORT_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setToast(`Encrypt failed: ${msg}`);
      window.setTimeout(() => setToast(null), TOAST_DISMISS_ERROR_MS);
    }
  }, [flushNow]);

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
      // Auto-promote local→cloud перед moveNote: backend парсит id как
      // UUID, `local:<uuid>` (42 char) фейлит с 400. Promote делает
      // CreateNote, заменяет id, удаляет local-копию.
      let effectiveId = noteId;
      if (isLocalNoteId(noteId)) {
        try {
          effectiveId = await promoteToCloud(noteId);
          // После promote'а локальный list-row держит старый local id —
          // меняем на cloud id (folderId выставится через moveNote ниже).
          setList((prev) => ({
            ...prev,
            notes: prev.notes.map((n) => (n.id === noteId ? { ...n, id: effectiveId } : n)),
          }));
          if (selectedId === noteId) setSelectedId(effectiveId);
          // promote = createNote → SYNCED counter +1.
          void useQuotaStore.getState().refresh();
        } catch (err) {
          console.error('promoteToCloud failed', err);
          setToast(translate('hone.notes.toast.promote_failed'));
          window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
          return;
        }
      }
      await moveNote(effectiveId, folderId);
      setList((prev) => ({
        ...prev,
        notes: prev.notes.map((n) => (n.id === effectiveId ? { ...n, folderId } : n)),
      }));
    } catch (err) {
      console.error('moveNote failed', err);
      setToast(translate('hone.notes.toast.move_failed'));
      window.setTimeout(() => setToast(null), TOAST_DISMISS_DEFAULT_MS);
    }
  }, [selectedId]);

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
          metaMap={metaMap}
          onSelect={handleSidebarSelectNote}
          folders={folders}
          selectedFolder={selectedFolder}
          onSelectFolder={setSelectedFolder}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onMoveNote={handleMoveNote}
          onCreate={handleCreate}
          onDelete={handleDelete}
          onPublish={handlePublish}
          onUnpublish={handleUnpublish}
          onEncrypt={handleEncrypt}
          onSyncToCloud={handleSyncToCloud}
          onCloudToLocal={handleCloudToLocal}
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
          encrypted={!!(active && metaMap.get(active.id)?.encrypted)}
          saveStatus={saveStatus}
          folders={folders}
          onTitleChange={setDraftTitle}
          onBodyChange={setDraftBody}
          onCreate={handleCreate}
          onToggleAIExcluded={async (noteId, next) => {
            setActive((cur) => (cur && cur.id === noteId ? { ...cur, aiExcluded: next } : cur));
          }}
        />

      {toast && <Toast text={toast} />}
    </div>
  );
}
