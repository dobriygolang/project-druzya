/**
 * E2EE vault — PBKDF2-SHA256 (200k) + AES-256-GCM.
 * Derived key lives in module memory only; cleared on lock / logout.
 */
import { LOCAL_ONLY } from '@app/config/features';
import { API_BASE_URL, DEV_BEARER_TOKEN } from '@shared/api/config';
import { apiFetch } from '@shared/api/http';
import { dbGet, dbPut, requireUserId } from '@shared/db/honeDb';
import { useSessionStore } from '@shared/model/session';

let derivedKey: CryptoKey | null = null;
let cachedSalt: Uint8Array | null = null;

type Listener = (unlocked: boolean) => void;
const listeners = new Set<Listener>();

export function subscribeVault(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify(unlocked: boolean): void {
  for (const fn of listeners) {
    try {
      fn(unlocked);
    } catch {
      /* ignore */
    }
  }
}

export function isVaultUnlocked(): boolean {
  return derivedKey !== null;
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  const h: Record<string, string> = { ...extra };
  if (token) h.authorization = `Bearer ${token}`;
  return h;
}

interface SaltResponse {
  saltB64?: string;
  salt_b64?: string;
  initialized?: boolean;
}

function readSalt(j: SaltResponse): string {
  return j.saltB64 ?? j.salt_b64 ?? '';
}

export async function initVault(): Promise<{ saltB64: string; isNewVault: boolean }> {
  try {
    const resp = await apiFetch(`${API_BASE_URL}/v1/notes/vault/init`, {
      method: 'POST',
      headers: authHeaders({ 'content-type': 'application/json' }),
      body: '{}',
    });
    if (!resp.ok) throw new Error(`vault init: ${resp.status}`);
    const j = (await resp.json()) as SaltResponse;
    const saltB64 = readSalt(j);
    await cacheLocalSalt(saltB64);
    return { saltB64, isNewVault: !j.initialized };
  } catch (err) {
    if (!LOCAL_ONLY) throw err;
    const { saltB64, isNew } = await initLocalVaultSalt();
    return { saltB64, isNewVault: isNew };
  }
}

function localSaltKey(userId: string): string {
  return `${userId}::vault_salt_local`;
}

async function cacheLocalSalt(saltB64: string): Promise<void> {
  const userId = requireUserId();
  await dbPut('meta', { key: localSaltKey(userId), userId, saltB64 });
}

async function initLocalVaultSalt(): Promise<{ saltB64: string; isNew: boolean }> {
  const userId = requireUserId();
  const key = localSaltKey(userId);
  const existing = await dbGet<{ saltB64: string }>('meta', key);
  if (existing?.saltB64) return { saltB64: existing.saltB64, isNew: false };
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const saltB64 = base64Encode(salt);
  await dbPut('meta', { key, userId, saltB64 });
  return { saltB64, isNew: true };
}

export async function fetchVaultSalt(): Promise<string | null> {
  try {
    const resp = await apiFetch(`${API_BASE_URL}/v1/notes/vault/salt`, { headers: authHeaders() });
    if (resp.status === 404) {
      if (LOCAL_ONLY) {
        const local = await dbGet<{ saltB64: string }>('meta', localSaltKey(requireUserId()));
        return local?.saltB64 ?? null;
      }
      return null;
    }
    if (!resp.ok) throw new Error(`vault salt: ${resp.status}`);
    const j = (await resp.json()) as SaltResponse;
    const saltB64 = readSalt(j);
    await cacheLocalSalt(saltB64);
    return saltB64;
  } catch {
    if (!LOCAL_ONLY) throw new Error('Vault unreachable');
    const local = await dbGet<{ saltB64: string }>('meta', localSaltKey(requireUserId()));
    return local?.saltB64 ?? null;
  }
}

const PBKDF2_ITERATIONS = 200_000;
const KEY_BITS = 256;
const IV_BYTES = 12;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function unlockVault(passphrase: string): Promise<void> {
  if (passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters');
  }
  const saltB64 = await fetchVaultSalt();
  if (!saltB64) {
    throw new Error('Vault not initialised');
  }
  cachedSalt = base64Decode(saltB64);
  derivedKey = await deriveKey(passphrase, cachedSalt);
  notify(true);
}

export function lockVault(): void {
  derivedKey = null;
  cachedSalt = null;
  notify(false);
}

export async function encryptText(plaintext: string): Promise<string> {
  if (!derivedKey) throw new Error('Vault locked');
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    derivedKey,
    enc.encode(plaintext),
  );
  const ctBytes = new Uint8Array(ct);
  const out = new Uint8Array(IV_BYTES + ctBytes.length);
  out.set(iv, 0);
  out.set(ctBytes, IV_BYTES);
  return base64Encode(out);
}

export async function decryptText(b64: string): Promise<string> {
  if (!derivedKey) throw new Error('Vault locked');
  const buf = base64Decode(b64);
  if (buf.length <= IV_BYTES) throw new Error('Invalid ciphertext');
  const iv = buf.slice(0, IV_BYTES);
  const ct = buf.slice(IV_BYTES);
  let pt: ArrayBuffer;
  try {
    pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      derivedKey,
      ct as BufferSource,
    );
  } catch {
    throw new Error('Decryption failed — wrong passphrase or corrupted data');
  }
  return new TextDecoder().decode(pt);
}

function base64Encode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
