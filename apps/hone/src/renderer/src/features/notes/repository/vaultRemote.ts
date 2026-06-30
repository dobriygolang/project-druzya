import { API_BASE_URL, DEV_BEARER_TOKEN } from '@shared/api/config';
import { apiFetch } from '@shared/api/http';
import { useSessionStore } from '@shared/model/session';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  const h: Record<string, string> = { ...extra };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

export async function remoteEncryptNoteBody(noteId: string, ciphertextB64: string): Promise<void> {
  const resp = await apiFetch(
    `${API_BASE_URL}/v1/notes/vault/notes/${encodeURIComponent(noteId)}/encrypt`,
    {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ ciphertext_b64: ciphertextB64 }),
    },
  );
  if (!resp.ok) throw new Error(`encryptNote: ${resp.status}`);
}
