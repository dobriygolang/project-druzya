// Cloud storage quota from billing (`GET /v1/billing/me`) + notes service usage.
import { STORAGE_KEYS } from '../lib/storage-keys';
import { API_BASE_URL, DEV_BEARER_TOKEN } from './config';
import { deleteNote, listNotes } from './notesClient';
import { useSessionStore } from '../stores/session';

// ─── Types ────────────────────────────────────────────────────────────────

export type StorageTier = 'free' | 'seeker' | 'ascended' | 'pro' | 'pro_plus';

export interface StorageQuota {
  usedNotes: number;
  limitNotes: number | null;
  usedBytes: number;
  tier: StorageTier;
}

// ─── Public API ───────────────────────────────────────────────────────────

export async function getStorageQuota(): Promise<StorageQuota> {
  const headers = authHeaders();
  const [billingResp, metaResp] = await Promise.all([
    fetch(`${API_BASE_URL}/v1/billing/me`, { headers }),
    fetch(`${API_BASE_URL}/v1/notes/meta`, { headers }),
  ]);
  if (!billingResp.ok) {
    throw new Error(`billing me: ${billingResp.status}`);
  }
  const billing = (await billingResp.json()) as {
    planSlug?: string;
    plan_slug?: string;
    limits?: Record<string, { limit?: number; unlimited?: boolean }>;
  };
  const meta = metaResp.ok
    ? ((await metaResp.json()) as { notes?: Array<{ id?: string }> })
    : { notes: [] };
  const noteCount = meta.notes?.length ?? 0;
  const cloud = billing.limits?.cloud_notes_count;
  const limitNotes =
    cloud?.unlimited || cloud?.limit == null ? null : (cloud.limit ?? null);
  return {
    usedNotes: noteCount,
    limitNotes,
    usedBytes: 0,
    tier: normalizeTier(billing.planSlug ?? billing.plan_slug),
  };
}

// normalizeTier — backward compat: legacy `pro`/`pro_plus` → `seeker`/`ascended`.
function normalizeTier(t: unknown): StorageTier {
  if (typeof t !== 'string') return 'free';
  if (t === 'pro') return 'seeker';
  if (t === 'pro_plus') return 'ascended';
  if (t === 'free' || t === 'seeker' || t === 'ascended') return t;
  return 'free';
}

// formatBytes — компактный «1.4 GB / 1 GB» формат для usage-bar'а.
export function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function tierLabel(tier: StorageTier): string {
  switch (tier) {
    case 'seeker':
    case 'pro': // legacy alias
      return 'Seeker';
    case 'ascended':
    case 'pro_plus': // legacy alias
      return 'Ascended';
    default:
      return 'Free';
  }
}

// ─── Internals ────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
  const h: Record<string, string> = {};
  if (token) h.authorization = `Bearer ${token}`;
  try {
    const did = window.localStorage.getItem(STORAGE_KEYS.deviceId);
    if (did) h['x-device-id'] = did;
  } catch {
    /* private mode / quota — skip */
  }
  return h;
}

// ─── Archive ──────────────────────────────────────────────────────────────

/** Archives the N least-recently-updated active notes. Returns count archived. */
export async function archiveOldestNotes(count = 10): Promise<number> {
  const all: Awaited<ReturnType<typeof listNotes>>['notes'] = [];
  let cursor = '';
  for (;;) {
    const page = await listNotes({ limit: 200, cursor: cursor || undefined });
    all.push(...page.notes);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  if (all.length === 0) return 0;
  const sorted = [...all].sort((a, b) => {
    const at = a.updatedAt?.getTime() ?? 0;
    const bt = b.updatedAt?.getTime() ?? 0;
    return at - bt;
  });
  const victims = sorted.slice(0, count);
  for (const n of victims) {
    await deleteNote(n.id);
  }
  return victims.length;
}

export async function archiveNote(id: string): Promise<void> {
  await deleteNote(id);
}

// ─── Quota error detection ────────────────────────────────────────────────
//
// Backend возвращает 413 Payload Too Large с body
// {error:{code:"quota_exceeded", usedBytes, quotaBytes, tier}}.
// Connect-RPC оборачивает HTTP-ошибки в ConnectError с code=resource_exhausted —
// проверяем оба варианта (REST путь и Connect путь).

export interface QuotaExceeded {
  usedNotes: number;
  limitNotes: number | null;
  tier: StorageTier;
}

export function isQuotaExceeded(err: unknown): QuotaExceeded | null {
  if (!err) return null;
  const e = err as { code?: string; rawMessage?: string; message?: string };
  if (e.code === 'resource_exhausted' || e.code === 'quota_exceeded') {
    return parseQuotaPayload(e.rawMessage ?? e.message ?? '');
  }
  if ((e.message ?? '').includes('413') || (e.message ?? '').includes('429')) {
    return { usedNotes: 0, limitNotes: null, tier: 'free' };
  }
  return null;
}

function parseQuotaPayload(raw: string): QuotaExceeded | null {
  try {
    const parsed = JSON.parse(raw) as { usedNotes?: number; limitNotes?: number; tier?: string };
    return {
      usedNotes: Number(parsed.usedNotes ?? 0),
      limitNotes: parsed.limitNotes ?? null,
      tier: (parsed.tier as StorageTier) || 'free',
    };
  } catch {
    return { usedNotes: 0, limitNotes: null, tier: 'free' };
  }
}

// ─── Devices (local id only; multi-device sync TBD) ─────────────────────────

export type DevicePlatform = 'mac' | 'ios' | 'android' | 'web' | 'linux' | 'windows';

export interface Device {
  id: string;
  name: string;
  platform: DevicePlatform;
  appVersion: string;
  lastSeenAt: string;
  createdAt: string;
}

export async function registerDevice(input: {
  name: string;
  platform: DevicePlatform;
  appVersion: string;
}): Promise<Device> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    id,
    name: input.name,
    platform: input.platform,
    appVersion: input.appVersion,
    lastSeenAt: now,
    createdAt: now,
  };
}

