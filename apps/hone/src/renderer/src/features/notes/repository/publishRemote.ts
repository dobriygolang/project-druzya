import { API_BASE_URL, DEV_BEARER_TOKEN } from '@shared/api/config';
import { apiFetch } from '@shared/api/http';
import { useSessionStore } from '@shared/model/session';

export interface PublishStatus {
  published: boolean;
  slug?: string;
  url?: string;
  publishedAt?: string;
}

export interface ShareToWebResult {
  slug: string;
  url: string;
  publishedAt: string;
  alreadyPublished: boolean;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  const h: Record<string, string> = { ...extra };
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

function pickBool(obj: Record<string, unknown>, ...keys: string[]): boolean {
  for (const k of keys) {
    if (obj[k] === true) return true;
  }
  return false;
}

export async function remoteGetPublishStatus(noteId: string): Promise<PublishStatus> {
  const resp = await apiFetch(
    `${API_BASE_URL}/v1/notes/${encodeURIComponent(noteId)}/publish-status`,
    { headers: authHeaders() },
  );
  if (!resp.ok) throw new Error(`publish status: ${resp.status}`);
  const j = (await resp.json()) as Record<string, unknown>;
  return {
    published: pickBool(j, 'published'),
    slug: pickStr(j, 'slug'),
    url: pickStr(j, 'url'),
    publishedAt: pickStr(j, 'publishedAt', 'published_at'),
  };
}

export async function remoteShareNoteToWeb(
  noteId: string,
  plaintextMd: string,
): Promise<ShareToWebResult> {
  const resp = await apiFetch(
    `${API_BASE_URL}/v1/notes/${encodeURIComponent(noteId)}/share-to-web`,
    {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ plaintext_md: plaintextMd }),
    },
  );
  if (!resp.ok) throw new Error(`shareToWeb: ${resp.status}`);
  const j = (await resp.json()) as Record<string, unknown>;
  return {
    slug: pickStr(j, 'slug'),
    url: pickStr(j, 'url'),
    publishedAt: pickStr(j, 'publishedAt', 'published_at'),
    alreadyPublished: pickBool(j, 'alreadyPublished', 'already_published'),
  };
}

export async function remoteUnpublishNote(noteId: string): Promise<void> {
  const resp = await apiFetch(
    `${API_BASE_URL}/v1/notes/${encodeURIComponent(noteId)}/unpublish`,
    {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ note_id: noteId }),
    },
  );
  if (!resp.ok) throw new Error(`unpublish: ${resp.status}`);
}

export async function remoteMakeNotePrivate(
  noteId: string,
  ciphertextB64: string,
): Promise<void> {
  const resp = await apiFetch(
    `${API_BASE_URL}/v1/notes/${encodeURIComponent(noteId)}/make-private`,
    {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ ciphertext_b64: ciphertextB64 }),
    },
  );
  if (!resp.ok) throw new Error(`makePrivate: ${resp.status}`);
}
