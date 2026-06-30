import React, { useEffect, useRef, useState } from 'react';
import { Code } from '@connectrpc/connect';

import { useT } from '@d9-i18n';

import type { Folder, Note } from '@features/notes/api/notesClient';
import { Kbd } from '@shared/ui/primitives/Kbd';
import { RichMarkdownEditor } from '@shared/ui/RichMarkdownEditor';
import { FolderIcon } from './icons';
import {
  EDITOR_WIDTH_KEY,
  EDITOR_WIDTH_MIN,
  WIDTH_PRESETS,
  defaultEditorWidth,
  formatTime,
  type ListState,
} from './utils';
import { zIndex } from '@shared/lib/z-index';
import { HONE_EVENTS } from '@shared/lib/custom-events';

const FOLDER_BREADCRUMB: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  marginBottom: 14,
  fontSize: 11.5,
  color: 'var(--ink-40)',
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: '0.02em',
};

const TITLE_INPUT_BASE: React.CSSProperties = {
  width: '100%',
  fontSize: 44,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  lineHeight: 1.15,
  padding: '0 0 20px',
  background: 'transparent',
  border: 'none',
  outline: 'none',
};

export interface EditorProps {
  list: ListState;
  active: Note | null;
  activeError: string | null;
  draftTitle: string;
  draftBody: string;
  saveStatus: 'idle' | 'saving' | 'saved';
  folders: Folder[];
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onCreate: () => void;
}

