// Server — dumb storage (см. backend/services/yjs_notes.go). Все
// CRDT semantics здесь, на клиенте: формируем Y.Doc, observe local
// changes → POST /append, polling /updates → applyUpdate.
//
// Один Y.Doc per note живёт пока заметка открыта. На переключение
// заметки старый dispose'ится, новый создаётся.
//
// Bandwidth: append body — raw binary update (~50-500 байт типичная
// keystroke-delta), GET /updates — base64-кодированные, ~33% overhead
// который мы принимаем чтобы не тащить multipart/streaming.

import * as Y from 'yjs';

import { STORAGE_KEYS } from '../lib/storage-keys';
import { API_BASE_URL, DEV_BEARER_TOKEN } from './config';
import { useSessionStore } from '../stores/session';

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

export interface YjsUpdate {
  seq: number;
  data: Uint8Array;
  originDeviceId: string | null;
  createdAt: string;
}

interface UpdatesResponse {
  updates: Array<{
    seq: number;
    dataB64: string;
    originDeviceId?: string;
    createdAt: string;
  }>;
  latestSeq: number;
  truncated: boolean;
}

/** Yjs entity kind. Map to backend URL slug. Phase C-6 / C-6.1. */
export type YjsKind = 'notes' | 'whiteboards';

/**
 * Append один Yjs update message. Server возвращает `seq` (используется
 * в качестве cursor для последующих pull'ов).
 *
 * Note: server limit 1 MiB на update. Yjs deltas почти всегда меньше
 * килобайта, в 1 MiB упрёмся только если pasting огромного текста — и
 * это нормально fail с 413, юзер увидит "Failed to save".
 */
// yjsBackoffUntilMs — global cooldown после 503/429 на любом yjs-endpoint'е.
// Без cooldown'а CodeMirror→Yjs→append на каждый keystroke превращается
// в storm 503'ов когда backend временно недоступен (deploy, upstream
// killswitch). Yjs не теряет updates (они в local Y.Doc), и pending
// state долетит когда backend оживёт.
let yjsBackoffUntilMs = 0;
const YJS_BACKOFF_MS_503 = 30_000; // 30s — деплой backend'а обычно ≤30s
const YJS_BACKOFF_MS_429 = 60_000; // 60s — rate-limit cooldown

function applyBackoffFromStatus(status: number): void {
  const now = Date.now();
  if (status === 503 || status === 502 || status === 504) {
    yjsBackoffUntilMs = Math.max(yjsBackoffUntilMs, now + YJS_BACKOFF_MS_503);
  } else if (status === 429) {
    yjsBackoffUntilMs = Math.max(yjsBackoffUntilMs, now + YJS_BACKOFF_MS_429);
  }
}

export async function appendUpdate(kind: YjsKind, parentId: string, update: Uint8Array): Promise<{ seq: number; createdAt: string }> {
  if (Date.now() < yjsBackoffUntilMs) {
    throw new Error('yjs append: backoff (server unavailable)');
  }
  const resp = await fetch(`${API_BASE_URL}/api/v1/sync/yjs/${kind}/${parentId}/append`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/octet-stream' }),
    body: toBodyArrayBuffer(update),
  });
  if (!resp.ok) {
    applyBackoffFromStatus(resp.status);
    throw new Error(`yjs append: ${resp.status}`);
  }
  return (await resp.json()) as { seq: number; createdAt: string };
}

/** Read all updates with seq > since. Auto-pages if truncated. */
export async function fetchUpdates(kind: YjsKind, parentId: string, since = 0): Promise<{ updates: YjsUpdate[]; latestSeq: number }> {
  if (Date.now() < yjsBackoffUntilMs) {
    // Backoff active — возвращаем «нет обновлений», polling продолжит
    // тикать через свой интервал, но без сетевого hop'а пока cooldown
    // не истечёт.
    return { updates: [], latestSeq: since };
  }
  const all: YjsUpdate[] = [];
  let cursor = since;
  let latest = since;

  for (let page = 0; page < 50; page++) {
    const url = `${API_BASE_URL}/api/v1/sync/yjs/${kind}/${parentId}/updates?since=${cursor}`;
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) {
      applyBackoffFromStatus(resp.status);
      throw new Error(`yjs updates: ${resp.status}`);
    }
    const j = (await resp.json()) as UpdatesResponse;
    for (const u of j.updates) {
      all.push({
        seq: u.seq,
        data: base64Decode(u.dataB64),
        originDeviceId: u.originDeviceId ?? null,
        createdAt: u.createdAt,
      });
    }
    latest = j.latestSeq > latest ? j.latestSeq : latest;
    if (!j.truncated) return { updates: all, latestSeq: latest };
    cursor = j.latestSeq;
  }
  throw new Error('yjs updates: 50 pages exhausted — server cursor not advancing');
}

