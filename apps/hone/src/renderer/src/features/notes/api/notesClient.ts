// Local-first notes — IndexedDB source of truth; background sync when enabled.
import { encryptText, isVaultUnlocked } from '@shared/crypto/vault';
import { isVaultEnabledSync } from '@shared/crypto/vaultPrefs';
import {
  notesStoreGet,
  notesStoreList,
  notesStoreSoftDelete,
  notesStoreUpsert,
} from '@features/notes/repository/notesStore';
import {
  remoteGetPublishStatus,
  remoteMakeNotePrivate,
  remoteShareNoteToWeb,
  remoteUnpublishNote,
  type PublishStatus,
} from '@features/notes/repository/publishRemote';
import { remoteUpdateNote } from '@features/notes/repository/notesRemote';
import { getServerId } from '@shared/sync/idMap';
import { enqueueOutbox } from '@shared/sync/outbox';
import { scheduleSync, syncNow } from '@shared/sync/SyncEngine';
import { isSyncEnabled } from '@shared/sync/syncConfig';

export type { PublishStatus };

export interface Note {
  id: string;
  title: string;
  bodyMd: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  sizeBytes: number;
  /** True when E2EE vault is on but passphrase was not entered yet. */
  vaultLocked?: boolean;
}

export interface NoteSummary {
  id: string;
  title: string;
  updatedAt: Date | null;
  sizeBytes: number;
  vaultLocked?: boolean;
}

export function isNoteVaultLocked(note: Pick<NoteSummary, 'vaultLocked'>): boolean {
  return note.vaultLocked === true;
}

export async function listNotes(_args: {
  limit?: number;
  cursor?: string;
} = {}): Promise<{ notes: NoteSummary[]; nextCursor: string }> {
  void _args;
  const notes = await notesStoreList();
  return { notes, nextCursor: '' };
}

async function resolveNote(id: string): Promise<Note | null> {
  const direct = await notesStoreGet(id);
  if (direct) return direct;
  const serverId = await getServerId('notes', id);
  if (serverId && serverId !== id) return notesStoreGet(serverId);
  return null;
}

export async function getNote(id: string): Promise<Note> {
  const note = await resolveNote(id);
  if (!note) throw new Error(`Note not found: ${id}`);
  return note;
}

export async function createNote(title: string, bodyMd: string): Promise<Note> {
  const id = crypto.randomUUID();
  const note = await notesStoreUpsert(id, title, bodyMd);
  if (isSyncEnabled()) {
    await enqueueOutbox('notes', 'create', id, { title, bodyMd });
    scheduleSync();
  }
  return note;
}

export async function updateNote(id: string, title: string, bodyMd: string): Promise<Note> {
  const note = await notesStoreUpsert(id, title, bodyMd);
  if (isSyncEnabled()) {
    await enqueueOutbox('notes', 'update', id, { title, bodyMd });
    scheduleSync();
  }
  return note;
}

async function resolveServerNoteId(localId: string, forceSync = true): Promise<string> {
  if (!isSyncEnabled()) throw new Error('Cloud sync required to publish notes');
  if (forceSync) await syncNow();
  const mapped = await getServerId('notes', localId);
  return mapped ?? localId;
}

export async function getPublishStatus(noteId: string): Promise<PublishStatus> {
  const serverId = await resolveServerNoteId(noteId, false);
  return remoteGetPublishStatus(serverId);
}

export async function publishNoteToWeb(noteId: string): Promise<PublishStatus> {
  const serverId = await resolveServerNoteId(noteId);
  const note = await getNote(noteId);
  await remoteUpdateNote(serverId, note.title, note.bodyMd);
  const res = await remoteShareNoteToWeb(serverId, note.bodyMd);
  return {
    published: true,
    slug: res.slug,
    url: res.url,
    publishedAt: res.publishedAt,
  };
}

export async function unpublishNoteFromWeb(noteId: string): Promise<void> {
  const serverId = await resolveServerNoteId(noteId);
  const note = await getNote(noteId);
  await remoteUnpublishNote(serverId);
  if (isVaultEnabledSync() && isVaultUnlocked()) {
    const encTitle = await encryptText(note.title);
    const encBody = await encryptText(note.bodyMd);
    await remoteMakeNotePrivate(serverId, encBody);
    await remoteUpdateNote(serverId, encTitle, encBody);
  } else {
    await remoteUpdateNote(serverId, note.title, note.bodyMd);
  }
}

export async function regeneratePublicLink(noteId: string): Promise<PublishStatus> {
  await remoteUnpublishNote(await resolveServerNoteId(noteId));
  return publishNoteToWeb(noteId);
}

export async function deleteNote(id: string): Promise<void> {
  await notesStoreSoftDelete(id);
  if (isSyncEnabled()) {
    await enqueueOutbox('notes', 'delete', id, {});
    scheduleSync();
  }
}