export function Editor({ list, active, activeError, draftTitle, draftBody, saveStatus, folders, onTitleChange, onBodyChange, onCreate }: EditorProps) {
  const t = useT();
  const [hover, setHover] = useState(false);
  // Editor max-width — drag-resizable, persisted в localStorage. Range
  // [500 .. (window.innerWidth - 80)] (clamp в onMove). Hand-rolled drag
  // (mouse-down → window:mousemove/up listeners) — mirror of sidebar
  // ResizeHandle для consistency.
  const [editorWidth, setEditorWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 1200;
    const raw = window.localStorage.getItem(EDITOR_WIDTH_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n)) return defaultEditorWidth();
    return Math.max(EDITOR_WIDTH_MIN, n);
  });

  const setWidthPreset = (v: number) => {
    setEditorWidth(v);
    try {
      window.localStorage.setItem(EDITOR_WIDTH_KEY, String(v));
    } catch {
      /* quota */
    }
  };
  const widthDragRef = useRef<{ startX: number; startW: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = widthDragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const next = Math.max(
        EDITOR_WIDTH_MIN,
        Math.min(d.startW + dx * 2, window.innerWidth - 80),
      );
      setEditorWidth(next);
    };
    const onUp = () => {
      if (widthDragRef.current === null) return;
      widthDragRef.current = null;
      document.body.style.userSelect = '';
      try {
        window.localStorage.setItem(EDITOR_WIDTH_KEY, String(editorWidth));
      } catch {
        /* ignore quota */
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [editorWidth]);
  return (
    <section
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        // Notion-style: вертикальный воздух щедрый, горизонтальные паддинги
        // умеренные (32px) — текстовая колонка центрируется через max-width
        // на ActiveEditor. Раньше было 80px с двух сторон + max-width 900 →
        // на 1920-экране контент жался к центру слишком плотно.
        padding: '56px 32px 24px 32px',
        overflowY: 'auto',
        minWidth: 0,
      }}
    >
      {list.status === 'error' ? (
        <ErrorPane message={list.error ?? ''} code={list.errorCode} />
      ) : !active && list.status === 'ok' && list.notes.length === 0 ? (
        <EmptyState onCreate={onCreate} />
      ) : !active ? (
        <EmptyState onCreate={onCreate} dim />
      ) : (
        <ActiveEditor
          key={active.id}
          noteId={active.id}
          title={draftTitle}
          body={draftBody}
          folderName={active.folderId ? (folders.find((f) => f.id === active.folderId)?.name ?? null) : null}
          onTitleChange={onTitleChange}
          onBodyChange={onBodyChange}
          editorWidth={editorWidth}
        />
      )}

      {/* Right-edge drag handle. Visible only on hover, как sidebar
       *  ResizeHandle. Clamp positioning сам внутри handler'а. */}
      <div
        onMouseDown={(e) => {
          widthDragRef.current = { startX: e.clientX, startW: editorWidth };
          document.body.style.userSelect = 'none';
        }}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 8,
          cursor: 'col-resize',
          userSelect: 'none',
          opacity: hover ? 1 : 0,
          transition: 'opacity var(--motion-dur-medium) var(--motion-ease-standard)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 3,
            width: 2,
            background: 'rgb(var(--ink-rgb) / 0.15)',
          }}
        />
      </div>

      {/* Bottom-right indicators */}
      {active && (
        <div
          className="mono"
          style={{
            position: 'absolute',
            bottom: 14,
            right: 24,
            fontSize: 10,
            color: 'var(--ink-40)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            opacity: hover ? 1 : 0.4,
            transition: 'opacity var(--motion-dur-medium) var(--motion-ease-standard)',
          }}
        >
          <div style={{ display: 'flex', gap: 4 }}>
            {WIDTH_PRESETS.map((p) => {
              const isActive = Math.abs(editorWidth - p.value) < 8;
              return (
                <button
                  key={p.id}
                  onClick={() => setWidthPreset(p.value)}
                  className="focus-ring"
                  style={{
                    padding: '3px 8px',
                    fontSize: 9.5,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: isActive ? 'var(--ink)' : 'var(--ink-40)',
                    background: isActive
                      ? 'var(--ink-tint-08)'
                      : 'transparent',
                    border: '1px solid var(--ink-tint-06)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <SaveStatusIndicator status={saveStatus} />
          <span>{formatTime(active.updatedAt)}</span>
        </div>
      )}

      {activeError && (
        <p
          className="mono"
          style={{
            position: 'absolute',
            bottom: 30,
            left: 80,
            fontSize: 10,
            color: 'var(--red)',
          }}
        >
          {activeError}
        </p>
      )}
    </section>
  );
}

function ActiveEditor({
  title,
  body,
  folderName,
  onTitleChange,
  onBodyChange,
  editorWidth,
}: {
  noteId: string;
  title: string;
  body: string;
  folderName: string | null;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  editorWidth: number;
}) {
  const t = useT();
  return (
    <div className="fadein" style={{ animationDuration: '180ms', maxWidth: editorWidth, margin: '0 auto' }}>
      {folderName && (
        <div style={FOLDER_BREADCRUMB}>
          <FolderIcon />
          <span>{folderName}</span>
        </div>
      )}
      <input
        className="hone-notes-title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={t('hone.notes.editor.title_placeholder')}
        autoFocus={!title}
        style={{ ...TITLE_INPUT_BASE, color: 'var(--ink)' }}
      />
      <div style={{ marginTop: 0, borderTop: '1px solid var(--ink-tint-06)', paddingTop: 20 }}>
        <RichMarkdownEditor
          value={body}
          onChange={onBodyChange}
          placeholder={t('hone.notes.editor.body_placeholder')}
        />
      </div>
    </div>
  );
}

export function EmptyState({ onCreate, dim = false }: { onCreate: () => void; dim?: boolean }) {
  return (
    <div
      className="fadein"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
        gap: 14,
        opacity: dim ? 0.7 : 1,
      }}
    >
      <p style={{ fontSize: 14, color: 'var(--ink-40)', margin: 0 }}>
        {dim ? 'Pick a note or' : 'No notes yet —'} press <Kbd>⌘N</Kbd> to write.
      </p>
      <button
        onClick={onCreate}
        className="focus-ring"
        style={{
          padding: '9px 18px',
          fontSize: 13,
          fontWeight: 500,
          borderRadius: 999,
          background: 'rgb(var(--ink-rgb) / 0.05)',
          border: '1px solid rgb(var(--ink-rgb) / 0.1)',
          color: 'var(--ink-90)',
          cursor: 'pointer',
          transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.1)';
          e.currentTarget.style.color = 'var(--ink)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.05)';
          e.currentTarget.style.color = 'var(--ink-90)';
        }}
      >
        + New note
      </button>
      {/* Phase J / X4 (P1) — identity reminder, only on truly-empty state
          (not when "pick a note" dim mode). Notes являются private to Hone;
          для shareable / whiteboard collab — web /editor + /whiteboard. */}
      {!dim && (
        <p
          style={{
            margin: 0,
            marginTop: 4,
            fontSize: 11,
            color: 'var(--ink-40)',
            lineHeight: 1.5,
            maxWidth: 360,
            textAlign: 'center',
          }}
        >
          Notes here are private to Hone. For public sharing or whiteboard
          collaboration, see druz9.online.
        </p>
      )}
    </div>
  );
}

export function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        cursor: 'col-resize',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 2,
          top: 0,
          bottom: 0,
          width: 2,
          background: hover ? 'rgb(var(--ink-rgb) / 0.15)' : 'transparent',
          transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard)',
        }}
      />
    </div>
  );
}

