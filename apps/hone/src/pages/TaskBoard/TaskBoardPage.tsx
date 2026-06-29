// Today — vertical task list (Winter-style), not kanban columns.
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  listTasks,
  createTask,
  moveTaskStatus,
  deleteTask,
  type TaskCard,
  type TaskKind,
  type TaskStatus,
} from '../../api/tasks';
import { useSessionStore } from '../../stores/session';
import { emptyStyle, emptyIconStyle, hdrStyle } from './lib/styles';
import { ContextMenu } from './ContextMenu';
import { TaskDrawer } from './TaskDrawer';
import { ArchiveDrawer } from './ArchiveDrawer';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskListRow } from './TaskListRow';

const ACTIVE: TaskStatus[] = ['todo', 'in_progress', 'in_review'];

function sortByUpdated(a: TaskCard, b: TaskCard): number {
  const ta = Date.parse(a.updatedAt || a.createdAt);
  const tb = Date.parse(b.updatedAt || b.createdAt);
  return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
}

export function TaskBoardPage(): JSX.Element {
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [ctx, setCtx] = useState<{ x: number; y: number; taskId: string } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const accessToken = useSessionStore((s) => s.accessToken);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
    } catch {
      /* keep stale list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    void refresh();
  }, [accessToken, refresh]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      setOpenTaskId(null);
      setCreateOpen(false);
      setCtx(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!ctx) return;
    const onClick = (): void => setCtx(null);
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [ctx]);

  const { activeTasks, doneTasks } = useMemo(() => {
    const active: TaskCard[] = [];
    const done: TaskCard[] = [];
    for (const t of tasks) {
      if (t.status === 'dismissed') continue;
      if (t.status === 'done') done.push(t);
      else if (ACTIVE.includes(t.status)) active.push(t);
      else active.push(t);
    }
    active.sort(sortByUpdated);
    done.sort(sortByUpdated);
    return { activeTasks: active, doneTasks: done };
  }, [tasks]);

  const handleMove = useCallback(async (taskId: string, status: TaskStatus): Promise<void> => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await moveTaskStatus(taskId, status);
    } catch {
      void refresh();
    }
  }, [refresh]);

  const handleToggleDone = useCallback(
    (taskId: string, nextDone: boolean) => {
      void handleMove(taskId, nextDone ? 'done' : 'todo');
    },
    [handleMove],
  );

  const handleDelete = useCallback(async (taskId: string): Promise<void> => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteTask(taskId);
      showToast('Task deleted');
    } catch {
      void refresh();
    }
  }, [refresh, showToast]);

  const handleCreate = useCallback(async (input: {
    kind: TaskKind;
    title: string;
    briefMd: string;
    skillKey: string;
    priority: number;
  }): Promise<void> => {
    try {
      const c = await createTask({
        kind: input.kind,
        title: input.title,
        briefMd: input.briefMd || undefined,
        skillKey: input.skillKey || undefined,
      });
      setTasks((prev) => [c, ...prev]);
      showToast('Task created');
    } catch {
      showToast('Could not create task');
    }
  }, [showToast]);

  const dismissedCount = tasks.filter((t) => t.status === 'dismissed').length;
  const totalOpen = activeTasks.length;

  return (
    <div className="taskboard fadein">
      <header style={{ ...hdrStyle, justifyContent: 'space-between' }}>
        <div>
          <h1 className="tb-heading">Today</h1>
          <p className="tb-subheading">
            {loading ? '…' : `${totalOpen} open`}
          </p>
        </div>

        <button
          type="button"
          className="tb-tab"
          onClick={() => setArchiveOpen(true)}
          aria-expanded={archiveOpen}
        >
          Archive
          {dismissedCount > 0 && <span className="tb-badge">{dismissedCount}</span>}
        </button>
      </header>

      <div className="tb-list-wrap">
        {loading && <p className="tb-loading">Loading…</p>}

        {!loading && activeTasks.length === 0 && doneTasks.length === 0 && (
          <div style={emptyStyle}>
            <div style={emptyIconStyle}>✨</div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-60)', margin: 0 }}>
              Nothing here yet
            </h2>
            <p style={{ fontSize: 13, maxWidth: 320, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
              Add tasks to your list — one calm scroll, no columns.
            </p>
            <button type="button" className="tb-link" onClick={() => setCreateOpen(true)}>
              Create task
            </button>
          </div>
        )}

        {!loading && (activeTasks.length > 0 || doneTasks.length > 0) && (
          <div className="tb-list">
            {activeTasks.map((task) => (
              <TaskListRow
                key={task.id}
                task={task}
                done={false}
                onToggleDone={handleToggleDone}
                onOpen={setOpenTaskId}
                onCtxMenu={(e, id) => {
                  e.preventDefault();
                  setCtx({ x: e.clientX, y: e.clientY, taskId: id });
                }}
              />
            ))}

            {doneTasks.length > 0 && (
              <div className="tb-done-section">
                <button
                  type="button"
                  className="tb-done-toggle"
                  onClick={() => setShowDone((v) => !v)}
                  aria-expanded={showDone}
                >
                  Completed ({doneTasks.length})
                  <span aria-hidden>{showDone ? '▾' : '▸'}</span>
                </button>
                {showDone &&
                  doneTasks.map((task) => (
                    <TaskListRow
                      key={task.id}
                      task={task}
                      done
                      onToggleDone={handleToggleDone}
                      onOpen={setOpenTaskId}
                      onCtxMenu={(e, id) => {
                        e.preventDefault();
                        setCtx({ x: e.clientX, y: e.clientY, taskId: id });
                      }}
                    />
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        className="tb-fab"
        onClick={() => setCreateOpen(true)}
        aria-label="Add task"
      >
        +
      </button>

      {toast && <div className="tb-toast" role="status">{toast}</div>}

      {ctx && (
        <ContextMenu
          x={ctx.x}
          y={ctx.y}
          task={tasks.find((t) => t.id === ctx.taskId)}
          onMove={(s) => { void handleMove(ctx.taskId, s); setCtx(null); }}
          onDelete={() => { void handleDelete(ctx.taskId); setCtx(null); }}
          onClose={() => setCtx(null)}
        />
      )}

      {openTaskId && (
        <TaskDrawer
          task={tasks.find((t) => t.id === openTaskId)}
          onClose={() => setOpenTaskId(null)}
        />
      )}

      {createOpen && (
        <CreateTaskModal
          onClose={() => setCreateOpen(false)}
          onSubmit={async (input) => {
            await handleCreate(input);
            setCreateOpen(false);
          }}
        />
      )}

      {archiveOpen && (
        <ArchiveDrawer
          tasks={tasks.filter((t) => t.status === 'dismissed')}
          onClose={() => setArchiveOpen(false)}
          onRestore={(id) => void handleMove(id, 'todo')}
          onDelete={(id) => void handleDelete(id)}
        />
      )}
    </div>
  );
}
