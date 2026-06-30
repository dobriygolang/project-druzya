import { API_BASE_URL, DEV_BEARER_TOKEN } from '@shared/api/config';
import { apiFetch } from '@shared/api/http';
import { useSessionStore } from '@shared/model/session';

import type { Note, NoteSummary } from '../api/notesClient';
import type { StoredNote } from './notesStore';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  const h: Record<string, string> = { ...extra };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

function parseTs(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

type JsonNote = {
  id?: string;
  title?: string;
  bodyMd?: string;
  body_md?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  encrypted?: boolean;
  sizeBytes?: number;
  size_bytes?: number;
};

export type WireNote = Note & { encrypted: boolean };

function unwrapNote(n: JsonNote): WireNote {
  const bodyMd = n.bodyMd ?? n.body_md ?? '';
  return {
    id: n.id ?? '',
    title: n.title ?? '',
    bodyMd,
    createdAt: parseTs(n.createdAt ?? n.created_at),
    updatedAt: parseTs(n.updatedAt ?? n.updated_at),
    sizeBytes: n.sizeBytes ?? n.size_bytes ?? new TextEncoder().encode(bodyMd).length,
    encrypted: n.encrypted === true,
  };
}

function noteToStored(n: Note, userId: string, encrypted = false): StoredNote {
  return {
    userId,
    id: n.id,
    key: `${userId}::${n.id}`,
    title: n.title,
    bodyMd: n.bodyMd,
    createdAt: n.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: n.updatedAt?.toISOString() ?? new Date().toISOString(),
    deleted: false,
    atRestEncrypted: encrypted,
  };
}

export async function remoteListNotes(): Promise<NoteSummary[]> {
  const resp = await apiFetch(`${API_BASE_URL}/v1/notes`, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`listNotes: ${resp.status}`);
  const j = (await resp.json()) as { notes?: JsonNote[] };
  return (j.notes ?? []).map((n) => {
    const note = unwrapNote(n);
    return {
      id: note.id,
      title: note.title,
      updatedAt: note.updatedAt,
      sizeBytes: note.sizeBytes,
    };
  });
}

export async function remoteGetNote(id: string): Promise<WireNote> {
  const resp = await apiFetch(`${API_BASE_URL}/v1/notes/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`getNote: ${resp.status}`);
  const j = (await resp.json()) as { note?: JsonNote };
  return unwrapNote(j.note ?? {});
}

export async function remoteCreateNote(title: string, bodyMd: string): Promise<WireNote> {
  const resp = await apiFetch(`${API_BASE_URL}/v1/notes`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ title, body_md: bodyMd }),
  });
  if (!resp.ok) throw new Error(`createNote: ${resp.status}`);
  const j = (await resp.json()) as { note?: JsonNote };
  return unwrapNote(j.note ?? {});
}

export async function remoteUpdateNote(
  id: string,
  title: string,
  bodyMd: string,
): Promise<WireNote> {
  const resp = await apiFetch(`${API_BASE_URL}/v1/notes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ id, title, body_md: bodyMd }),
  });
  if (!resp.ok) throw new Error(`updateNote: ${resp.status}`);
  const j = (await resp.json()) as { note?: JsonNote };
  return unwrapNote(j.note ?? {});
}

export async function remoteDeleteNote(id: string): Promise<void> {
  const resp = await apiFetch(`${API_BASE_URL}/v1/notes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`deleteNote: ${resp.status}`);
}

export { noteToStored, unwrapNote };
