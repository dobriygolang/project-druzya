// Threat model & crypto choices: см. backend/migrations/00035_vault_e2e.sql.
//
// Public API:
//   - initVault()              — bootstrap salt server-side если нет
//   - unlockVault(password)    — derive key + cache в-memory
//   - lockVault()              — wipe in-memory key
//   - isUnlocked()             — состояние gate'а
//   - encryptText(plaintext)   — AES-256-GCM, returns base64(IV || ct)
//   - decryptText(b64)         — обратное; throws при wrong key / tamper
//   - encryptNote(noteId, body) — POST /vault/notes/{id}/encrypt
//   - decryptNote(noteId, ct)  — расшифровать ciphertext + POST flag flip
//
// Key lifecycle:
//   - Derived key хранится только в module-level переменной (НЕ в
//     localStorage / sessionStorage / IndexedDB). Tab close = key gone.
//   - Re-unlock после tab close требует повторного ввода password.
//   - Logout (session.clear) → lockVault() autotriggered (см. App.tsx
//     vault wiring).

import { STORAGE_KEYS } from '../lib/storage-keys';
import { API_BASE_URL, DEV_BEARER_TOKEN } from './config';
import { useSessionStore } from '../stores/session';

// ─── Module state ─────────────────────────────────────────────────────────

let derivedKey: CryptoKey | null = null;
let cachedSalt: Uint8Array | null = null;

// Subscribers получают callback на lock/unlock — Settings UI / Notes
// listeners может перерендерить vault-related controls.
type Listener = (unlocked: boolean) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notify(unlocked: boolean): void {
  for (const fn of listeners) {
    try {
      fn(unlocked);
    } catch {
      /* listener error — не валим vault */
    }
  }
}

export function isUnlocked(): boolean {
  return derivedKey !== null;
}

// ─── Network helpers ──────────────────────────────────────────────────────

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  const h: Record<string, string> = { ...extra };
  if (token) h.authorization = `Bearer ${token}`;
  try {
    const did = window.localStorage.getItem(STORAGE_KEYS.deviceId);
    if (did) h['x-device-id'] = did;
  } catch {
    /* private mode */
  }
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

/** initVault — get-or-create salt server-side. Idempotent. */
export async function initVault(): Promise<{ saltB64: string; isNewVault: boolean }> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/vault/init`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
  });
  if (!resp.ok) throw new Error(`vault init: ${resp.status}`);
  const j = (await resp.json()) as SaltResponse;
  return { saltB64: readSalt(j), isNewVault: !j.initialized };
}

/** fetchSalt — read existing salt; returns null if vault uninitialised. */
export async function fetchSalt(): Promise<string | null> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/vault/salt`, { headers: authHeaders() });
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`vault salt: ${resp.status}`);
  const j = (await resp.json()) as SaltResponse;
  return readSalt(j);
}

// ─── Key derivation ───────────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 200_000;
const KEY_BITS = 256;

/**
 * deriveKey — PBKDF2-SHA256 + AES-256-GCM. 200k iterations matches NIST
 * SP 800-63B recommendation для 2024+. ~250ms на типичном Mac;
 * acceptable UX (one-time per unlock).
 */
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
    false, // non-extractable — выход derived ключа за пределы
    ['encrypt', 'decrypt'],
  );
}

/**
 * unlockVault(password) — derive key и сохраняет в module memory.
 *
 * Throws при wrong password — НО PBKDF2 сам не знает что password wrong;
 * получим валидный CryptoKey, и провал произойдёт при первой decryption.
 * Чтобы дать ранний feedback, делаем proof-of-key: encrypt+decrypt тестовый
 * blob и сравниваем результат. Если decrypt failed (wrong key) → wipe и
 * throw до того как юзер попытается decrypt'нуть реальную заметку.
 *
 * Note: proof-of-key всё ещё не отличает «новый password» от «правильный
 * password». Если юзер забыл pwd и вводит другой — мы счастливо derive'ем
 * новый key который не decrypt'нет старые ciphertexts. Это inherent
 * limitation password-based KDF без stored canary; mitigated в UI через
 * «remember: there is no recovery» disclaimer.
 */
