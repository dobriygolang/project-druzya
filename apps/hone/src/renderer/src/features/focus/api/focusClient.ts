// Local-first focus — sessions in IndexedDB; stats merged from server when sync enabled.
import { listTasks } from '@features/tasks/api/tasks';
import { focusStoreGet, focusStorePut, rowFrom } from '@features/focus/repository/focusStore';
import {
  padToSevenDays,
  remoteGetStats,
  type FocusDay,
  type FocusSession,
  type HoneStats,
  type QueueStats,
} from '@features/focus/repository/focusRemote';
import { focusStoreList } from '@features/focus/repository/focusStore';
import { requireUserId } from '@shared/db/honeDb';
import { enqueueOutbox } from '@shared/sync/outbox';
import { scheduleSync } from '@shared/sync/SyncEngine';
import { canReachNetwork, isSyncEnabled } from '@shared/sync/syncConfig';

export type { FocusDay, FocusSession, HoneStats, QueueStats };
export { padToSevenDays };

interface StoredSession {
  id: string;
  planItemId: string;
  pinnedTitle: string;
  startedAt: string;
  endedAt: string | null;
  pomodorosCompleted: number;
  secondsFocused: number;
  mode: string;
}

function toSession(row: StoredSession): FocusSession {
  return {
    id: row.id,
    planItemId: row.planItemId,
    pinnedTitle: row.pinnedTitle,
    startedAt: row.startedAt ? new Date(row.startedAt) : null,
    endedAt: row.endedAt ? new Date(row.endedAt) : null,
    pomodorosCompleted: row.pomodorosCompleted,
    secondsFocused: row.secondsFocused,
    mode: row.mode,
  };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function aggregateDays(sessions: StoredSession[]): Map<string, FocusDay> {
  const map = new Map<string, FocusDay>();
  for (const s of sessions) {
    if (!s.endedAt || s.secondsFocused <= 0) continue;
    const key = dayKey(new Date(s.endedAt));
    const cur = map.get(key) ?? { date: key, seconds: 0, sessions: 0 };
    cur.seconds += s.secondsFocused;
    cur.sessions += 1;
    map.set(key, cur);
  }
  return map;
}

function streakFromDays(days: Set<string>, anchor: string): number {
  let streak = 0;
  const d = new Date(`${anchor}T12:00:00Z`);
  for (;;) {
    const key = dayKey(d);
    if (!days.has(key)) break;
    streak += 1;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

async function buildQueueStats(): Promise<QueueStats> {
  const tasks = await listTasks();
  const today = dayKey(new Date());
  const todayTasks = tasks.filter((t) => {
    if (!t.scheduledStart) return false;
    return dayKey(new Date(t.scheduledStart)) === today;
  });
  const done = todayTasks.filter((t) => t.status === 'done').length;
  return {
    todayTotal: todayTasks.length,
    todayDone: done,
    aiShare: 0,
    userShare: todayTasks.length ? 1 : 0,
  };
}

async function buildLocalStats(upToDate?: string): Promise<HoneStats> {
  const rows = await focusStoreList();
  const sessions = rows.filter((s) => s.endedAt) as StoredSession[];
  const byDay = aggregateDays(sessions);
  const heatmap = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  const anchor = upToDate ?? dayKey(new Date());
  const lastSevenDays = padToSevenDays(heatmap.filter((d) => d.date <= anchor));
  const activeDays = new Set(heatmap.filter((d) => d.seconds > 0).map((d) => d.date));
  const totalFocusedSeconds = sessions.reduce((sum, s) => sum + (s.secondsFocused ?? 0), 0);

  let longest = 0;
  const sorted = [...activeDays].sort();
  for (const date of sorted) {
    longest = Math.max(longest, streakFromDays(activeDays, date));
  }

  return {
    currentStreakDays: streakFromDays(activeDays, anchor),
    longestStreakDays: longest,
    totalFocusedSeconds,
    heatmap,
    lastSevenDays,
    queue: await buildQueueStats(),
  };
}

export async function getStats(upToDate?: string): Promise<HoneStats> {
  const local = await buildLocalStats(upToDate);
  if (!isSyncEnabled() || !canReachNetwork()) return local;
  try {
    const remote = await remoteGetStats(upToDate);
    return {
      ...remote,
      lastSevenDays: remote.lastSevenDays.length
        ? remote.lastSevenDays
        : local.lastSevenDays,
      queue: await buildQueueStats(),
    };
  } catch {
    return local;
  }
}

export async function startFocusSession(args: {
  planItemId?: string;
  pinnedTitle?: string;
  mode?: 'pomodoro' | 'stopwatch';
}): Promise<FocusSession> {
  const userId = requireUserId();
  const id = crypto.randomUUID();
  const row = rowFrom(userId, {
    id,
    planItemId: args.planItemId ?? '',
    pinnedTitle: args.pinnedTitle ?? '',
    startedAt: new Date().toISOString(),
    endedAt: null,
    pomodorosCompleted: 0,
    secondsFocused: 0,
    mode: args.mode ?? 'pomodoro',
    synced: false,
  });
  await focusStorePut(row);
  if (isSyncEnabled()) {
    await enqueueOutbox('focus', 'session_start', id, {
      planItemId: args.planItemId ?? '',
      pinnedTitle: args.pinnedTitle ?? '',
      mode: args.mode ?? 'pomodoro',
    });
    scheduleSync();
  }
  return toSession(row);
}

export async function endFocusSession(args: {
  sessionId: string;
  pomodorosCompleted: number;
  secondsFocused: number;
  reflection?: string;
}): Promise<FocusSession> {
  void args.reflection;
  const userId = requireUserId();
  const prev = await focusStoreGet(args.sessionId, userId);
  if (!prev) throw new Error(`Session not found: ${args.sessionId}`);
  const row = {
    ...prev,
    endedAt: new Date().toISOString(),
    pomodorosCompleted: args.pomodorosCompleted,
    secondsFocused: args.secondsFocused,
    synced: false,
  };
  await focusStorePut(row);
  if (isSyncEnabled()) {
    await enqueueOutbox('focus', 'session_end', args.sessionId, {
      pomodorosCompleted: args.pomodorosCompleted,
      secondsFocused: args.secondsFocused,
    });
    scheduleSync();
  }
  return toSession(row);
}
