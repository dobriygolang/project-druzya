// analytics.ts — opt-in product analytics client for Hone (desktop).
//
// `api/events.ts` with the spec API shape mirrored across 3 surfaces
// (web/hone/cue). Hone уже имеет working trackEvent + auto-flush через
// Connect transport (better than fetch due to typed errors); этот файл
// просто provides the `analytics.init / analytics.track / analytics.
// setOptedIn` interface to keep call sites identical across products.
//
// Privacy model (Hone):
//   - Hone default: opted-IN (desktop user explicitly installed the app —
//     trust gradient is higher than anonymous web visitor). Settings
//     toggle сразу видим и легко отключаем.
//   - localStorage caches consent decision; backend SetConsent ставит
//     server-side flag для cross-device sync.
//   - PII sanitization (emails / phones / tokens) — drops before queueing.
//
// Surface defaults derived from telemetry.proto comments:
//   hone/web = opt-in-with-prompt; cue = opt-out (stealth product).
import { trackEvent } from '../api/events';
import { ANALYTICS_EVENTS, type AnalyticsEvent } from './analytics-events';

const STORAGE_KEY = 'druz9:analytics-opted-in:v1';
const SURFACE = 'hone' as const;

type PropValue = string | number | boolean;

// PII guard mirrors web client. Кеппим locally для consistent behaviour;
// existing api/events.ts уже принимает только primitives, но не отрубает
// emails / tokens, поэтому слой нужен.
const PII_REGEX = /\b[\w.+-]+@[\w.-]+\.\w{2,}\b|\b\+?\d{10,}\b|eyJ[\w-]+\.[\w-]+\.[\w-]+/i;

function sanitize(props: Record<string, unknown>): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue;
    const str = String(v);
    if (PII_REGEX.test(str)) continue;
    out[k] = typeof v === 'string' && str.length > 512 ? str.slice(0, 512) : v;
  }
  return out;
}

class AnalyticsClient {
  private optedIn = true; // Hone default: opt-in (user installed the app).
  private userId: string | null = null;
  private initialized = false;

  init(opts: { userId: string; optedIn?: boolean }): void {
    this.userId = opts.userId;
    if (typeof opts.optedIn === 'boolean') {
      this.optedIn = opts.optedIn;
    } else {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        // Hone default: opted-IN. Only flip to false if user explicitly turned it off.
        this.optedIn = stored === null ? true : stored === 'true';
      } catch {
        this.optedIn = true;
      }
    }
    this.initialized = true;
  }

  setOptedIn(opted: boolean): void {
    this.optedIn = opted;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(opted));
    } catch {
      /* private mode */
    }
    void this.callBackendConsent(opted);
  }

  isOptedIn(): boolean {
    return this.optedIn;
  }

  /**
   * Bound user id, or null до init(). Mirrors web client surface so
   * cross-product call sites can branch on «logged-in?» without each
   * pulling из useSessionStore separately.
   */
  getUserId(): string | null {
    return this.userId;
  }

  /**
   * track — delegate to legacy trackEvent (Connect-RPC + batching).
   * Sanitization runs first so PII never reaches the queue.
   */
  track(event: AnalyticsEvent | string, properties: Record<string, PropValue> = {}): void {
    if (!this.optedIn) return;
    if (!this.initialized) return;
    trackEvent(event, sanitize(properties));
  }

  private async callBackendConsent(opted: boolean): Promise<void> {
    try {
      // Lazy-import the Connect client из existing transport — avoids
      // double-tap initialization of generated code at module load.
      const { createPromiseClient } = await import('@connectrpc/connect');
      const { TelemetryService } = await import('@generated/pb/druz9/v1/telemetry_connect');
      const { transport } = await import('../api/transport');
      const client = createPromiseClient(TelemetryService, transport);
      await client.setConsent({
        surface: SURFACE,
        optedIn: opted,
        consentVersion: 1,
      });
    } catch {
      /* best-effort */
    }
  }
}

export const analytics = new AnalyticsClient();
export { ANALYTICS_EVENTS };
export type { AnalyticsEvent };
