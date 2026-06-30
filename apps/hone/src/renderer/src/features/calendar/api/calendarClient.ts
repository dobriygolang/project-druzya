import { API_BASE_URL, DEV_BEARER_TOKEN } from '@shared/api/config';
import { apiFetch } from '@shared/api/http';
import { useSessionStore } from '@shared/model/session';

const EVENTS_BASE = `${API_BASE_URL}/v1/tracker/integrations/google/events`;
const SETTINGS_BASE = `${API_BASE_URL}/v1/tracker/settings`;
const GOOGLE_URL_BASE = `${API_BASE_URL}/v1/tracker/integrations/google`;

function authHeaders(): Record<string, string> {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

export interface TrackerSettings {
  googleCalendarSyncEnabled: boolean;
  googleCalendarConnected: boolean;
}

function pickBool(obj: Record<string, unknown>, camel: string, snake: string): boolean {
  const v = obj[camel] ?? obj[snake];
  return v === true;
}

function pickStr(obj: Record<string, unknown>, camel: string, snake: string): string {
  const v = obj[camel] ?? obj[snake];
  return typeof v === 'string' ? v : '';
}

function unwrapGoogleEvent(raw: Record<string, unknown>): GoogleCalendarEvent {
  const startRaw = raw.start ?? raw.startTime;
  const endRaw = raw.end ?? raw.endTime;
  const start =
    typeof startRaw === 'string'
      ? startRaw
      : startRaw && typeof startRaw === 'object'
        ? pickStr(startRaw as Record<string, unknown>, 'dateTime', 'date_time') ||
          pickStr(startRaw as Record<string, unknown>, 'date', 'date')
        : '';
  const end =
    typeof endRaw === 'string'
      ? endRaw
      : endRaw && typeof endRaw === 'object'
        ? pickStr(endRaw as Record<string, unknown>, 'dateTime', 'date_time') ||
          pickStr(endRaw as Record<string, unknown>, 'date', 'date')
        : '';
  return {
    id: pickStr(raw, 'id', 'id'),
    title: pickStr(raw, 'title', 'title') || pickStr(raw, 'summary', 'summary') || '(No title)',
    start,
    end,
    allDay: pickBool(raw, 'allDay', 'all_day'),
  };
}

function unwrapSettings(raw: Record<string, unknown>): TrackerSettings {
  return {
    googleCalendarSyncEnabled: pickBool(raw, 'googleCalendarSyncEnabled', 'google_calendar_sync_enabled'),
    googleCalendarConnected: pickBool(raw, 'googleCalendarConnected', 'google_calendar_connected'),
  };
}

export async function listGoogleCalendarEvents(
  timeMin: Date,
  timeMax: Date,
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    time_min: timeMin.toISOString(),
    time_max: timeMax.toISOString(),
  });
  const resp = await apiFetch(`${EVENTS_BASE}?${params}`, { headers: authHeaders() });
  if (resp.status === 401) return [];
  if (!resp.ok) throw new Error(`listGoogleCalendarEvents: ${resp.status}`);
  const j = (await resp.json()) as { events?: Record<string, unknown>[] };
  return (j.events ?? []).map(unwrapGoogleEvent).filter((e) => e.start);
}

export async function getTrackerSettings(): Promise<TrackerSettings> {
  const resp = await apiFetch(SETTINGS_BASE, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`getTrackerSettings: ${resp.status}`);
  const j = (await resp.json()) as { settings?: Record<string, unknown> };
  return unwrapSettings(j.settings ?? {});
}

export async function updateTrackerSettings(
  patch: Partial<Pick<TrackerSettings, 'googleCalendarSyncEnabled'>>,
): Promise<TrackerSettings> {
  const body: Record<string, boolean> = {};
  if (patch.googleCalendarSyncEnabled !== undefined) {
    body.google_calendar_sync_enabled = patch.googleCalendarSyncEnabled;
  }
  const resp = await apiFetch(SETTINGS_BASE, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`updateTrackerSettings: ${resp.status}`);
  const j = (await resp.json()) as { settings?: Record<string, unknown> };
  return unwrapSettings(j.settings ?? {});
}

export async function getGoogleCalendarAuthURL(): Promise<string> {
  const resp = await apiFetch(`${GOOGLE_URL_BASE}/url`, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`getGoogleCalendarAuthURL: ${resp.status}`);
  const j = (await resp.json()) as { url?: string };
  if (!j.url) throw new Error('getGoogleCalendarAuthURL: empty url');
  return j.url;
}

export async function disconnectGoogleCalendar(): Promise<TrackerSettings> {
  const resp = await apiFetch(`${GOOGLE_URL_BASE}/disconnect`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: '{}',
  });
  if (!resp.ok) throw new Error(`disconnectGoogleCalendar: ${resp.status}`);
  const j = (await resp.json()) as { settings?: Record<string, unknown> };
  return unwrapSettings(j.settings ?? {});
}

export function openExternalUrl(url: string): void {
  if (typeof window !== 'undefined' && window.hone?.shell?.openExternal) {
    void window.hone.shell.openExternal(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
