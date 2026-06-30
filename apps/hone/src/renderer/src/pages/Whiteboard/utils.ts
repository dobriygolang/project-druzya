import type { BoardSummary } from '@features/whiteboard/api/whiteboardClient';

export interface ListState {
  status: 'loading' | 'ok' | 'error';
  boards: BoardSummary[];
  error: string | null;
}

export const INITIAL_LIST: ListState = { status: 'loading', boards: [], error: null };

export const SIDEBAR_COLLAPSED_KEY = 'hone:whiteboard:sidebar-collapsed';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export { errorMessage };
