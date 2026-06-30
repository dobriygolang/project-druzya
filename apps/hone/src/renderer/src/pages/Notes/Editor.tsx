import { useT } from '@d9-i18n';

import type { Note } from '@features/notes/api/notesClient';
import { isNoteVaultLocked } from '@features/notes/api/notesClient';
import { Kbd } from '@shared/ui/primitives/Kbd';
import { Icon } from '@shared/ui/primitives/Icon';
import { LiveMarkdownEditor } from '@shared/ui/LiveMarkdownEditor';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import { formatTime, type ListState } from './utils';

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
  onRetryList: () => void;
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
  onRetryList,
}: EditorProps) {
  return (
    <section className="hone-vault-editor hone-notes-editor">
      <div className="hone-vault-editor__inner">
        {list.status === 'error' ? (
          <ErrorPane message={list.error ?? ''} onRetry={onRetryList} />
        ) : !active && list.status === 'ok' && list.notes.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : !active ? (
          <EmptyState onCreate={onCreate} dim />
        ) : isNoteVaultLocked(active) ? (
          <VaultLockedPane />
        ) : (
          <ActiveEditor
            key={active.id}
            title={draftTitle}
            body={draftBody}
            onTitleChange={onTitleChange}
            onBodyChange={onBodyChange}
          />
        )}
      </div>

      {active && !isNoteVaultLocked(active) && (
        <div className="mono hone-notes-editor-meta hone-vault-editor__meta">
          <SaveStatusIndicator status={saveStatus} />
          <span>{formatTime(active.updatedAt)}</span>
        </div>
      )}

      {activeError && <p className="mono hone-vault-editor__error">{activeError}</p>}
    </section>
  );
}

function VaultLockedPane() {
  const t = useT();
  return (
    <div className="hone-vault-empty hone-notes-vault-locked">
      <span className="hone-notes-vault-locked__icon" aria-hidden>
        <Icon name="lock" size={22} strokeWidth={1.5} />
      </span>
      <p className="hone-notes-vault-locked__title">{t('hone.notes.vault_locked_title')}</p>
      <p className="hone-notes-vault-locked__body">{t('hone.notes.vault_locked_body')}</p>
      <button
        type="button"
        className="hone-vault-empty__cta focus-ring"
        onClick={() => window.dispatchEvent(new Event(HONE_EVENTS.openSettings))}
      >
        {t('hone.notes.vault_locked_cta')}
      </button>
    </div>
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
    <div className="hone-notes-editor-shell">
      <input
        className="hone-notes-title"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={t('hone.notes.editor.title_placeholder')}
        autoFocus={!title}
      />
      <LiveMarkdownEditor
        value={body}
        onChange={onBodyChange}
        placeholder={t('hone.notes.editor.body_placeholder')}
      />
    </div>
  );
}

export function EmptyState({ onCreate, dim = false }: { onCreate: () => void; dim?: boolean }) {
  const t = useT();
  const text = t(dim ? 'hone.notes.empty_dim' : 'hone.notes.empty_fresh');
  const [before, after = ''] = text.split('⌘N');
  return (
    <div className="hone-vault-empty" data-dim={dim ? 'true' : 'false'}>
      <p>
        {before}
        <Kbd>⌘N</Kbd>
        {after}
      </p>
      {!dim && (
        <button type="button" onClick={onCreate} className="hone-vault-empty__cta focus-ring">
          {t('hone.notes.empty_cta')}
        </button>
      )}
    </div>
  );
}

export function ErrorPane({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="data-loader-error" style={{ maxWidth: 480 }}>
      <div className="data-loader-error-stripe" />
      <div className="data-loader-error-body">
        <div className="data-loader-error-label">{t('hone.notes.error_load')}</div>
        {message && <div className="data-loader-error-detail">{message}</div>}
        <button
          type="button"
          className="data-loader-error-retry focus-ring motion-press"
          onClick={onRetry}
        >
          {t('hone.error.retry')}
        </button>
      </div>
    </div>
  );
}

function SaveStatusIndicator({ status }: { status: 'idle' | 'saving' | 'saved' }) {
  const t = useT();
  if (status === 'idle') return null;
  return (
    <span role="status" aria-live="polite" aria-atomic="true">
      {status === 'saving' ? t('hone.notes.saving') : t('hone.notes.saved')}
    </span>
  );
}
