import { memo, useCallback, useEffect, useState, type CSSProperties } from 'react';

import { useT } from '@d9-i18n';

import type { TaskCard, TaskKind } from '../../api/tasks';
import { KINDS, KindIcon as KindIconBase } from './lib/kinds';
import { readTitleOverrides, writeTitleOverride, relativeAge } from './lib/helpers';

interface TaskCardViewProps {
  task: TaskCard;
  onClick: () => void;
  onCtxMenu: (e: React.MouseEvent) => void;
  onOpenKindPicker: (taskId: string, current: TaskKind, x: number, y: number) => void;
}

// Module-scope styles — stable identities so React.memo doesn't see prop
// churn from siblings re-rendering.
const INNER_STYLE: CSSProperties = { flex: 1, padding: '10px 12px', minWidth: 0 };
const HEADER_ROW_STYLE: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 };
const TITLE_INPUT_STYLE: CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.4,
  color: 'var(--ink)',
  background: 'transparent',
  border: 'none',
  borderBottom: '1px solid var(--ink-40)',
  outline: 'none',
  padding: 0,
  fontFamily: 'inherit',
  minWidth: 0,
};
const TITLE_LABEL_STYLE: CSSProperties = {
  flex: 1,
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.4,
  color: 'var(--ink)',
  cursor: 'text',
};
const KIND_BTN_STYLE: CSSProperties = {
  marginTop: 1,
  padding: 2,
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  flexShrink: 0,
  opacity: 0.85,
};
const MANUAL_OVERRIDE_DOT_STYLE: CSSProperties = {
  width: 4, height: 4, borderRadius: '50%',
  background: '#FF3B30',
  flexShrink: 0,
};
const BRIEF_STYLE: CSSProperties = { margin: 0, fontSize: 11, lineHeight: 1.5, color: 'var(--ink-40)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 8 };
const META_ROW_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' };
const SKILL_CHIP_STYLE: CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', padding: '1px 6px', borderRadius: 3, background: 'var(--ink-tint-06)', color: 'var(--ink-60)' };
const PRIORITY_WRAP_STYLE: CSSProperties = { display: 'flex', gap: 2, alignItems: 'center' };
const PRIORITY_DOT_STYLE: CSSProperties = { width: 4, height: 4, borderRadius: '50%', background: 'var(--ink-40)' };
const AGE_STYLE: CSSProperties = { fontSize: 10, color: 'var(--ink-40)' };
const AI_BADGE_STYLE: CSSProperties = { fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', padding: '1px 5px', borderRadius: 3, background: 'rgb(var(--ink-rgb) / 0.10)', color: 'rgb(var(--ink))' };
const YOU_BADGE_STYLE: CSSProperties = { fontSize: 10, color: 'var(--ink-40)' };
const AI_PULSE_STYLE: CSSProperties = {
  position: 'absolute', inset: 0, borderRadius: 7, pointerEvents: 'none',
  animation: 'aiPulseHone 2.5s ease-in-out infinite',
};
const DEEPLINK_BASE_STYLE: CSSProperties = {
  marginLeft: 'auto', minWidth: 28, minHeight: 28, width: 28, height: 28, borderRadius: 5, border: 'none',
  background: 'var(--ink-tint-06)', color: 'var(--ink-40)',
  fontSize: 10, cursor: 'pointer',
  transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const STRIPE_BASE_STYLE: CSSProperties = { width: 3, borderRadius: '7px 0 0 7px', flexShrink: 0 };

interface KindIconProps {
  kind: TaskKind;
  manualOverride: boolean;
  ariaLabel: string;
  title: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const KindIcon = memo(function KindIcon({
  kind,
  manualOverride,
  ariaLabel,
  title,
  onClick,
}: KindIconProps): JSX.Element {
  return (
    <button
      data-stop
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      style={KIND_BTN_STYLE}
    >
      <KindIconBase kind={kind} size={12} />
      {manualOverride && (
        <span
          aria-hidden
          style={MANUAL_OVERRIDE_DOT_STYLE}
          title="Manually set (won't auto-recategorise)"
        />
      )}
    </button>
  );
});

interface TaskMetaProps {
  skillKey?: string;
  priority: number;
  createdAt: string;
  source: TaskCard['source'];
}

const TaskMeta = memo(function TaskMeta({
  skillKey,
  priority,
  createdAt,
  source,
}: TaskMetaProps): JSX.Element {
  const priorityDots = priority > 0 ? Math.min(priority, 3) : 0;
  const ageLabel = relativeAge(createdAt);
  return (
    <>
      {skillKey && (
        <span style={SKILL_CHIP_STYLE}>
          {skillKey}
        </span>
      )}
      {priorityDots > 0 && (
        <div style={PRIORITY_WRAP_STYLE}>
          {Array.from({ length: priorityDots }).map((_, i) => (
            <span key={i} style={PRIORITY_DOT_STYLE} />
          ))}
        </div>
      )}
      <span style={AGE_STYLE}>{ageLabel}</span>
      {source === 'ai' ? (
        <span style={AI_BADGE_STYLE}>
          AI
        </span>
      ) : (
        <span style={YOU_BADGE_STYLE}>you</span>
      )}
    </>
  );
});

interface TaskActionsProps {
  deepLink: string | undefined;
  hover: boolean;
}

const TaskActions = memo(function TaskActions({ deepLink, hover }: TaskActionsProps): JSX.Element | null {
  const onOpen = () => {
    if (deepLink) window.open(deepLink, '_blank');
  };
  const style: CSSProperties = { ...DEEPLINK_BASE_STYLE, opacity: hover ? 1 : 0 };
  if (!deepLink) return null;
  return (
    <button data-stop onClick={onOpen} title="Open" style={style}>
      →
    </button>
  );
});

export const TaskCardView = memo(TaskCardViewImpl);

function TaskCardViewImpl({ task, onClick, onCtxMenu, onOpenKindPicker }: TaskCardViewProps): JSX.Element {
  const t = useT();
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  // Title state — initial = override if present, иначе server title.
  const [localTitle, setLocalTitle] = useState<string>(() => {
    const ov = readTitleOverrides();
    return ov[task.id] ?? task.title;
  });
  // Sync с сервером когда тот меняет title'и (например на refresh) и
  // у нас нет override для этой карточки.
  useEffect(() => {
    const ov = readTitleOverrides();
    if (!(task.id in ov)) setLocalTitle(task.title);
  }, [task.id, task.title]);
  const k = KINDS[task.kind];
  const aiPulse = task.status === 'in_review' && task.source === 'ai';

  const commitTitle = (next: string): void => {
    const trimmed = next.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    setLocalTitle(trimmed);
    writeTitleOverride(task.id, trimmed);
    setEditing(false);
  };

  const onMouseEnter = () => setHover(true);
  const onMouseLeave = () => setHover(false);
  const onDragStart = (e: React.DragEvent<HTMLElement>) => {
    e.dataTransfer.setData('text/task-id', task.id);
    e.dataTransfer.effectAllowed = 'move';
    // Custom ghost: clone current card, fade + scale, attach off-screen,
    // hand to dataTransfer.setDragImage. Browser renders the clone instead
    // of the default fullsize screenshot, then GC'd after dragend tick.
    const src = e.currentTarget as HTMLElement;
    const ghost = src.cloneNode(true) as HTMLElement;
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    ghost.style.left = '-1000px';
    ghost.style.width = `${src.offsetWidth}px`;
    ghost.style.opacity = '0.85';
    ghost.style.transform = 'rotate(-1.5deg) scale(0.98)';
    ghost.style.boxShadow = '0 6px 24px rgba(0,0,0,0.45)';
    ghost.style.pointerEvents = 'none';
    ghost.style.background = 'var(--surface-2)';
    document.body.appendChild(ghost);
    try {
      e.dataTransfer.setDragImage(ghost, 20, 14);
    } catch {
      // Some browsers/Electron versions throw on detached nodes.
    }
    window.setTimeout(() => { ghost.remove(); }, 0);
    setDragging(true);
  };
  const onDragEnd = () => setDragging(false);
  const onArticleClick = (e: React.MouseEvent<HTMLElement>) => {
    if (editing) return;
    if ((e.target as HTMLElement).closest('[data-stop]')) return;
    onClick();
  };

  const onKindClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onOpenKindPicker(task.id, task.kind, r.right + 4, r.top);
  }, [onOpenKindPicker, task.id, task.kind]);

  const onTitleDblClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    setEditing(true);
  };
  const onInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
  };
  const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    commitTitle(e.currentTarget.value);
  };
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      commitTitle(e.currentTarget.value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditing(false);
    }
  };

  const kindAriaLabel = `Kind: ${k.label}${task.manualKindOverride ? ' (manually set)' : ''}. Click to change.`;
  const kindTitle = task.manualKindOverride
    ? 'Kind set manually · click to change'
    : 'Auto-tagged · click to override';

  const articleStyle: CSSProperties = {
    display: 'flex', borderRadius: 7,
    background: hover ? 'var(--surface-2)' : 'rgb(var(--ink-rgb) / 0.025)',
    cursor: dragging ? 'grabbing' : 'grab',
    position: 'relative',
    opacity: dragging ? 0.35 : 1,
    transform: dragging ? 'scale(0.97)' : hover ? 'translateY(-1px)' : 'none',
    boxShadow: hover ? '0 2px 12px rgba(0,0,0,0.25)' : 'none',
    transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), box-shadow var(--motion-dur-medium) var(--motion-ease-standard), transform var(--motion-dur-medium) var(--motion-ease-standard)',
  };
  const stripeStyle: CSSProperties = { ...STRIPE_BASE_STYLE, background: k.color };

  return (
    <article
      // data-task-id — anchor для AICursor overlay'а: компонент ищет
      // карточку через document.querySelector('[data-task-id="..."]')
      // и центрирует курсор в её bounding-box.
      data-task-id={task.id}
      // draggable отключаем во время edit'а — иначе Электрон/Chromium
      // снимает focus с <input> при mousedown и Enter/Escape не доедут.
      draggable={!editing}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onArticleClick}
      onContextMenu={onCtxMenu}
      style={articleStyle}
    >
      <span style={stripeStyle} />
      <div style={INNER_STYLE}>
        <div style={HEADER_ROW_STYLE}>
          {editing ? (
            <input
              data-stop
              autoFocus
              defaultValue={localTitle}
              onClick={onInputClick}
              onBlur={onInputBlur}
              onKeyDown={onInputKeyDown}
              style={TITLE_INPUT_STYLE}
            />
          ) : (
            <span
              onDoubleClick={onTitleDblClick}
              title={t('hone.taskboard.dblclick_rename_title')}
              style={TITLE_LABEL_STYLE}
            >
              {localTitle}
            </span>
          )}
          <KindIcon
            kind={task.kind}
            manualOverride={!!task.manualKindOverride}
            ariaLabel={kindAriaLabel}
            title={kindTitle}
            onClick={onKindClick}
          />
        </div>
        {task.briefMd && (
          <p style={BRIEF_STYLE}>
            {task.briefMd}
          </p>
        )}
        <div style={META_ROW_STYLE}>
          <TaskMeta
            skillKey={task.skillKey}
            priority={task.priority}
            createdAt={task.createdAt}
            source={task.source}
          />
          <TaskActions deepLink={task.deepLink} hover={hover} />
        </div>
      </div>
      {aiPulse && (
        <span style={AI_PULSE_STYLE} />
      )}
    </article>
  );
}
