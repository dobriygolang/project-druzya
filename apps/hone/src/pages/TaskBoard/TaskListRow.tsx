import { memo, useCallback, type MouseEvent } from 'react';

import type { TaskCard } from '../../api/tasks';

interface TaskListRowProps {
  task: TaskCard;
  done: boolean;
  onToggleDone: (taskId: string, done: boolean) => void;
  onOpen: (taskId: string) => void;
  onCtxMenu: (e: MouseEvent, taskId: string) => void;
}

export const TaskListRow = memo(function TaskListRow({
  task,
  done,
  onToggleDone,
  onOpen,
  onCtxMenu,
}: TaskListRowProps): JSX.Element {
  const onCheck = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onToggleDone(task.id, !done);
    },
    [done, onToggleDone, task.id],
  );

  const onRowClick = useCallback(() => {
    onOpen(task.id);
  }, [onOpen, task.id]);

  const onRowCtx = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      onCtxMenu(e, task.id);
    },
    [onCtxMenu, task.id],
  );

  return (
    <div
      className={done ? 'tb-row tb-row--done' : 'tb-row'}
      onClick={onRowClick}
      onContextMenu={onRowCtx}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(task.id);
        }
      }}
    >
      <button
        type="button"
        className={done ? 'tb-check tb-check--done' : 'tb-check'}
        aria-label={done ? 'Mark incomplete' : 'Mark complete'}
        aria-pressed={done}
        onClick={onCheck}
      />
      <span className="tb-row-title">{task.title}</span>
    </div>
  );
});
