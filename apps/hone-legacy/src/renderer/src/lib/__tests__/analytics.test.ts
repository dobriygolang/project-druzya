// analytics.test.ts — analytics client (PII sanitisation + opt-in gating +
// init + setOptedIn flow).
//
// Scope:
//   • track() до init() — no-op (events не идут в trackEvent).
//   • track() после init({optedIn:false}) — no-op.
//   • track() с init({optedIn:true}) — delegates в trackEvent.
//   • PII guard: email / phone / JWT-shaped values отбрасываются.
//   • String values > 512 chars обрезаются до 512.
//   • Non-primitive values (objects / arrays / null / undefined) отброшены.
//   • setOptedIn пишет в localStorage и меняет gate.
//   • init без opts.optedIn читает stored value.
//   • getUserId / isOptedIn геттеры.
//
// Не тестим: callBackendConsent — это IO в Connect-RPC, не unit-scope.
// Lazy-import паттерн там сам swallow'ит errors.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const trackEventMock = vi.fn();
vi.mock('../../api/events', () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

// In-memory localStorage shim — happy-dom Proxy ненадёжен после restoreAllMocks.
class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, String(v));
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
  clear(): void {
    this.data.clear();
  }
  get length(): number {
    return this.data.size;
  }
  key(i: number): string | null {
    return Array.from(this.data.keys())[i] ?? null;
  }
}
const mem = new MemoryStorage();
Object.defineProperty(window, 'localStorage', { configurable: true, get: () => mem });

async function freshClient(): Promise<typeof import('../analytics')> {
  vi.resetModules();
  return await import('../analytics');
}

beforeEach(() => {
  trackEventMock.mockReset();
  mem.clear();
});

describe('analytics — opt-in gating', () => {
  it('track() до init → no trackEvent call', async () => {
    const { analytics } = await freshClient();
    analytics.track('focus_session_started');
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it('init({optedIn:false}) → track ничего не отправляет', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1', optedIn: false });
    analytics.track('focus_session_started', { surface: 'hone' });
    expect(trackEventMock).not.toHaveBeenCalled();
  });

  it('init({optedIn:true}) → track делает delegate', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1', optedIn: true });
    analytics.track('focus_session_started', { surface: 'hone' });
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    expect(trackEventMock).toHaveBeenCalledWith('focus_session_started', expect.objectContaining({ surface: 'hone' }));
  });

  it('init() без явного optedIn — Hone default = true', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1' });
    expect(analytics.isOptedIn()).toBe(true);
    analytics.track('focus_session_started');
    expect(trackEventMock).toHaveBeenCalledTimes(1);
  });

  it('init() без явного optedIn читает stored "false"', async () => {
    mem.setItem('druz9:analytics-opted-in:v1', 'false');
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1' });
    expect(analytics.isOptedIn()).toBe(false);
    analytics.track('focus_session_started');
    expect(trackEventMock).not.toHaveBeenCalled();
  });
});

describe('analytics — setOptedIn', () => {
  it('persists в localStorage', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1', optedIn: true });
    analytics.setOptedIn(false);
    expect(mem.getItem('druz9:analytics-opted-in:v1')).toBe('false');
    expect(analytics.isOptedIn()).toBe(false);
  });

  it('после setOptedIn(false) track становится no-op', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1', optedIn: true });
    analytics.track('focus_session_started');
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    analytics.setOptedIn(false);
    analytics.track('focus_session_completed');
    expect(trackEventMock).toHaveBeenCalledTimes(1); // no new call
  });
});

describe('analytics — PII sanitization', () => {
  it('drops email-like values', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1', optedIn: true });
    analytics.track('test', {
      surface: 'hone',
      contact: 'user@example.com',
    });
    expect(trackEventMock).toHaveBeenCalledTimes(1);
    const props = trackEventMock.mock.calls[0][1] as Record<string, unknown>;
    expect(props.surface).toBe('hone');
    expect(props.contact).toBeUndefined();
  });

  it('drops phone-like values', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1', optedIn: true });
    analytics.track('test', { phone: '+12025551234' });
    const props = trackEventMock.mock.calls[0][1] as Record<string, unknown>;
    expect(props.phone).toBeUndefined();
  });

  it('drops JWT-shaped tokens', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1', optedIn: true });
    analytics.track('test', { token: 'eyJabc.eyJdef.signaturepart' });
    const props = trackEventMock.mock.calls[0][1] as Record<string, unknown>;
    expect(props.token).toBeUndefined();
  });

  it('truncates string > 512 chars', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1', optedIn: true });
    const long = 'a'.repeat(800);
    analytics.track('test', { long });
    const props = trackEventMock.mock.calls[0][1] as Record<string, unknown>;
    expect(typeof props.long).toBe('string');
    expect((props.long as string).length).toBe(512);
  });

  it('keeps booleans + numbers + short strings', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'u1', optedIn: true });
    analytics.track('test', { count: 7, ok: true, kind: 'note' });
    const props = trackEventMock.mock.calls[0][1] as Record<string, unknown>;
    expect(props.count).toBe(7);
    expect(props.ok).toBe(true);
    expect(props.kind).toBe('note');
  });
});

describe('analytics — getUserId', () => {
  it('null до init', async () => {
    const { analytics } = await freshClient();
    expect(analytics.getUserId()).toBeNull();
  });

  it('returns userId после init', async () => {
    const { analytics } = await freshClient();
    analytics.init({ userId: 'sergey-1', optedIn: true });
    expect(analytics.getUserId()).toBe('sergey-1');
  });
});

describe('analytics — exports', () => {
  it('ANALYTICS_EVENTS exposes canonical taxonomy', async () => {
    const { ANALYTICS_EVENTS } = await freshClient();
    expect(ANALYTICS_EVENTS.focus_session_started).toBe('focus_session.started');
    expect(ANALYTICS_EVENTS.coach_next_action_viewed).toBe('coach.next_action.viewed');
  });
});
