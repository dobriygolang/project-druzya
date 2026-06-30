import React, { memo, useEffect, useState, type CSSProperties } from 'react';

import { useT } from '@d9-i18n';

import {
  listTaskComments,
  addTaskComment,
  type TaskCard,
  type TaskComment,
} from '@features/tasks/api/tasks';
import { KINDS } from './lib/kinds';
import { COLUMNS } from './lib/columns';
import { relativeAge } from './lib/helpers';

interface TaskDrawerProps {
  taskId: string;
  task: TaskCard | undefined;
  onClose: () => void;
}

const OVERLAY_STYLE: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 400,
};
const ASIDE_STYLE: CSSProperties = {
  position: 'fixed', top: 0, right: 0, width: 420, maxWidth: '100vw', height: '100vh',
  background: 'var(--surface)', borderLeft: '1px solid var(--ink-20)', zIndex: 401,
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
  animation: 'drawerIn var(--motion-dur-large) var(--motion-ease-emphasized)',
};
const HEADER_STYLE: CSSProperties = {
  padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  borderBottom: '1px solid var(--ink-20)', flexShrink: 0,
};
const STATUS_LABEL_STYLE: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--ink-60)' };
const CLOSE_BTN_STYLE: CSSProperties = {
  width: 28, height: 28, borderRadius: 6, border: 'none', background: 'none',
  color: 'var(--ink-40)', cursor: 'pointer', fontSize: 16,
};
const BODY_STYLE: CSSProperties = { flex: 1, overflowY: 'auto', padding: 20 };
const KIND_BAR_BASE_STYLE: CSSProperties = { width: 32, height: 4, borderRadius: 2, marginBottom: 12 };
const KIND_LABEL_STYLE: CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--ink-40)',
  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
};
const TITLE_STYLE: CSSProperties = {
  fontSize: 17, fontWeight: 700, lineHeight: 1.35, marginBottom: 16, letterSpacing: '-0.2px',
};
const META_WRAP_STYLE: CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20,
};
const DIVIDER_STYLE: CSSProperties = { height: 1, background: 'var(--ink-20)', margin: '16px 0' };
const BRIEF_STYLE: CSSProperties = { fontSize: 13, lineHeight: 1.65, color: 'var(--ink-60)', margin: 0 };
const DEEPLINK_STYLE: CSSProperties = {
  display: 'inline-block', marginTop: 12, fontSize: 12, color: 'var(--ink-60)', textDecoration: 'underline',
};
const SECTION_HEADER_STYLE: CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--ink-60)', marginBottom: 12,
};
const COMMENT_ROW_STYLE: CSSProperties = { display: 'flex', gap: 10, marginBottom: 14 };
const AVATAR_STYLE: CSSProperties = {
  width: 24, height: 24, borderRadius: 6, background: 'var(--surface-2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: 11, color: 'var(--ink-40)', flexShrink: 0,
};
const COMMENT_BODY_WRAP_STYLE: CSSProperties = { flex: 1, minWidth: 0 };
const COMMENT_HEADER_STYLE: CSSProperties = {
  fontSize: 11, fontWeight: 600, color: 'var(--ink-60)', marginBottom: 2,
};
const COMMENT_TIME_STYLE: CSSProperties = { fontWeight: 400, color: 'var(--ink-40)', marginLeft: 6 };
const COMMENT_TEXT_STYLE: CSSProperties = { fontSize: 12, lineHeight: 1.5, color: 'var(--ink-60)' };
const EMPTY_COMMENTS_STYLE: CSSProperties = {
  fontSize: 12, color: 'var(--ink-40)', textAlign: 'center', padding: '12px 0',
};
const FORM_STYLE: CSSProperties = { display: 'flex', gap: 8, marginTop: 8 };
const INPUT_STYLE: CSSProperties = {
  flex: 1, padding: '8px 12px', background: 'var(--surface-2)',
  border: '1px solid var(--ink-20)', borderRadius: 6, color: 'var(--ink)',
  fontFamily: 'inherit', fontSize: 12, outline: 'none',
};
const SUBMIT_BASE_STYLE: CSSProperties = {
  padding: '8px 14px', background: 'var(--surface-2)',
  border: '1px solid var(--ink-20)', borderRadius: 6, color: 'var(--ink-60)',
  fontFamily: 'inherit', fontSize: 11, fontWeight: 500, cursor: 'pointer',
};
const META_ITEM_STYLE: CSSProperties = {
  fontSize: 11, color: 'var(--ink-40)', display: 'flex', alignItems: 'center', gap: 4,
};
const META_VALUE_STYLE: CSSProperties = { color: 'var(--ink-60)' };

interface SectionHeaderProps {
  label: string;
  count?: number;
}

const SectionHeader = memo(function SectionHeader({ label, count }: SectionHeaderProps): JSX.Element {
  return (
    <div style={SECTION_HEADER_STYLE}>
      {label}{count !== undefined ? ` ${count}` : ''}
    </div>
  );
});

interface KindPickerProps {
  color: string;
  label: string;
}

