import { requireUserId } from '@shared/db/honeDb';
import {
  decryptNoteFromRemote,
  encryptNoteForRemote,
} from '@features/notes/crypto/noteCrypto';
import {
  noteToStored,
  remoteCreateNote,
  remoteDeleteNote,
  remoteGetNote,
  remoteListNotes,
  remoteUpdateNote,
} from '@features/notes/repository/notesRemote';
import { remoteEncryptNoteBody } from '@features/notes/repository/vaultRemote';
import {
  notesStoreMergeRemote,
  notesStoreReplaceId,
} from '@features/notes/repository/notesStore';
import { isVaultUnlocked } from '@shared/crypto/vault';
import { isVaultEnabledSync } from '@shared/crypto/vaultPrefs';
import { resolveEntityId, setServerId } from '@shared/sync/idMap';
import { removeOutbox } from '@shared/sync/outbox';
import type { OutboxEntry } from '@shared/sync/types';

function useE2eePush(): boolean {
  return isVaultEnabledSync() && isVaultUnlocked();
}

async function pushEncryptedNote(
  serverId: string,
  title: string,
  bodyMd: string,
): Promise<void> {
  const { encTitle, encBody } = await encryptNoteForRemote(title, bodyMd);
  await remoteUpdateNote(serverId, encTitle, encBody);
  await remoteEncryptNoteBody(serverId, encBody);
}

async function pushPlainNote(serverId: string, title: string, bodyMd: string): Promise<void> {
  await remoteUpdateNote(serverId, title, bodyMd);
}

export async function pushNotesOutbox(entry: OutboxEntry): Promise<void> {
  const userId = requireUserId();
  const payload = entry.payload as Record<string, unknown>;
  const title = String(payload.title ?? 'Untitled');
  const bodyMd = String(payload.bodyMd ?? '');
  const e2ee = useE2eePush();

  if (isVaultEnabledSync() && !isVaultUnlocked()) {
    throw new Error('Vault locked — unlock in Settings to sync encrypted notes');
  }

  if (entry.op === 'create') {
    if (e2ee) {
      const { encTitle, encBody } = await encryptNoteForRemote(title, bodyMd);
      const created = await remoteCreateNote(encTitle, encBody);
      await remoteEncryptNoteBody(created.id, encBody);
      await setServerId('notes', entry.entityId, created.id, userId);
      const plain = await decryptNoteFromRemote({ ...created, encrypted: true });
      await notesStoreReplaceId(entry.entityId, plain);
    } else {
      const created = await remoteCreateNote(title, bodyMd);
      await setServerId('notes', entry.entityId, created.id, userId);
      await notesStoreReplaceId(entry.entityId, created);
    }
    await removeOutbox(entry.id, userId);
    return;
  }

  const serverId = await resolveEntityId('notes', entry.entityId, userId);

  if (entry.op === 'update') {
    if (e2ee) {
      await pushEncryptedNote(serverId, title, bodyMd);
      const wire = await remoteGetNote(serverId);
      const plain = await decryptNoteFromRemote(wire);
      await notesStoreMergeRemote(noteToStored(plain, userId, true));
    } else {
      await pushPlainNote(serverId, title, bodyMd);
      const wire = await remoteGetNote(serverId);
      await notesStoreMergeRemote(noteToStored(wire, userId, false));
    }
    await removeOutbox(entry.id, userId);
    return;
  }

  if (entry.op === 'delete') {
    await remoteDeleteNote(serverId);
    await removeOutbox(entry.id, userId);
  }
}

export async function pullNotes(): Promise<void> {
  const userId = requireUserId();
  const e2ee = isVaultEnabledSync();
  const summaries = await remoteListNotes();
  for (const s of summaries) {
    try {
      const wire = await remoteGetNote(s.id);
      if (wire.encrypted) {
        if (!e2ee || !isVaultUnlocked()) continue;
        const plain = await decryptNoteFromRemote(wire);
        await notesStoreMergeRemote(noteToStored(plain, userId, true));
      } else {
        await notesStoreMergeRemote(noteToStored(wire, userId, false));
      }
    } catch {
      /* skip until vault unlocked or corrupt row */
    }
  }
}

/** Re-push all local notes as encrypted after enabling vault. */
export async function pushAllNotesEncrypted(): Promise<void> {
  if (!isVaultEnabledSync() || !isVaultUnlocked()) return;
  const { notesStoreAll, decryptAtRest } = await import('@features/notes/repository/notesStore');
  const { getServerId } = await import('@shared/sync/idMap');
  const userId = requireUserId();
  const rows = await notesStoreAll(userId);
  for (const row of rows) {
    if (row.deleted) continue;
    const plain = await decryptAtRest(row);
    const serverId = (await getServerId('notes', row.id)) ?? row.id;
    await pushEncryptedNote(serverId, plain.title, plain.bodyMd);
  }
}
