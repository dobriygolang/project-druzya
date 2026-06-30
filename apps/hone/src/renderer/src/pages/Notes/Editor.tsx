import React, { useState } from 'react';
import { Code } from '@connectrpc/connect';

import { useT } from '@d9-i18n';

import type { Note } from '@features/notes/api/notesClient';
import { Kbd } from '@shared/ui/primitives/Kbd';
import { RichMarkdownEditor } from '@shared/ui/RichMarkdownEditor';
import { formatTime, type ListState } from './utils';
import { zIndex } from '@shared/lib/z-index';
import { HONE_EVENTS } from '@shared/lib/custom-events';

const TITLE_INPUT_BASE: React.CSSProperties = {
  width: '100%',
  fontSize: 32,
  fontWeight: 700,
  letterSpacing: '-0.03em',
  lineHeight: 1.25,
  minHeight: 40,
  padding: '4px 0 20px',
  margin: 0,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  boxShadow: 'none',
};

export interface EditorProps {
  list: ListState;
  active: Note | null;
  activeError: string | null;
  draftTitle: string;
  draftBody: string;
  saveStatus: 'idle' | 'saving' | 'saved';
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onCreate: () => void;
}

export function Editor({
  list,
  active,
  activeError,
  draftTitle,
  draftBody,
  saveStatus,
  onTitleChange,
  onBodyChange,
  onCreate,
}: EditorProps) {
  const t = useT();
  const [hover, setHover] = useState(false);

  return (
    <section
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        padding: '24px 32px 24px',
        overflowY: 'auto',
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        justifyContent: 'center',
        alignSelf: 'stretch',
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
          title={draftTitle}
          body={draftBody}
          onTitleChange={onTitleChange}
          onBodyChange={onBodyChange}
        />
      )}

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
            gap: 10,
            opacity: hover ? 1 : 0.35,
            transition: 'opacity var(--motion-dur-medium) var(--motion-ease-standard)',
          }}
        >
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
            left: 24,
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
  onTitleChange,
  onBodyChange,
}: {
  title: string;
  body: string;
  onTitleChange: (v: string) => void;
  onBodyChange: (v: string) => void;
}) {
  const t = useT();
  return (
    <div
      className="fadein hone-notes-editor-shell"
      style={{
        animationDuration: '220ms',
        width: '100%',
        maxWidth: 648,
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <input
        className="hone-notes-title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={t('hone.notes.editor.title_placeholder')}
        autoFocus={!title}
        style={{ ...TITLE_INPUT_BASE, color: 'var(--ink)' }}
      />
      <RichMarkdownEditor
        value={body}
        onChange={onBodyChange}
        placeholder={t('hone.notes.editor.body_placeholder')}
        variant="plain"
      />
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
      {!dim && (
        <button
          type="button"
          onClick={onCreate}
          className="focus-ring"
          style={{
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 999,
            background: 'rgb(var(--ink-rgb) / 0.05)',
            border: 'none',
            color: 'var(--ink-90)',
            cursor: 'pointer',
          }}
        >
          + New note
        </button>
      )}
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
      }}
    >
      {text}
    </div>
  );
}

export function ErrorPane({ message, code }: { message: string; code: Code | null }) {
  let headline = 'Notes offline.';
  if (code === Code.Unauthenticated) headline = 'Sign in to view notes.';
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

function SaveStatusIndicator({ status }: { status: 'idle' | 'saving' | 'saved' }) {
  if (status === 'idle') return null;
  return (
    <span role="status" aria-live="polite" aria-atomic="true" style={{ color: 'var(--ink-60)' }}>
      {status === 'saving' ? 'Saving…' : 'Saved'}
    </span>
  );
}
