// REST client for project-druzya focus service (/v1/focus/*).
import { API_BASE_URL, DEV_BEARER_TOKEN } from './config';
import { useSessionStore } from '../stores/session';

export interface FocusDay {
  date: string;
  seconds: number;
  sessions: number;
}

export interface HoneStats {
  currentStreakDays: number;
  longestStreakDays: number;
  totalFocusedSeconds: number;
  heatmap: FocusDay[];
  lastSevenDays: FocusDay[];
}

export interface FocusSession {
  id: string;
  planItemId: string;
  pinnedTitle: string;
  startedAt: Date | null;
  endedAt: Date | null;
  pomodorosCompleted: number;
  secondsFocused: number;
  mode: string;
}

type JsonSession = {
  id?: string;
  mode?: string;
  pinnedTitle?: string;
  pinned_title?: string;
  taskId?: string;
  task_id?: string;
  startedAt?: string;
  started_at?: string;
  endedAt?: string;
  ended_at?: string;
  secondsFocused?: number;
  seconds_focused?: number;
  pomodorosCompleted?: number;
  pomodoros_completed?: number;
};

function authHeaders(): HeadersInit {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function parseTs(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function unwrapSession(raw: JsonSession | undefined): FocusSession {
  const s = raw ?? {};
  return {
    id: s.id ?? '',
    planItemId: s.taskId ?? s.task_id ?? '',
    pinnedTitle: s.pinnedTitle ?? s.pinned_title ?? '',
    startedAt: parseTs(s.startedAt ?? s.started_at),
    endedAt: parseTs(s.endedAt ?? s.ended_at),
    secondsFocused: s.secondsFocused ?? s.seconds_focused ?? 0,
    pomodorosCompleted: s.pomodorosCompleted ?? s.pomodoros_completed ?? 0,
    mode: s.mode ?? 'pomodoro',
  };
}

export async function startFocusSession(args: {
  planItemId?: string;
  pinnedTitle?: string;
  mode?: 'pomodoro' | 'stopwatch';
}): Promise<FocusSession> {
  const resp = await fetch(`${API_BASE_URL}/v1/focus/sessions/start`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      mode: args.mode ?? 'pomodoro',
      pinned_title: args.pinnedTitle ?? '',
      task_id: args.planItemId ?? '',
    }),
  });
  if (!resp.ok) {
    throw new Error(`startFocusSession failed: ${resp.status}`);
  }
  const j = (await resp.json()) as { session?: JsonSession };
  return unwrapSession(j.session);
}

export async function endFocusSession(args: {
  sessionId: string;
  pomodorosCompleted: number;
  secondsFocused: number;
}): Promise<FocusSession> {
  const resp = await fetch(`${API_BASE_URL}/v1/focus/sessions/${encodeURIComponent(args.sessionId)}/end`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      session_id: args.sessionId,
      pomodoros_completed: args.pomodorosCompleted,
      seconds_focused: args.secondsFocused,
    }),
  });
  if (!resp.ok) {
    throw new Error(`endFocusSession failed: ${resp.status}`);
  }
  const j = (await resp.json()) as { session?: JsonSession };
  return unwrapSession(j.session);
}

export async function getStats(upToDate?: string): Promise<HoneStats> {
  const qs = upToDate ? `?up_to_date=${encodeURIComponent(upToDate)}` : '';
  const resp = await fetch(`${API_BASE_URL}/v1/focus/stats${qs}`, {
    headers: authHeaders(),
  });
  if (!resp.ok) {
    throw new Error(`getStats failed: ${resp.status}`);
  }
  const j = (await resp.json()) as Record<string, unknown>;
  const heatmap = (j.heatmap as { date?: string; seconds?: number; sessions?: number }[] | undefined) ?? [];
  const lastSeven = (j.lastSevenDays as typeof heatmap | undefined)
    ?? (j.last_seven_days as typeof heatmap | undefined)
    ?? [];
  return {
    currentStreakDays: num(j, 'currentStreakDays', 'current_streak_days'),
    longestStreakDays: num(j, 'longestStreakDays', 'longest_streak_days'),
    totalFocusedSeconds: num(j, 'totalFocusedSeconds', 'total_focused_seconds'),
    heatmap: heatmap.map((d) => ({
      date: d.date ?? '',
      seconds: d.seconds ?? 0,
      sessions: d.sessions ?? 0,
    })),
    lastSevenDays: lastSeven.map((d) => ({
      date: d.date ?? '',
      seconds: d.seconds ?? 0,
      sessions: d.sessions ?? 0,
    })),
  };
}

function num(obj: Record<string, unknown>, camel: string, snake: string): number {
  const v = obj[camel] ?? obj[snake];
  return typeof v === 'number' ? v : 0;
}

export function padToSevenDays(input: FocusDay[]): FocusDay[] {
  const byDate = new Map(input.map((d) => [d.date, d]));
  const out: FocusDay[] = [];
  const todayISO = (() => {
    const sortedDates = input.map((d) => d.date).sort();
    const last = sortedDates[sortedDates.length - 1];
    if (last !== undefined) {
      return last;
    }
    return new Date().toISOString().slice(0, 10);
  })();
  const anchor = new Date(`${todayISO}T00:00:00Z`);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchor);
    d.setUTCDate(anchor.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    out.push(byDate.get(iso) ?? { date: iso, seconds: 0, sessions: 0 });
  }
  return out;
}
