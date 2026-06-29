// api/events.ts — opt-in product analytics для Hone.
//
// Buffer pattern: events copятся в memory queue, flush'ятся каждые 30s
// или при достижении BATCH_SIZE (10). Нет outbox / persistence через
// reload — telemetry эфемерны (если юзер закрыл окно до flush'а — events
// потеряны, но это acceptable: 30s window коротко).
//
// Privacy guard: properties — сlient-supplied, **no PII должен туда
// попадать**. Helpers ниже принимают только примитивы (string|number|bool),
// caller'ы писать только non-identifying signal (page name, command id,
// kind, action). Email / token / note title / message text — НЕ передавать.
//
// Usage:
//   import { trackEvent } from '../api/events';
//   trackEvent('palette_open');
//   trackEvent('coach_fork_pick', { branch: 'algo' });
//
// Best-effort: errors swallowed. Если backend down → events потеряны (это
// telemetry, не state).
import { createPromiseClient } from '@connectrpc/connect';
import { TelemetryService } from '@generated/pb/druz9/v1/telemetry_connect';
import { Timestamp } from '@bufbuild/protobuf';

import { transport } from './transport';

// ─── Configuration ────────────────────────────────────────────────────────

const SURFACE = 'hone';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30_000;

// ─── Types ────────────────────────────────────────────────────────────────

type PropValue = string | number | boolean;

interface QueuedEvent {
  name: string;
  occurredAt: Date;
  properties: Record<string, string>;
}

// ─── Module state ─────────────────────────────────────────────────────────

const queue: QueuedEvent[] = [];
let flushTimer: number | null = null;
let installed = false;

const client = createPromiseClient(TelemetryService, transport);

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * trackEvent — записать event в queue. Flush'ится автоматически через 30s
 * или при достижении BATCH_SIZE.
 *
 * Convention для name: snake_case, ≤64 chars. Канон:
 *   page_view, palette_open, palette_select, note_create, note_publish,
 *   focus_start, focus_end, coach_fork_pick, taskboard_status_change,
 *   english_vocab_due_open. Новый event — добавь сюда + grep callers.
 */
export function trackEvent(name: string, properties?: Record<string, PropValue>): void {
  if (typeof window === 'undefined') return; // SSR safety
  const props: Record<string, string> = {};
  if (properties) {
    for (const [k, v] of Object.entries(properties)) {
      props[k] = String(v);
    }
  }
  queue.push({
    name,
    occurredAt: new Date(),
    properties: props,
  });
  if (queue.length >= BATCH_SIZE) {
    void flush();
  }
}

/**
 * installTelemetryAutoFlush — wire periodic flush + flush-on-pagehide.
 * Idempotent — повторный вызов no-op. Call'ить из App.tsx bootstrap'а
 * один раз.
 */
export function installTelemetryAutoFlush(): void {
  if (installed) return;
  installed = true;
  if (typeof window === 'undefined') return;
  flushTimer = window.setInterval(() => {
    void flush();
  }, FLUSH_INTERVAL_MS);
  // pagehide event срабатывает на close / reload — last chance flush'ить
  // pending events. Используем sendBeacon-like подход: event-loop умрёт
  // раньше чем await завершится, но flush() запустит fetch который
  // браузер постарается завершить.
  window.addEventListener('pagehide', () => {
    void flush();
  });
}

async function flush(): Promise<void> {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  try {
    await client.recordEvents({
      events: batch.map((ev) => ({
        name: ev.name,
        surface: SURFACE,
        occurredAt: Timestamp.fromDate(ev.occurredAt),
        properties: ev.properties,
      })),
    });
  } catch {
    // Best-effort: events потеряны при network/server error. Не re-queue
    // — иначе при длинном offline period queue вырастет неограниченно.
    // Telemetry — sampled signal, не critical state.
  }
}

// Test-only export — не использовать из app code.
export function _resetTelemetryForTests(): void {
  queue.length = 0;
  if (flushTimer !== null) {
    window.clearInterval(flushTimer);
    flushTimer = null;
  }
  installed = false;
}
