// REST client for project-druzya notes service (/v1/notes/*).
import { API_BASE_URL, DEV_BEARER_TOKEN } from '@shared/api/config';
import { useSessionStore } from '@shared/model/session';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface Note {
  id: string;
  title: string;
  bodyMd: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  sizeBytes: number;
  folderId: string | null;
  encrypted: boolean;
  aiExcluded: boolean;
}

export interface NoteSummary {
  id: string;
  title: string;
  updatedAt: Date | null;
  sizeBytes: number;
  folderId: string | null;
}

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

function nonEmpty(s: string | undefined | null): string | null {
  return s && s.length > 0 ? s : null;
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
  sizeBytes?: number;
  size_bytes?: number;
  folderId?: string;
  folder_id?: string;
  encrypted?: boolean;
};

type JsonNoteSummary = {
  id?: string;
  title?: string;
  updatedAt?: string;
  updated_at?: string;
  sizeBytes?: number;
  size_bytes?: number;
  folderId?: string;
  folder_id?: string;
};

type JsonFolder = {
  id?: string;
  name?: string;
  parentId?: string;
  parent_id?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

function unwrapNote(n: JsonNote): Note {
  return {
    id: n.id ?? '',
    title: n.title ?? '',
    bodyMd: n.bodyMd ?? n.body_md ?? '',
    createdAt: parseTs(n.createdAt ?? n.created_at),
    updatedAt: parseTs(n.updatedAt ?? n.updated_at),
    sizeBytes: n.sizeBytes ?? n.size_bytes ?? 0,
    folderId: nonEmpty(n.folderId ?? n.folder_id),
    encrypted: Boolean(n.encrypted),
    aiExcluded: false,
  };
}

function unwrapSummary(n: JsonNoteSummary): NoteSummary {
  return {
    id: n.id ?? '',
    title: n.title ?? '',
    updatedAt: parseTs(n.updatedAt ?? n.updated_at),
    sizeBytes: n.sizeBytes ?? n.size_bytes ?? 0,
    folderId: nonEmpty(n.folderId ?? n.folder_id),
  };
}

function unwrapFolder(f: JsonFolder): Folder {
  return {
    id: f.id ?? '',
    name: f.name ?? '',
    parentId: nonEmpty(f.parentId ?? f.parent_id),
    createdAt: parseTs(f.createdAt ?? f.created_at),
    updatedAt: parseTs(f.updatedAt ?? f.updated_at),
  };
}

export async function listNotes(args: {
  limit?: number;
  cursor?: string;
  folderId?: string | null;
} = {}): Promise<{ notes: NoteSummary[]; nextCursor: string }> {
  const params = new URLSearchParams();
  if (args.limit) params.set('limit', String(args.limit));
  if (args.cursor) params.set('cursor', args.cursor);
  if (args.folderId) params.set('folder_id', args.folderId);
  const qs = params.toString();
  const resp = await fetch(`${API_BASE_URL}/v1/notes${qs ? `?${qs}` : ''}`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`listNotes: ${resp.status}`);
  const j = (await resp.json()) as {
    notes?: JsonNoteSummary[];
    nextCursor?: string;
    next_cursor?: string;
  };
  return {
    notes: (j.notes ?? []).map(unwrapSummary),
    nextCursor: j.nextCursor ?? j.next_cursor ?? '',
  };
}

export async function getNote(id: string): Promise<Note> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/${encodeURIComponent(id)}`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`getNote: ${resp.status}`);
  const j = (await resp.json()) as { note?: JsonNote };
  return unwrapNote(j.note ?? {});
}

export async function createNote(
  title: string,
  bodyMd: string,
  folderId?: string | null,
): Promise<Note> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      title,
      body_md: bodyMd,
      folder_id: folderId ?? '',
    }),
  });
  if (!resp.ok) throw new Error(`createNote: ${resp.status}`);
  const j = (await resp.json()) as { note?: JsonNote };
  return unwrapNote(j.note ?? {});
}

export async function updateNote(id: string, title: string, bodyMd: string): Promise<Note> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ id, title, body_md: bodyMd }),
  });
  if (!resp.ok) throw new Error(`updateNote: ${resp.status}`);
  const j = (await resp.json()) as { note?: JsonNote };
  return unwrapNote(j.note ?? {});
}

export async function deleteNote(id: string): Promise<void> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`deleteNote: ${resp.status}`);
}

export async function moveNote(noteId: string, folderId: string | null): Promise<Note> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/${encodeURIComponent(noteId)}/move`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ note_id: noteId, folder_id: folderId ?? '' }),
  });
  if (!resp.ok) throw new Error(`moveNote: ${resp.status}`);
  const j = (await resp.json()) as { note?: JsonNote };
  return unwrapNote(j.note ?? {});
}

export async function listFolders(): Promise<Folder[]> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/folders`, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`listFolders: ${resp.status}`);
  const j = (await resp.json()) as { folders?: JsonFolder[] };
  return (j.folders ?? []).map(unwrapFolder);
}

export async function createFolder(name: string, parentId?: string | null): Promise<Folder> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/folders`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ name, parent_id: parentId ?? '' }),
  });
  if (!resp.ok) throw new Error(`createFolder: ${resp.status}`);
  const j = (await resp.json()) as { folder?: JsonFolder };
  return unwrapFolder(j.folder ?? {});
}

export async function deleteFolder(id: string, moveNotesToRoot = true): Promise<void> {
  const qs = moveNotesToRoot ? '?move_notes_to_root=true' : '?move_notes_to_root=false';
  const resp = await fetch(`${API_BASE_URL}/v1/notes/folders/${encodeURIComponent(id)}${qs}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`deleteFolder: ${resp.status}`);
}