export async function listDevices(): Promise<Device[]> {
  const id = window.localStorage.getItem(STORAGE_KEYS.deviceId);
  if (!id) return [];
  return [
    {
      id,
      name: 'This device',
      platform: 'mac',
      appVersion: '0.0.1',
      lastSeenAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];
}

export async function revokeDevice(id: string): Promise<void> {
  const current = window.localStorage.getItem(STORAGE_KEYS.deviceId);
  if (current === id) {
    window.localStorage.removeItem(STORAGE_KEYS.deviceId);
  }
}

/** Thrown when Free-tier hits 1-device cap. UI catches and shows upgrade. */
export class DeviceLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeviceLimitError';
  }
}

// ─── Publish / unpublish ──────────────────────────────────────────────────

export interface PublishStatus {
  published: boolean;
  slug?: string;
  url?: string;
  publishedAt?: string;
}

export async function publishNote(noteId: string): Promise<PublishStatus> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/${noteId}/publish`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`publish: ${resp.status}`);
  const j = (await resp.json()) as { slug: string; url: string; publishedAt: string };
  return { published: true, slug: j.slug, url: j.url, publishedAt: j.publishedAt };
}

export async function unpublishNote(noteId: string): Promise<void> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/${noteId}/unpublish`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`unpublish: ${resp.status}`);
}

export async function getPublishStatus(noteId: string): Promise<PublishStatus> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/${noteId}/publish-status`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`publish status: ${resp.status}`);
  return (await resp.json()) as PublishStatus;
}

// ─── Atomic share-to-web / make-private ───────────────────────────────────
//
// Combined flows that replace the legacy two-step (decrypt → publish) and
// (encrypt → unpublish) UX. The client owns crypto: shareToWeb takes a
// plaintext body the user just decrypted locally; makePrivate takes a
// freshly encrypted ciphertext blob. The server applies both writes in a
// single transaction so other devices never see the intermediate state.

export interface ShareToWebResult {
  slug: string;
  url: string;
  publishedAt: string;
  alreadyPublished: boolean;
}

export async function shareNoteToWeb(noteId: string, plaintextMd: string): Promise<ShareToWebResult> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/${noteId}/share-to-web`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ plaintext_md: plaintextMd }),
  });
  if (!resp.ok) throw new Error(`shareToWeb: ${resp.status}`);
  return (await resp.json()) as ShareToWebResult;
}

export async function makeNotePrivate(noteId: string, ciphertextB64: string): Promise<void> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/${noteId}/make-private`, {
    method: 'POST',
    headers: { ...authHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ ciphertext_b64: ciphertextB64 }),
  });
  if (!resp.ok) throw new Error(`makePrivate: ${resp.status}`);
}

// Возвращает per-note flags (encrypted, published) для всех active notes.
// Используется sidebar'ом для отрисовки lock-icons без N+1 hover-запросов.

export interface NoteMeta {
  id: string;
  encrypted: boolean;
  published: boolean;
}

export async function getNotesMeta(): Promise<NoteMeta[]> {
  const resp = await fetch(`${API_BASE_URL}/v1/notes/meta`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`notes meta: ${resp.status}`);
  const j = (await resp.json()) as { notes: NoteMeta[] };
  return j.notes ?? [];
}