const KindPicker = memo(function KindPicker({ color, label }: KindPickerProps): JSX.Element {
  const bar: CSSProperties = { ...KIND_BAR_BASE_STYLE, background: color };
  return (
    <>
      <div style={bar} />
      <div style={KIND_LABEL_STYLE}>{label}</div>
    </>
  );
});

interface DateRowProps {
  statusLabel: string;
  createdAt: string;
  source: TaskCard['source'];
  skillKey?: string;
}

const DateRow = memo(function DateRow({
  statusLabel,
  createdAt,
  source,
  skillKey,
}: DateRowProps): JSX.Element {
  const ageLabel = `${relativeAge(createdAt)} ago`;
  const sourceLabel = source === 'ai' ? 'AI Coach' : 'You';
  return (
    <div style={META_WRAP_STYLE}>
      <Meta label="Status" value={statusLabel} />
      <Meta label="Created" value={ageLabel} />
      <Meta label="Source" value={sourceLabel} />
      {skillKey && <Meta label="Skill" value={skillKey} />}
    </div>
  );
});

export function TaskDrawer({ taskId, task, onClose }: TaskDrawerProps): JSX.Element | null {
  const t = useT();
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    void listTaskComments(taskId)
      .then((c) => { if (alive) setComments(c); })
      .catch(() => {
        // Comments secondary; drawer всё ещё показывает task body.
        // Empty list — корректное UI-состояние (нет комментов).
      });
    return () => { alive = false; };
  }, [taskId]);

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    try {
      const created = await addTaskComment(taskId, body.trim());
      setComments((p) => [...p, created]);
      setBody('');
    } catch (err) {
      // User-action на submit — без catch ошибка летела бы в unhandled
      // rejection и юзер видел бы «отправил, но не появилось».
      console.error('TaskDrawer: addTaskComment failed', err);
    } finally {
      setSending(false);
    }
  };

  const onBodyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBody(e.target.value);
  };

  const submitDisabled = !body.trim() || sending;
  const submitStyle: CSSProperties = { ...SUBMIT_BASE_STYLE, opacity: submitDisabled ? 0.5 : 1 };

  if (!task) return null;
  const k = KINDS[task.kind];
  const c = COLUMNS.find((x) => x.status === task.status);
  const statusLabel = c?.label ?? '';

  return (
    <>
      <div onClick={onClose} aria-hidden="true" style={OVERLAY_STYLE} />
      <aside style={ASIDE_STYLE}>
        <header style={HEADER_STYLE}>
          <span style={STATUS_LABEL_STYLE}>{statusLabel}</span>
          <button
            onClick={onClose}
            aria-label="Close task details"
            style={CLOSE_BTN_STYLE}
          >
            ×
          </button>
        </header>
        <div style={BODY_STYLE}>
          <KindPicker color={k.color} label={k.label} />
          <div style={TITLE_STYLE}>{task.title}</div>

          <DateRow
            statusLabel={statusLabel}
            createdAt={task.createdAt}
            source={task.source}
            skillKey={task.skillKey}
          />

          <div style={DIVIDER_STYLE} />

          {task.briefMd && (
            <p style={BRIEF_STYLE}>
              {task.briefMd}
            </p>
          )}

          {task.deepLink && (
            <a href={task.deepLink} style={DEEPLINK_STYLE}>
              {t('hone.taskboard.drawer.open_external')}
            </a>
          )}

          <div style={DIVIDER_STYLE} />
          <SectionHeader
            label={t('hone.taskboard.drawer.comments_label')}
            count={comments.length}
          />

          {comments.map((cm) => (
            <div key={cm.id} style={COMMENT_ROW_STYLE}>
              <div style={AVATAR_STYLE}>
                {cm.authorKind === 'ai' ? '🤖' : '👤'}
              </div>
              <div style={COMMENT_BODY_WRAP_STYLE}>
                <div style={COMMENT_HEADER_STYLE}>
                  {cm.authorKind === 'ai' ? t('hone.taskboard.drawer.author_ai') : t('hone.taskboard.drawer.author_you')}
                  <time style={COMMENT_TIME_STYLE}>
                    {cm.createdAt.slice(0, 10)}
                  </time>
                </div>
                <div style={COMMENT_TEXT_STYLE}>{cm.bodyMd}</div>
              </div>
            </div>
          ))}

          {comments.length === 0 && (
            <p style={EMPTY_COMMENTS_STYLE}>
              {t('hone.taskboard.drawer.no_comments')}
            </p>
          )}

          <form onSubmit={onSubmit} style={FORM_STYLE}>
            <input
              value={body}
              onChange={onBodyChange}
              placeholder={t('hone.taskboard.drawer.add_comment_placeholder')}
              aria-label={t('hone.taskboard.drawer.add_comment_placeholder')}
              style={INPUT_STYLE}
            />
            <button
              type="submit"
              disabled={submitDisabled}
              style={submitStyle}
            >
              {sending ? '…' : 'Send'}
            </button>
          </form>
        </div>
      </aside>
      <style>{`@keyframes drawerIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={META_ITEM_STYLE}>
      {label}: <span style={META_VALUE_STYLE}>{value}</span>
    </div>
  );
}