/**
 * Compact: client merge'ит всю историю updates в один full-state и шлёт
 * сюда. Server атомарно: insert + DELETE всех с seq < new.seq.
 *
 * Когда вызывать: после длинной редакции (> 50-100 локальных update'ов
 * за сессию). Не на каждый keystroke — это полный snapshot, тяжёлый.
 */
export async function compact(kind: YjsKind, parentId: string, fullState: Uint8Array): Promise<{ seq: number; removed: number }> {
  if (Date.now() < yjsBackoffUntilMs) {
    throw new Error('yjs compact: backoff (server unavailable)');
  }
  const resp = await fetch(`${API_BASE_URL}/api/v1/sync/yjs/${kind}/${parentId}/compact`, {
    method: 'POST',
    headers: authHeaders({ 'content-type': 'application/octet-stream' }),
    body: toBodyArrayBuffer(fullState),
  });
  if (!resp.ok) {
    applyBackoffFromStatus(resp.status);
    // 404 может означать что compact-route не зарегистрирован на backend'е
    // (deploy mismatch). Скрытое consequence: лог растёт, но appendUpdate
    // продолжает работать. Best-effort — не блокируем edit.
    throw new Error(`yjs compact: ${resp.status}`);
  }
  return (await resp.json()) as { seq: number; removed: number };
}

// toBodyArrayBuffer — переписывает Uint8Array<ArrayBufferLike> (Yjs
// возвращает именно такой тип) в свежий ArrayBuffer. Fetch BodyInit
// принимает ArrayBuffer без проблем; Uint8Array<…ArrayBufferLike…> —
// нет (TS 5.7+ строго различает SharedArrayBuffer и ArrayBuffer).
// Копия маленькая (Yjs deltas — байты-килобайты), не критично.
function toBodyArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const buf = new ArrayBuffer(u8.byteLength);
  new Uint8Array(buf).set(u8);
  return buf;
}

// Backward-compat thin wrappers — старый код продолжает работать.
export const appendNoteUpdate = (id: string, u: Uint8Array) => appendUpdate('notes', id, u);
export const fetchNoteUpdates = (id: string, since = 0) => fetchUpdates('notes', id, since);
export const compactNote = (id: string, s: Uint8Array) => compact('notes', id, s);

// ─── Helpers ──────────────────────────────────────────────────────────────

function base64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── Y.Doc lifecycle for notes ────────────────────────────────────────────

/**
 * NoteYjsHandle — связка Y.Doc + sync-engine для одной заметки. Создаётся
 * через `attachNoteYjs(noteId, seedBodyMD)` и dispose'ится через `.close()`.
 *
 * Lifecycle (что делает inside):
 *   1. На attach: fetch /updates with since=0 → applyUpdate каждый.
 *      Если updates пусто и seedBodyMD не пустой — Y.Text задаётся
 *      seed'ом (initial migration: existing note → Yjs).
 *   2. Подписывается на ydoc.on('update'): любой local change →
 *      POST /append. Async, не блокирует UI.
 *   3. 5-second polling /updates with since=last-seq. Применяет с
 *      origin='remote' чтобы own observer не зациклился.
 *   4. На .close(): отписывается, останавливает polling, ydoc.destroy().
 *
 * Compaction: каждые 100 local appends отправляем /compact. Без этого
 * на heavy editing log растёт линейно, polling возвращает всё больше
 * данных. 100 — empirical balance: меньше = compaction давит cpu/network,
 * больше = cold-load slow.
 */
export interface YjsHandle {
  ydoc: Y.Doc;
  /** Promise that resolves когда initial fetch+apply (или seed) выполнен. */
  ready: Promise<void>;
  close: () => void;
}

/** Notes-specific handle exposes Y.Text directly for convenience. */
export interface NoteYjsHandle extends YjsHandle {
  ytext: Y.Text;
}

const COMPACT_THRESHOLD = 100;
const POLL_INTERVAL_MS = 5_000;

interface AttachOptions {
  /** Initial seed для empty server log (e.g. для миграции existing body_md в Y.Text). */
  seed?: (ydoc: Y.Doc) => void;
}

