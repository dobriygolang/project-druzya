import type { TaskStatus } from '../../../api/tasks';

export interface ColumnDef {
  status: TaskStatus;
  label: string;
  accent: string;
}

// B/W only per feedback_color_rule.md — accent через opacity-стратификацию,
// не цветами. Активные columns — высокий contrast, dismissed — приглушённый.
export const COLUMNS: ReadonlyArray<ColumnDef> = [
  { status: 'todo', label: 'To Do', accent: 'rgb(var(--ink-rgb) / 0.85)' },
  { status: 'in_progress', label: 'In Progress', accent: 'rgb(var(--ink-rgb) / 0.7)' },
  { status: 'in_review', label: 'In Review', accent: 'rgb(var(--ink-rgb) / 0.55)' },
  { status: 'done', label: 'Done', accent: 'rgb(var(--ink-rgb) / 0.4)' },
  { status: 'dismissed', label: 'Dismissed', accent: 'rgb(var(--ink-rgb) / 0.2)' },
];

export type TabKey = 'my' | 'week';