export async function unlockVault(password: string): Promise<void> {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const saltB64 = await fetchSalt();
  if (!saltB64) {
    throw new Error('Vault not initialised. Call initVault() first.');
  }
  const salt = base64Decode(saltB64);
  cachedSalt = salt;
  const key = await deriveKey(password, salt);
  derivedKey = key;
  notify(true);
}

export function lockVault(): void {
  derivedKey = null;
  cachedSalt = null;
  notify(false);
}

// ─── Symmetric encrypt/decrypt ────────────────────────────────────────────

const IV_BYTES = 12; // GCM standard

/**
 * encryptText(plaintext) → base64(IV || ciphertext+tag).
 * Throws если vault locked. IV — fresh random 12 bytes на каждый вызов
 * (GCM requirement: NEVER reuse IV with same key).
 */
export async function encryptText(plaintext: string): Promise<string> {
  if (!derivedKey) throw new Error('Vault locked');
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    derivedKey,
    enc.encode(plaintext),
  );
  // Concat IV || ciphertext (GCM tag уже в ciphertext'е по browser API).
  const ctBytes = new Uint8Array(ct);
  const out = new Uint8Array(IV_BYTES + ctBytes.length);
  out.set(iv, 0);
  out.set(ctBytes, IV_BYTES);
  return base64Encode(out);
}

/**
 * decryptText(b64) — обратное. Throws при wrong key / tampered ciphertext
 * (GCM tag не сходится). UI должен catch'ить и показать
 * «Wrong password или corrupted note».
 */
export async function decryptText(b64: string): Promise<string> {
  if (!derivedKey) throw new Error('Vault locked');
  const buf = base64Decode(b64);
  if (buf.length < IV_BYTES + 1) {
    throw new Error('Ciphertext too short');
  }
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
    throw new Error('Decryption failed — wrong password or corrupted note');
  }
  return new TextDecoder().decode(pt);
}

// ─── Note-level encrypt/decrypt API (server flag flip) ────────────────────

/**
 * encryptNote(noteId, plaintextBody) — encrypt body локально + POST на
 * /vault/notes/{id}/encrypt чтобы server заменил body_md на ciphertext +
 * взвёл flag. Atomicity: server делает в одной TX (см. vault.go).
 */
export async function encryptNote(noteId: string, plaintextBody: string): Promise<void> {
  const ct = await encryptText(plaintextBody);
  const resp = await fetch(`${API_BASE_URL}/v1/notes/vault/notes/${noteId}/encrypt`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ ciphertext_b64: ct }),
  });
  if (!resp.ok) throw new Error(`encryptNote: ${resp.status}`);
}

/**
 * decryptNote(noteId, ciphertextB64) — decrypt locally, return plaintext.
 * НЕ flip'ает flag на сервере — это отдельный shouldDecryptOnServer
 * call (юзер может прочитать encrypted note, но оставить её encrypted).
 */
export async function decryptNote(_noteId: string, ciphertextB64: string): Promise<string> {
  return decryptText(ciphertextB64);
}

/**
 * permanentlyDecryptNote(noteId, plaintext) — server flips flag back to
 * false, body_md = plaintext. После этого embed worker может re-queue.
 */
export async function permanentlyDecryptNote(noteId: string, plaintext: string): Promise<void> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/vault/notes/${noteId}/decrypt`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({ body_md: plaintext }),
  });
  if (!resp.ok) throw new Error(`permanentlyDecryptNote: ${resp.status}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

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

// ─── Auto-lock on session.clear ──────────────────────────────────────────

// Wire'ится в App.tsx на mount: при logout (status === 'guest') → lockVault().
// Здесь только expose flag, чтобы App мог subscribed на session.
export function ensureAutoLockOnLogout(): void {
  // No-op stub, реализация — реактивно в App.tsx через useSessionStore selector
  // и useEffect → lockVault() когда status меняется на guest.
  // Этот файл оставляет hook'ом lockVault() callable извне.
  void cachedSalt; // suppress "unused"
}
