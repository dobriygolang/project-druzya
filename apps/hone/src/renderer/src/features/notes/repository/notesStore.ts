import {
  dbDelete,
  dbGet,
  dbGetAllByUser,
  dbPut,
  entityKey,
  requireUserId,
} from '@shared/db/honeDb';
import { isVaultUnlocked } from '@shared/crypto/vault';
import { isVaultEnabledSync } from '@shared/crypto/vaultPrefs';

import { decryptNoteFields, encryptNoteFields } from '../crypto/noteCrypto';
import type { Note, NoteSummary } from '../api/notesClient';

export interface StoredNote {
  userId: string;
  id: string;
  key: string;
  title: string;
  bodyMd: string;
  createdAt: string;
  updatedAt: string;
  deleted?: boolean;
  /** Plaintext fields encrypted at rest in IndexedDB. */
  atRestEncrypted?: boolean;
}

function parseTs(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function bodySize(bodyMd: string): number {
  return new TextEncoder().encode(bodyMd).length;
}

function toNote(row: StoredNote & { vaultLocked?: boolean }): Note {
  return {
    id: row.id,
    title: row.title,
    bodyMd: row.bodyMd,
    createdAt: parseTs(row.createdAt),
    updatedAt: parseTs(row.updatedAt),
    sizeBytes: bodySize(row.bodyMd),
    vaultLocked: row.vaultLocked,
  };
}

function toSummary(row: StoredNote & { vaultLocked?: boolean }): NoteSummary {
  return {
    id: row.id,
    title: row.title,
    updatedAt: parseTs(row.updatedAt),
    sizeBytes: bodySize(row.bodyMd),
    vaultLocked: row.vaultLocked,
  };
}

function rowFrom(userId: string, partial: Omit<StoredNote, 'key' | 'userId'>): StoredNote {
  return { ...partial, userId, key: entityKey(partial.id, userId) };
}

async function encryptAtRest(
  userId: string,
  partial: Omit<StoredNote, 'key' | 'userId' | 'atRestEncrypted'>,
): Promise<StoredNote> {
  const base = rowFrom(userId, partial);
  if (!isVaultEnabledSync() || !isVaultUnlocked()) {
    return { ...base, atRestEncrypted: false };
  }
  const { encTitle, encBody } = await encryptNoteFields(partial.title, partial.bodyMd);
  return {
    ...base,
    title: encTitle,
    bodyMd: encBody,
    atRestEncrypted: true,
  };
}

async function decryptAtRest(row: StoredNote): Promise<StoredNote & { vaultLocked?: boolean }> {
  if (!row.atRestEncrypted) return row;
  if (!isVaultEnabledSync() || !isVaultUnlocked()) {
    return { ...row, title: '', bodyMd: '', vaultLocked: true };
  }
  const { title, bodyMd } = await decryptNoteFields(row.title, row.bodyMd, true);
  return { ...row, title, bodyMd, vaultLocked: false };
}

export async function notesStoreList(userId?: string): Promise<NoteSummary[]> {
  const uid = userId ?? requireUserId();
  const rows = await dbGetAllByUser<StoredNote>('notes', uid);
  const out: NoteSummary[] = [];
  for (const row of rows) {
    if (row.deleted) continue;
    out.push(toSummary(await decryptAtRest(row)));
  }
  return out.sort(
    (a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0),
  );
}

export async function notesStoreGet(id: string, userId?: string): Promise<Note | null> {
  const uid = userId ?? requireUserId();
  const row = await dbGet<StoredNote>('notes', entityKey(id, uid));
  if (!row || row.deleted) return null;
  return toNote(await decryptAtRest(row));
}

export async function notesStorePut(note: StoredNote): Promise<void> {
  const enc = await encryptAtRest(note.userId, note);
  await dbPut('notes', enc);
}

export async function notesStoreUpsert(
  id: string,
  title: string,
  bodyMd: string,
  timestamps?: { createdAt?: string; updatedAt?: string },
): Promise<Note> {
  const userId = requireUserId();
  const existing = await dbGet<StoredNote>('notes', entityKey(id, userId));
  const now = new Date().toISOString();
  const row = await encryptAtRest(userId, {
    id,
    title,
    bodyMd,
    createdAt: timestamps?.createdAt ?? existing?.createdAt ?? now,
    updatedAt: timestamps?.updatedAt ?? now,
    deleted: false,
  });
  await dbPut('notes', row);
  return toNote(await decryptAtRest(row));
}

export async function notesStoreSoftDelete(id: string): Promise<void> {
  const userId = requireUserId();
  const existing = await dbGet<StoredNote>('notes', entityKey(id, userId));
  if (!existing) return;
  await dbPut('notes', {
    ...existing,
    deleted: true,
    updatedAt: new Date().toISOString(),
  });
}

export async function notesStoreMergeRemote(remote: StoredNote): Promise<void> {
  const userId = requireUserId();
  const local = await dbGet<StoredNote>('notes', entityKey(remote.id, userId));
  const rt = new Date(remote.updatedAt).getTime();
  const lt = local ? new Date(local.updatedAt).getTime() : 0;
  if (!local || rt >= lt) {
    const row = await encryptAtRest(userId, {
      id: remote.id,
      title: remote.title,
      bodyMd: remote.bodyMd,
      createdAt: remote.createdAt,
      updatedAt: remote.updatedAt,
      deleted: remote.deleted ?? false,
    });
    await dbPut('notes', row);
  }
}

/** Encrypt legacy plaintext rows after first vault unlock. */
export async function notesStoreReencryptAll(userId?: string): Promise<void> {
  const uid = userId ?? requireUserId();
  if (!isVaultEnabledSync() || !isVaultUnlocked()) return;
  const rows = await dbGetAllByUser<StoredNote>('notes', uid);
  for (const row of rows) {
    if (row.deleted || row.atRestEncrypted) continue;
    const plain = await decryptAtRest(row);
    const enc = await encryptAtRest(uid, plain);
    await dbPut('notes', enc);
  }
}

export async function notesStoreBulkImport(
  userId: string,
  records: Record<string, Omit<StoredNote, 'key' | 'userId'>>,
): Promise<void> {
  for (const row of Object.values(records)) {
    await dbPut('notes', rowFrom(userId, { ...row, deleted: false, atRestEncrypted: false }));
  }
}

export async function notesStoreAll(userId?: string): Promise<StoredNote[]> {
  const uid = userId ?? requireUserId();
  return dbGetAllByUser<StoredNote>('notes', uid);
}

export async function notesStoreReplaceId(oldId: string, note: Note): Promise<void> {
  const userId = requireUserId();
  await dbDelete('notes', entityKey(oldId, userId));
  const now = new Date().toISOString();
  const row = await encryptAtRest(userId, {
    id: note.id,
    title: note.title,
    bodyMd: note.bodyMd,
    createdAt: note.createdAt?.toISOString() ?? now,
    updatedAt: note.updatedAt?.toISOString() ?? now,
    deleted: false,
  });
  await dbPut('notes', row);
}

export { toNote, toSummary, rowFrom, decryptAtRest };
