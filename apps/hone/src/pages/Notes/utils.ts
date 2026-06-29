export interface ListState {
  status: 'loading' | 'ok' | 'error';
  notes: import('../../api/notesClient').NoteSummary[];
  error: string | null;
}

export const INITIAL_LIST: ListState = { status: 'loading', notes: [], error: null };

export const SIDEBAR_KEY = 'hone:notes:sidebar-w';
export const SIDEBAR_MIN = 220;
export const SIDEBAR_MAX = 400;
export const SIDEBAR_DEFAULT = 260;

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
    return dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return dt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function readSidebarWidth(): number {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n)) return SIDEBAR_DEFAULT;
    return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, n));
  } catch {
    return SIDEBAR_DEFAULT;
  }
}

export function writeSidebarWidth(w: number): void {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, String(w));
  } catch {
    /* ignore */
  }
}