export function Toast({ text }: { text: string }) {
  return (
    <div
      className="fadein"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        // Поднимаем над Dock'ом (Dock у нас bottom: 36, ~36px высотой =
        // занимает 36..72). Раньше Toast был на bottom: 32 → перекрывался
        // с Dock'ом, юзер не видел уведомление "Synced to cloud" —
        // прятался за timer-капсулой.
        bottom: 96,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: zIndex.toast,
        padding: '10px 16px',
        background: 'rgba(20,20,22,0.96)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgb(var(--ink-rgb) / 0.1)',
        borderRadius: 10,
        color: 'var(--ink)',
        fontSize: 13,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        animationDuration: 'var(--motion-dur-medium)',
      }}
    >
      {text}
    </div>
  );
}

export function ErrorPane({ message, code }: { message: string; code: Code | null }) {
  let headline = 'Notes offline.';
  if (code === Code.Unauthenticated) headline = 'Sign in to view notes.';
  // CI1: retry via 'hone:sync-changed' event — единственный hook на котором
  // fetchList уже подписан. Re-dispatching заставит useEffect refetch'нуть
  // list без необходимости поднимать setReload в parent (Notes уже 4300+
  // строк — touch'аем минимум).
  const onRetry = () => {
    window.dispatchEvent(new CustomEvent(HONE_EVENTS.syncChanged));
  };
  return (
    <div className="data-loader-error" style={{ maxWidth: 480 }}>
      <div className="data-loader-error-stripe" />
      <div className="data-loader-error-body">
        <div className="data-loader-error-label">{headline}</div>
        {message && <div className="data-loader-error-detail">{message}</div>}
        {code !== Code.Unauthenticated && (
          <button
            type="button"
            className="data-loader-error-retry focus-ring motion-press"
            onClick={onRetry}
          >
            retry
          </button>
        )}
      </div>
    </div>
  );
}

// SaveStatusIndicator — мелкий fade-text справа внизу. 'idle' → пусто
// (минимум noise), 'saving' → 'Saving…', 'saved' → 'Saved' на 1.2s.
function SaveStatusIndicator({ status }: { status: 'idle' | 'saving' | 'saved' }) {
  if (status === 'idle') return null;
  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        color: status === 'saved' ? 'var(--ink)' : 'var(--ink-60)',
        transition: 'color var(--motion-dur-medium) var(--motion-ease-standard), opacity var(--motion-dur-medium) var(--motion-ease-standard)',
      }}
    >
      {status === 'saving' ? 'Saving…' : 'Saved'}
    </span>
  );
}

