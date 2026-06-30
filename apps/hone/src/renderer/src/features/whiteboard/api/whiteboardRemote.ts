import { API_BASE_URL, DEV_BEARER_TOKEN } from '@shared/api/config';
import { apiFetch } from '@shared/api/http';
import { useSessionStore } from '@shared/model/session';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  const h: Record<string, string> = { 'content-type': 'application/json', ...extra };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return '';
}

export interface ShareWhiteboardResult {
  accessToken: string;
  inviteUrl: string;
  roomId: string;
  expiresIn: number;
}

export interface PublishWhiteboardResult {
  slug: string;
  url: string;
}

export async function remoteShareWhiteboard(
  sceneJson: string,
  title?: string,
): Promise<ShareWhiteboardResult> {
  const resp = await apiFetch(`${API_BASE_URL}/v1/rooms/share-whiteboard`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ scene_json: sceneJson, title: title ?? '' }),
  });
  if (!resp.ok) throw new Error(`shareWhiteboard: ${resp.status}`);
  const j = (await resp.json()) as Record<string, unknown>;
  const room = (j.room ?? {}) as Record<string, unknown>;
  const invite = (j.invite ?? {}) as Record<string, unknown>;
  return {
    accessToken: pickStr(j, 'accessToken', 'access_token'),
    inviteUrl: pickStr(invite, 'url'),
    roomId: pickStr(room, 'id'),
    expiresIn: Number(j.expiresIn ?? j.expires_in ?? 0),
  };
}

export async function remotePublishWhiteboard(
  sceneJson: string,
  title?: string,
): Promise<PublishWhiteboardResult> {
  const resp = await apiFetch(`${API_BASE_URL}/v1/rooms/publish-whiteboard`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ scene_json: sceneJson, title: title ?? '' }),
  });
  if (!resp.ok) throw new Error(`publishWhiteboard: ${resp.status}`);
  const j = (await resp.json()) as Record<string, unknown>;
  return {
    slug: pickStr(j, 'slug'),
    url: pickStr(j, 'url'),
  };
}
