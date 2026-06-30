// TaskBoard — Notion-style kanban в Hone (electron renderer).
//
// Дизайн натянут с design/index.html: цветной strip per-kind, kind-icon,
// priority dots, age, AI/user badge, side-drawer с комментариями,
// context-menu по правому клику, FAB → modal (Linear-стиль), footer с
// прогрессом и часами. Цвета через --ink/--bg/--surface CSS-vars.
//
// Топ-паддинг 64px чтобы под traffic-lights / draggable header не
// уезжали title и FAB.
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useT, translate } from '@d9-i18n';

import {
  listTasks,
  createTask,
  moveTaskStatus,
  deleteTask,
  updateTaskKind,
  type TaskCard,
  type TaskKind,
  type TaskStatus,
} from '@features/tasks/api/tasks';
import { KindPicker } from '@pages/TaskBoard/ui/KindPicker';
import { InfoToastContainer } from '@widgets/InfoToast';
import { useToastStore } from '@shared/model/toast';
import { HONE_EVENTS } from '@shared/lib/custom-events';
import { COLUMNS, type TabKey } from './lib/columns';
import { KINDS, KindIcon, readKindFilter, writeKindFilter } from './lib/kinds';
import { hdrStyle, emptyStyle, emptyIconStyle, kindChipStyle } from './lib/styles';
import { Column } from './Column';
import { ContextMenu } from './ContextMenu';
import { TaskDrawer } from './TaskDrawer';
import { ArchiveDrawer } from './ArchiveDrawer';
import { CreateTaskModal } from './CreateTaskModal';

