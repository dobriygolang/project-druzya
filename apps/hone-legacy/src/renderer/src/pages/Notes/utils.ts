import { Code } from '@connectrpc/connect';
import type { NoteSummary } from '../../api/notesClient';

export interface ListState {
  status: 'loading' | 'ok' | 'error';
  notes: NoteSummary[];
  error: string | null;
  errorCode: Code | null;
}

export const INITIAL_LIST: ListState = { status: 'loading', notes: [], error: null, errorCode: null };

export const SIDEBAR_KEY = 'hone:notes:sidebar-w';
export const SIDEBAR_COLLAPSED_KEY = 'hone:notes:sidebar-collapsed';
export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 460;
export const SIDEBAR_DEFAULT = 280;
// EXPANDED_FOLDERS_KEY — set of expanded folder IDs, persisted в
// localStorage. Notion/Obsidian повторно открываются с тем же tree-state'ом.
export const EXPANDED_FOLDERS_KEY = 'hone:notes:expanded-folders';

export function readExpandedFolders(): Set<string> {
  try {
    const raw = window.localStorage.getItem(EXPANDED_FOLDERS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function writeExpandedFolders(s: Set<string>): void {
  try {
    window.localStorage.setItem(EXPANDED_FOLDERS_KEY, JSON.stringify(Array.from(s)));
  } catch {
    /* ignore quota */
  }
}

export const EDITOR_WIDTH_KEY = 'hone:notes:editor-width';
// Адаптивный default: 75% viewport'а, но не больше 1600 (на 4K-экранах
// контент не уезжает в полосу размером с альбом). Compact / Comfortable /
// Wide preset'ы доступны через WIDTH_PRESETS — пользователь толкает их в
// editor-header.
export function defaultEditorWidth(): number {
  if (typeof window === 'undefined') return 1200;
  return Math.max(560, Math.min(1600, Math.floor(window.innerWidth * 0.75)));
}
export const EDITOR_WIDTH_MIN = 560;
export const WIDTH_PRESETS: { id: 'compact' | 'comfortable' | 'wide'; label: string; value: number }[] = [
  { id: 'compact', label: 'Compact', value: 880 },
  { id: 'comfortable', label: 'Comfort', value: 1200 },
  { id: 'wide', label: 'Wide', value: 1600 },
];

export function formatTime(d: string | Date | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (!Number.isFinite(dt.getTime())) return '';
  const today = new Date();
  const sameDay =
    dt.getFullYear() === today.getFullYear() &&
    dt.getMonth() === today.getMonth() &&
    dt.getDate() === today.getDate();
  if (sameDay) {
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return dt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatCueRowDate(d: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  const day = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${mo}`;
}