/**
 * attach — generic Yjs sync engine для (kind, parentId). Notes/whiteboards
 * используют тонкие wrapper'ы ниже.
 *
 * Lifecycle:
 *   1. fetch /updates with since=0 → applyUpdate каждый.
 *   2. Если updates пусто и есть seed callback → seed(ydoc).
 *   3. Subscribe ydoc.on('update'): local change → POST /append.
 *      Каждые COMPACT_THRESHOLD appends → POST /compact.
 *   4. 5-second polling /updates with since=last-seq → applyUpdate
 *      remote (skip own device-id).
 *   5. window 'focus' / 'online' → внеплановый poll.
 *   6. close(): final compaction если pending appends, ydoc.destroy().
 */
export function attach(kind: YjsKind, parentId: string, opts: AttachOptions = {}): YjsHandle {
  const ydoc = new Y.Doc();

  let lastSeenSeq = 0;
  let localAppendCount = 0;
  let stopped = false;
  let pollTimer: number | null = null;

  const onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote' || stopped) return;
    void appendUpdate(kind, parentId, update)
      .then(() => {
        localAppendCount++;
        if (localAppendCount >= COMPACT_THRESHOLD) {
          localAppendCount = 0;
          const fullState = Y.encodeStateAsUpdate(ydoc);
          void compact(kind, parentId, fullState).catch(() => {
            /* compaction best-effort */
          });
        }
      })
      .catch(() => {
        /* network blip — Yjs не теряет update'ы; следующий successful
           append отправит pending state */
      });
  };
  ydoc.on('update', onLocalUpdate);

  const initial = (async () => {
    try {
      const { updates, latestSeq } = await fetchUpdates(kind, parentId, 0);
      if (updates.length > 0) {
        for (const u of updates) {
          Y.applyUpdate(ydoc, u.data, 'remote');
        }
        lastSeenSeq = latestSeq;
      } else if (opts.seed) {
        opts.seed(ydoc);
      }
    } catch {
      /* Cold-start fail. Y.Doc остаётся пустым; UX continues. */
    }
  })();

  const poll = async () => {
    if (stopped) return;
    try {
      const { updates, latestSeq } = await fetchUpdates(kind, parentId, lastSeenSeq);
      const myDeviceId = (() => {
        try {
          return window.localStorage.getItem(STORAGE_KEYS.deviceId);
        } catch {
          return null;
        }
      })();
      for (const u of updates) {
        if (myDeviceId && u.originDeviceId === myDeviceId) continue;
        Y.applyUpdate(ydoc, u.data, 'remote');
      }
      if (latestSeq > lastSeenSeq) lastSeenSeq = latestSeq;
    } catch {
      /* network blip */
    }
  };

  void initial.then(() => {
    if (!stopped) {
      pollTimer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    }
  });

  const onFocus = () => void poll();
  const onOnline = () => void poll();
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);

  return {
    ydoc,
    ready: initial,
    close: () => {
      stopped = true;
      ydoc.off('update', onLocalUpdate);
      if (pollTimer !== null) window.clearInterval(pollTimer);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      if (localAppendCount > 0) {
        const fullState = Y.encodeStateAsUpdate(ydoc);
        void compact(kind, parentId, fullState).catch(() => {
          /* best-effort */
        });
      }
      ydoc.destroy();
    },
  };
}

/**
 * attachNoteYjs — convenience wrapper для notes. Создаёт Y.Text 'body' и
 * сидит её существующим body_md если server log пустой (initial Yjs
 * migration для existing notes).
 */
export function attachNoteYjs(noteId: string, seedBodyMD: string): NoteYjsHandle {
  const handle = attach('notes', noteId, {
    seed: (ydoc) => {
      if (seedBodyMD) {
        const ytext = ydoc.getText('body');
        ytext.insert(0, seedBodyMD);
      }
    },
  });
  return {
    ...handle,
    ytext: handle.ydoc.getText('body'),
  };
}

/**
 * attachWhiteboardYjs — для приватных whiteboards (single-user multi-
 * device). Excalidraw state маппится в Y.Map<shapeId, Y.Map<…>>; здесь
 * мы возвращаем просто YjsHandle и оставляем shape-mapping caller'у
 * (в WhiteboardPage будет y-excalidraw binding).
 */
export function attachWhiteboardYjs(whiteboardId: string): YjsHandle {
  return attach('whiteboards', whiteboardId);
}
