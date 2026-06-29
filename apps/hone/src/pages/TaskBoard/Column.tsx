import { memo, useCallback, useState, type CSSProperties } from 'react';
import type { TaskCard, TaskKind } from '../../api/tasks';
import { TaskCardView } from './TaskCardView';
import type { ColumnDef } from './lib/columns';

interface ColumnProps {
  col: ColumnDef;
  tasks: TaskCard[];
  onDropTask: (taskId: string) => void;
  onCardClick: (id: string) => void;
  onCtxMenu: (e: React.MouseEvent, id: string) => void;
  onOpenKindPicker: (taskId: string, current: TaskKind, x: number, y: number) => void;
}

const HEADER_STYLE: CSSProperties = {
  padding: '14px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const HEADER_LEFT_STYLE: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const HEADER_LABEL_STYLE: CSSProperties = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: 'var(--ink-60)',
};
const HEADER_COUNT_STYLE: CSSProperties = {
  fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--ink-40)',
};
const CARDS_WRAP_STYLE: CSSProperties = {
  flex: 1, padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: 5,
};
const EMPTY_STYLE: CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--ink-40)', fontSize: 11, opacity: 0.45, padding: '24px 0',
};

interface ColumnRowProps {
  task: TaskCard;
  onCardClick: (id: string) => void;
  onCtxMenu: (e: React.MouseEvent, id: string) => void;
  onOpenKindPicker: (taskId: string, current: TaskKind, x: number, y: number) => void;
}

// ColumnRow — wraps TaskCardView with stable per-row callbacks so the
// TaskCardView memo isn't defeated by sibling re-renders.
const ColumnRow = memo(function ColumnRow({
  task,
  onCardClick,
  onCtxMenu,
  onOpenKindPicker,
}: ColumnRowProps): JSX.Element {
  const handleClick = useCallback(() => onCardClick(task.id), [onCardClick, task.id]);
  const handleCtxMenu = useCallback(
    (e: React.MouseEvent) => onCtxMenu(e, task.id),
    [onCtxMenu, task.id],
  );
  return (
    <TaskCardView
      task={task}
      onClick={handleClick}
      onCtxMenu={handleCtxMenu}
      onOpenKindPicker={onOpenKindPicker}
    />
  );
});

export function Column({ col, tasks, onDropTask, onCardClick, onCtxMenu, onOpenKindPicker }: ColumnProps): JSX.Element {
  const [over, setOver] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setOver(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent<HTMLElement>) => {
    // Only clear if leaving the column entirely (not entering a child).
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setOver(false);
  }, []);
  const onDrop = useCallback((e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setOver(false);
    const id = e.dataTransfer.getData('text/task-id');
    if (id) onDropTask(id);
  }, [onDropTask]);

  const sideBorder = `1px solid ${over ? 'var(--ink-20)' : 'rgb(var(--ink-rgb) / 0.045)'}`;
  const sectionStyle: CSSProperties = {
    background: over ? 'var(--surface-2)' : 'var(--surface)',
    // 1.5px red stripe (#FF3B30) along top edge when dragOver.
    // feedback_color_rule.md: red as a stripe, not bg.
    borderTop: over ? '1.5px solid #FF3B30' : '1px solid rgb(var(--ink-rgb) / 0.045)',
    borderRight: sideBorder,
    borderBottom: sideBorder,
    borderLeft: sideBorder,
    borderRadius: 10, display: 'flex', flexDirection: 'column',
    minHeight: 380,
    transition: 'background-color var(--motion-dur-medium) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard)',
  };

  const accentDotStyle: CSSProperties = {
    width: 7, height: 7, borderRadius: '50%', background: col.accent,
    boxShadow: `0 0 5px ${col.accent}`, flexShrink: 0,
  };

  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={sectionStyle}
    >
      <header style={HEADER_STYLE}>
        <div style={HEADER_LEFT_STYLE}>
          <span style={accentDotStyle} />
          <span style={HEADER_LABEL_STYLE}>
            {col.label}
          </span>
        </div>
        <span style={HEADER_COUNT_STYLE}>
          {tasks.length}
        </span>
      </header>
      <div style={CARDS_WRAP_STYLE}>
        {tasks.length === 0 ? (
          <div style={EMPTY_STYLE}>
            —
          </div>
        ) : (
          tasks.map((t) => (
            <ColumnRow
              key={t.id}
              task={t}
              onCardClick={onCardClick}
              onCtxMenu={onCtxMenu}
              onOpenKindPicker={onOpenKindPicker}
            />
          ))
        )}
      </div>
    </section>
  );
}