export function TaskBoardPage(): JSX.Element {
  const t = useT();
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('my');
  const [createOpen, setCreateOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (e: Event): void => {
      const taskId = (e as CustomEvent<{ taskId?: string }>).detail?.taskId;
      if (taskId) setOpenTaskId(taskId);
    };
    window.addEventListener(HONE_EVENTS.openTask, onOpen);
    return () => window.removeEventListener(HONE_EVENTS.openTask, onOpen);
  }, []);

  const [ctx, setCtx] = useState<{ x: number; y: number; taskId: string } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [kindFilter, setKindFilterRaw] = useState<Set<TaskKind>>(() => readKindFilter());
  const setKindFilter = useCallback((next: Set<TaskKind>) => {
    setKindFilterRaw(next);
    writeKindFilter(next);
  }, []);
  const [kindPickerFor, setKindPickerFor] = useState<{ taskId: string; current: TaskKind; x: number; y: number } | null>(null);
  const showInfo = useToastStore((s) => s.showInfo);

  const toast = useCallback((msg: string): void => {
    showInfo(msg);
  }, [showInfo]);

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasks());
    } catch {
      /* keep stale */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // ESC для закрытия оверлеев
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

  // Скрытие ctx-меню при клике вне
  useEffect(() => {
    if (!ctx) return;
    const onClick = (): void => setCtx(null);
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [ctx]);

  const visibleTasks = useMemo(() => {
    let arr = tasks;
    if (tab === 'week') {
      const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      arr = arr.filter((t) => {
        const ts = Date.parse(t.updatedAt || t.createdAt);
        return Number.isFinite(ts) && ts >= cutoff;
      });
    }
    // Kind filter chips. Empty set = passthrough (no filter).
    if (kindFilter.size > 0) {
      arr = arr.filter((t) => kindFilter.has(t.kind));
    }
    return arr;
  }, [tasks, tab, kindFilter]);

  const handleOverrideKind = useCallback(
    async (taskId: string, nextKind: TaskKind) => {
      // Optimistic: write locally + flip manualKindOverride flag.
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, kind: nextKind, manualKindOverride: true } : task)),
      );
      try {
        const updated = await updateTaskKind(taskId, nextKind, true);
        // Reconcile с сервером (в идеале — то же, но safe rewire).
        setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      } catch {
        // Revert on failure.
        showInfo(translate('hone.notify.override_failed'));
        void refresh();
      }
    },
    [refresh, showInfo],
  );

  const colsToShow = useMemo(
    () => COLUMNS.filter((c) => c.status !== 'dismissed'),
    [],
  );

  const grouped = useMemo(() => {
    const m: Record<TaskStatus, TaskCard[]> = {
      todo: [], in_progress: [], in_review: [], done: [], dismissed: [],
    };
    for (const t of visibleTasks) m[t.status]?.push(t);
    return m;
  }, [visibleTasks]);

  const handleMove = useCallback(async (taskId: string, status: TaskStatus): Promise<void> => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await moveTaskStatus(taskId, status);
      const col = COLUMNS.find((c) => c.status === status);
      if (col) toast(`Moved to ${col.label}`);
    } catch {
      void refresh();
    }
  }, [refresh, toast]);

  // Stable column-row callbacks: passed down through Column → ColumnRow
  // (memoized) → TaskCardView (memoized). Inline arrows ломали оба memo
  // на любой re-render TaskBoardPage (а они часты — bulk progress, cursor
  // events, kind-filter chips).
  const handleCardClick = useCallback((id: string) => setOpenTaskId(id), []);
  const handleCardCtxMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setCtx({ x: e.clientX, y: e.clientY, taskId: id });
  }, []);
  const handleOpenKindPicker = useCallback(
    (taskId: string, current: TaskKind, x: number, y: number) =>
      setKindPickerFor({ taskId, current, x, y }),
    [],
  );

  async function handleDelete(taskId: string): Promise<void> {
    setTasks((prev) => prev.filter((task) => task.id !== taskId));
    try {
      await deleteTask(taskId);
      toast(translate('hone.notify.task_deleted'));
    } catch {
      void refresh();
    }
  }

  async function handleCreate(input: {
    kind: TaskKind;
    title: string;
    briefMd: string;
    skillKey: string;
    priority: number;
  }): Promise<void> {
    try {
      const c = await createTask({
        kind: input.kind,
        title: input.title,
        briefMd: input.briefMd || undefined,
        skillKey: input.skillKey || undefined,
      });
      setTasks((prev) => [c, ...prev]);
      toast(translate('hone.notify.task_created'));
    } catch {
      toast(translate('hone.notify.task_create_failed'));
    }
  }

  return (
    <div
      className="fadein"
      style={{
        position: 'absolute',
        inset: 0,
        padding: '64px 32px 28px', // 64px top — under draggable chrome / traffic lights
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header — минимальный, tabs + bulk action + archive button */}
      <header style={{ ...hdrStyle, justifyContent: 'space-between' }}>
        <div role="tablist" aria-label="Task filter" style={{ display: 'flex', gap: 4 }}>
          {(['my', 'week'] as TabKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              role="tab"
              aria-selected={tab === key}
              aria-pressed={tab === key}
              style={{
                fontSize: 11, padding: '5px 12px', borderRadius: 6,
                border: '1px solid var(--ink-20)',
                background: tab === key ? 'var(--ink)' : 'transparent',
                color: tab === key ? 'var(--bg)' : 'var(--ink-60)',
                cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
                fontWeight: 500,
                transition: 'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard)',
              }}
            >
              {key === 'my' ? t('hone.taskboard.tab.my') : t('hone.taskboard.tab.week')}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Archive trigger — shows count of dismissed tasks. */}
          <button
            onClick={() => setArchiveOpen(true)}
            aria-label="Open archive drawer"
            aria-expanded={archiveOpen}
            aria-haspopup="dialog"
            title={t('hone.taskboard.btn.archive_title')}
            style={{
              fontSize: 11,
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid var(--ink-20)',
              background: 'transparent',
              color: 'var(--ink-60)',
              cursor: 'pointer',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {t('hone.taskboard.btn.archive')}
            {tasks.filter((t) => t.status === 'dismissed').length > 0 && (
              <span
                style={{
                  background: 'var(--ink-20)',
                  color: 'var(--ink-90)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {tasks.filter((t) => t.status === 'dismissed').length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Phase J / H3 — Kind-filter chip row. cmd/ctrl+click = multi-select,
          plain click toggles. «All» chip resets. Hairline highlight when
          active (B/W rule: no fill). */}
      <div
        role="toolbar"
        aria-label="Filter by kind"
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 18,
          alignItems: 'center', minWidth: 0,
        }}
      >
        <button
          onClick={() => setKindFilter(new Set())}
          aria-pressed={kindFilter.size === 0}
          style={kindChipStyle(kindFilter.size === 0)}
        >
          All
        </button>
        {(['algo', 'sysdesign', 'quiz', 'reflection', 'reading', 'ml', 'custom'] as TaskKind[]).map((k) => {
          const def = KINDS[k];
          const on = kindFilter.has(k);
          return (
            <button
              key={k}
              onClick={(e) => {
                const multi = e.metaKey || e.ctrlKey;
                const next = new Set(kindFilter);
                if (multi) {
                  if (next.has(k)) next.delete(k);
                  else next.add(k);
                } else {
                  if (on && next.size === 1) {
                    // toggle off — same chip clicked → All.
                    next.clear();
                  } else {
                    next.clear();
                    next.add(k);
                  }
                }
                setKindFilter(next);
              }}
              aria-pressed={on}
              title={`Filter by ${def.label} · cmd-click for multi-select`}
              style={kindChipStyle(on)}
            >
              <KindIcon kind={k} size={11} color={on ? def.color : 'currentColor'} />
              <span style={{ marginLeft: 4 }}>{def.label}</span>
            </button>
          );
        })}
      </div>

      {/* States */}
      {loading && (
        <p style={{ color: 'var(--ink-40)', textAlign: 'center', marginTop: 80 }}>{t('common.loading')}</p>
      )}

      {!loading && visibleTasks.length === 0 && kindFilter.size === 0 && (
        <div style={emptyStyle}>
          <div style={emptyIconStyle}>✨</div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink-60)', margin: 0 }}>
            {t('hone.taskboard.empty.title')}
          </h2>
          <p style={{ fontSize: 13, maxWidth: 320, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
            {t('hone.taskboard.empty.body')}
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              fontSize: 12, color: 'var(--ink-60)', cursor: 'pointer',
              textDecoration: 'underline', textUnderlineOffset: 2,
              background: 'none', border: 'none',
            }}
          >
            {t('hone.taskboard.empty.create_first')}
          </button>
        </div>
      )}

      {/* Per-filter empty state — Phase J / H3 */}
      {!loading && visibleTasks.length === 0 && kindFilter.size > 0 && (
        <div style={emptyStyle}>
          <div style={emptyIconStyle}>
            {[...kindFilter].slice(0, 1).map((k) => (
              <KindIcon key={k} kind={k} size={22} />
            ))}
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-60)', margin: 0 }}>
            {t('hone.taskboard.empty.filter_title')}
          </h2>
          <p style={{ fontSize: 12.5, maxWidth: 360, textAlign: 'center', lineHeight: 1.6, margin: 0, color: 'var(--ink-40)' }}>
            {t('hone.taskboard.empty.filter_body')}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setKindFilter(new Set())}
              style={{
                fontSize: 12, color: 'var(--ink-60)', cursor: 'pointer',
                textDecoration: 'underline', textUnderlineOffset: 2,
                background: 'none', border: 'none',
              }}
            >
              {t('hone.taskboard.empty.clear_filter')}
            </button>
          </div>
        </div>
      )}

      {/* Board */}
      {!loading && visibleTasks.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${colsToShow.length}, minmax(0, 1fr))`,
            gap: 12, flex: 1, alignItems: 'start', minHeight: 0,
          }}
        >
          {colsToShow.map((c) => (
            <Column
              key={c.status}
              col={c}
              tasks={grouped[c.status] ?? []}
              onDropTask={(id) => void handleMove(id, c.status)}
              onCardClick={handleCardClick}
              onCtxMenu={handleCardCtxMenu}
              onOpenKindPicker={handleOpenKindPicker}
            />
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setCreateOpen(true)}
        aria-label="Add task"
        style={{
          position: 'fixed', bottom: 28, right: 28, width: 44, height: 44, borderRadius: 12,
          background: 'var(--ink)', color: 'var(--bg)', border: 'none', fontSize: 22,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 100, fontWeight: 300,
          lineHeight: 1, paddingBottom: 4,
        }}
      >
        +
      </button>

      <InfoToastContainer />

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

      {/* Drawer */}
      {openTaskId && (
        <TaskDrawer
          taskId={openTaskId}
          task={tasks.find((t) => t.id === openTaskId)}
          onClose={() => setOpenTaskId(null)}
        />
      )}

      {/* Modal */}
      {createOpen && (
        <CreateTaskModal
          onClose={() => setCreateOpen(false)}
          onSubmit={async (input) => {
            await handleCreate(input);
            setCreateOpen(false);
          }}
        />
      )}

      {/* R4 (Phase A 2026-05-12) — Archive drawer. Right-slide overlay
          с dismissed tasks. Restore = move back to 'todo'. Delete =
          hard remove. */}
      {archiveOpen && (
        <ArchiveDrawer
          tasks={tasks.filter((t) => t.status === 'dismissed')}
          onClose={() => setArchiveOpen(false)}
          onRestore={(id) => void handleMove(id, 'todo')}
          onDelete={(id) => void handleDelete(id)}
        />
      )}

      {kindPickerFor && (
        <KindPicker
          current={kindPickerFor.current}
          anchor={{ x: kindPickerFor.x, y: kindPickerFor.y }}
          onClose={() => setKindPickerFor(null)}
          onPick={(next) => {
            const taskId = kindPickerFor.taskId;
            setKindPickerFor(null);
            void handleOverrideKind(taskId, next);
          }}
        />
      )}
    </div>
  );
}
