import { decryptText, encryptText } from '@shared/crypto/vault';

import type { Note } from '../api/notesClient';

/** Wire note with optional server encryption flag. */
export type WireNote = Note & { encrypted?: boolean };

export async function encryptNoteFields(
  title: string,
  bodyMd: string,
): Promise<{ encTitle: string; encBody: string }> {
  const [encTitle, encBody] = await Promise.all([encryptText(title), encryptText(bodyMd)]);
  return { encTitle, encBody };
}

export async function decryptNoteFields(
  titleCipher: string,
  bodyCipher: string,
  titleLikelyEncrypted = true,
): Promise<{ title: string; bodyMd: string }> {
  const bodyMd = await decryptText(bodyCipher);
  let title = titleCipher;
  if (titleLikelyEncrypted) {
    try {
      title = await decryptText(titleCipher);
    } catch {
      /* legacy: title was plaintext on server */
    }
  }
  return { title, bodyMd };
}

export async function decryptNoteFromRemote(note: WireNote): Promise<Note> {
  if (!note.encrypted) {
    return note;
  }
  const { title, bodyMd } = await decryptNoteFields(note.title, note.bodyMd, true);
  return {
    ...note,
    title,
    bodyMd,
    sizeBytes: new TextEncoder().encode(bodyMd).length,
  };
}

export async function encryptNoteForRemote(
  title: string,
  bodyMd: string,
): Promise<{ encTitle: string; encBody: string }> {
  return encryptNoteFields(title, bodyMd);
}
