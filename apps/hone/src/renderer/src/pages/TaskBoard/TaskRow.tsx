import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useT } from '@d9-i18n';

import type { TaskCard } from '@features/tasks/api/tasks';
import { defaultDurationMin } from './lib/dates';
import { DurationPicker } from './DurationPicker';

const COL_W = 254;

interface TaskRowProps {
  task: TaskCard;
  dragging: boolean;
  dropTarget: boolean;
  editRequestKey?: number;
  onToggleDone: (task: TaskCard) => void;
  onDurationChange: (task: TaskCard, minutes: number) => void;
  onTitleChange: (task: TaskCard, title: string) => void;
  onPointerDragStart: (taskId: string, e: React.PointerEvent) => void;
}

export function TaskRow({
  task,
  dragging,
  dropTarget,
  editRequestKey = 0,
  onToggleDone,
  onDurationChange,
  onTitleChange,
  onPointerDragStart,
}: TaskRowProps): JSX.Element {
  const t = useT();
  const done = task.status === 'done';

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  useEffect(() => {
    if (editRequestKey <= 0) return;
    setDraft(task.title);
    setEditing(true);
  }, [editRequestKey, task.title]);

  const autosize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    if (!editing) return;
    autosize();
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [editing, autosize]);

  const commit = useCallback(() => {
    setEditing(false);
    const next = draft.replace(/\s+$/, '');
    if (next && next !== task.title) onTitleChange(task, next);
    else setDraft(task.title);
  }, [draft, task, onTitleChange]);

  const cancel = useCallback(() => {
    setDraft(task.title);
    setEditing(false);
  }, [task.title]);

  return (
    <article
      data-task-row
      data-task-id={task.id}
      data-done={done ? 'true' : 'false'}
      className="hone-task-row"
      onPointerDown={(e) => {
        if (editing) return;
        const target = e.target as HTMLElement;
        if (target.closest('button, textarea, [data-no-drag]')) return;
        onPointerDragStart(task.id, e);
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        boxSizing: 'border-box',
        width: COL_W,
        padding: '10px 12px',
        borderRadius: 12,
        background: 'rgb(var(--ink-rgb) / 0.05)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        opacity: dragging ? 0.4 : 1,
        cursor: editing ? 'text' : dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: editing ? 'text' : 'none',
        outline: dropTarget ? '2px solid rgb(var(--ink-rgb) / 0.55)' : 'none',
        outlineOffset: dropTarget ? 1 : 0,
      }}
    >
      <button
        type="button"
        data-no-drag
        className="hone-task-row__check"
        aria-label={done ? t('hone.taskboard.mark_incomplete') : t('hone.taskboard.mark_done')}
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone(task);
        }}
        style={{
          marginTop: 1,
          width: 16,
          height: 16,
          borderRadius: 99,
          border: done ? 'none' : '1.5px solid var(--ink-60)',
          background: done ? '#4CB35C' : 'rgb(var(--ink-rgb) / 0.04)',
          flexShrink: 0,
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          color: done ? '#0a0a0a' : 'transparent',
          fontSize: 10,
          lineHeight: 1,
          padding: 0,
        }}
      >
        {done ? '✓' : ''}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <textarea
            ref={textareaRef}
            data-no-drag
            value={draft}
            rows={1}
            aria-label={t('hone.taskboard.edit_title')}
            onChange={(e) => {
              setDraft(e.target.value);
              autosize();
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              }
            }}
            style={{
              width: '100%',
              resize: 'none',
              overflow: 'hidden',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              padding: 0,
              margin: 0,
              font: 'inherit',
              fontSize: 13,
              lineHeight: '16px',
              color: 'var(--ink-90)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          />
        ) : (
          <div
            role="textbox"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setDraft(task.title);
              setEditing(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setDraft(task.title);
                setEditing(true);
              }
            }}
            style={{
              fontSize: 13,
              lineHeight: '16px',
              color: done ? 'var(--ink-40)' : 'var(--ink-90)',
              textDecoration: done ? 'line-through' : 'none',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              cursor: 'text',
            }}
          >
            {task.title || t('hone.taskboard.untitled')}
          </div>
        )}
      </div>

      <div data-no-drag style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 1 }}>
        <DurationPicker
          valueMin={defaultDurationMin(task)}
          onChange={(min) => onDurationChange(task, min)}
        />
      </div>
    </article>
  );
}
