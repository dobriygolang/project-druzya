// quota.test.ts — Hone quota store actions + helpers.
//
// Scope:
//   • refresh() с не-залогиненным юзером → no fetch, no state change.
//   • refresh() с success response → tier / policy / usage обновляются + loaded=true.
//   • refresh() с !ok response → loaded=true, defaults сохраняются.
//   • refresh() с network throw → loaded=true, defaults сохраняются.
//   • normalizeTier через side-effect refresh() — invalid tier string → 'free'.
//   • showUpgradePrompt / dismiss и upgrade modal context actions.
//   • quotaExceededMessage — все три варианта resource'а.
//   • isQuotaExceeded — 402, 429 = true; прочие — false.
//
// Mock'и: api/config (стабилизируем API_BASE_URL), stores/session
// (контролируем accessToken), global fetch.

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../api/config', () => ({
  API_BASE_URL: 'http://test-api',
  DEV_BEARER_TOKEN: null,
  WEB_BASE_URL: 'http://test-web',
  PRO_UPGRADE_URL_BASE: 'http://test-upgrade',
  PRO_BYOK_URL: 'http://test-byok',
}));

const sessionGetState = vi.fn(() => ({ accessToken: 'tok-1' as string | null }));
vi.mock('../session', () => ({
  useSessionStore: {
    getState: () => sessionGetState(),
  },
}));

interface FetchCall {
  url: string;
  init?: RequestInit;
}

let fetchCalls: FetchCall[] = [];
let fetchImpl: () => Promise<Response>;

beforeEach(() => {
  fetchCalls = [];
  sessionGetState.mockReturnValue({ accessToken: 'tok-1' });
  // Default fetch — overridable per-test через fetchImpl.
  fetchImpl = () =>
    Promise.resolve(
      new Response(JSON.stringify({ tier: 'free' }), { status: 200, headers: { 'content-type': 'application/json' } }),
    );
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    fetchCalls.push({ url, init });
    if (url.includes('/v1/notes/meta')) {
      return Promise.resolve(
        new Response(JSON.stringify({ notes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }] }), { status: 200 }),
      );
    }
    return fetchImpl();
  }) as typeof fetch;
});

async function freshStore(): Promise<typeof import('../quota')> {
  vi.resetModules();
  return await import('../quota');
}

describe('quota.refresh — auth gate', () => {
  it('no accessToken → не делает fetch + tier остаётся free', async () => {
    sessionGetState.mockReturnValue({ accessToken: null });
    const { useQuotaStore } = await freshStore();
    await useQuotaStore.getState().refresh();
    expect(fetchCalls).toHaveLength(0);
    expect(useQuotaStore.getState().tier).toBe('free');
    expect(useQuotaStore.getState().loaded).toBe(false);
  });

  it('accessToken есть → fetch вызывается с Bearer header', async () => {
    const { useQuotaStore } = await freshStore();
    await useQuotaStore.getState().refresh();
    expect(fetchCalls.length).toBeGreaterThanOrEqual(1);
    expect(fetchCalls[0].url).toBe('http://test-api/v1/billing/me');
    const headers = fetchCalls[0].init?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer tok-1');
  });
});

describe('quota.refresh — response handling', () => {
  it('200 + payload → tier / policy / usage updated, loaded=true', async () => {
    fetchImpl = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            plan_slug: 'pro_monthly',
            limits: {
              cloud_notes_count: { limit: 100, used: 12, unlimited: false },
              live_rooms_per_month: { limit: 30, used: 2, unlimited: false },
              ai_insights_per_day: { limit: 50, used: 3, unlimited: false },
            },
          }),
          { status: 200 },
        ),
      );
    const { useQuotaStore } = await freshStore();
    await useQuotaStore.getState().refresh();
    const s = useQuotaStore.getState();
    expect(s.tier).toBe('ascended');
    expect(s.policy.synced_notes).toBe(100);
    expect(s.policy.active_shared_rooms).toBe(30);
    expect(s.policy.active_shared_boards).toBe(1); // DEFAULT merged
    expect(s.usage.synced_notes).toBe(3);
    expect(s.usage.active_shared_rooms).toBe(2);
    expect(s.usage.ai_this_month).toBe(3);
    expect(s.loaded).toBe(true);
  });

  it('ascended tier через pro plan slug', async () => {
    fetchImpl = () =>
      Promise.resolve(new Response(JSON.stringify({ plan_slug: 'pro_monthly' }), { status: 200 }));
    const { useQuotaStore } = await freshStore();
    await useQuotaStore.getState().refresh();
    expect(useQuotaStore.getState().tier).toBe('ascended');
  });

  it('non-canonical tier → normalize в free', async () => {
    fetchImpl = () =>
      Promise.resolve(new Response(JSON.stringify({ plan_slug: 'mystery-tier' }), { status: 200 }));
    const { useQuotaStore } = await freshStore();
    await useQuotaStore.getState().refresh();
    expect(useQuotaStore.getState().tier).toBe('free');
  });

  it('500 response → defaults сохраняются, loaded=true', async () => {
    fetchImpl = () => Promise.resolve(new Response('boom', { status: 500 }));
    const { useQuotaStore } = await freshStore();
    await useQuotaStore.getState().refresh();
    const s = useQuotaStore.getState();
    expect(s.tier).toBe('free');
    expect(s.policy.synced_notes).toBe(10);
    expect(s.loaded).toBe(true);
  });

  it('network throw → loaded=true, defaults остаются', async () => {
    fetchImpl = () => Promise.reject(new Error('network'));
    const { useQuotaStore } = await freshStore();
    await useQuotaStore.getState().refresh();
    const s = useQuotaStore.getState();
    expect(s.tier).toBe('free');
    expect(s.loaded).toBe(true);
  });
});

describe('quota — upgrade prompt / modal actions', () => {
  it('showUpgradePrompt / dismissUpgradePrompt toggles message', async () => {
    const { useQuotaStore } = await freshStore();
    useQuotaStore.getState().showUpgradePrompt('limit reached');
    expect(useQuotaStore.getState().upgradePromptMessage).toBe('limit reached');
    useQuotaStore.getState().dismissUpgradePrompt();
    expect(useQuotaStore.getState().upgradePromptMessage).toBeNull();
  });

  it('showUpgradeModal заменяет previous context', async () => {
    const { useQuotaStore } = await freshStore();
    useQuotaStore.getState().showUpgradeModal({
      feature: 'unlimited_mock',
      label: 'unlimited mocks',
      benefit: 'unlimited 5-stage mocks',
    });
    expect(useQuotaStore.getState().upgradeModalContext?.feature).toBe('unlimited_mock');

    useQuotaStore.getState().showUpgradeModal({
      feature: 'long_session',
      label: 'long sessions',
      benefit: '4-hour sessions',
      liftStat: '30% retention',
    });
    expect(useQuotaStore.getState().upgradeModalContext?.feature).toBe('long_session');
    expect(useQuotaStore.getState().upgradeModalContext?.liftStat).toBe('30% retention');
  });

  it('dismissUpgradeModal → null', async () => {
    const { useQuotaStore } = await freshStore();
    useQuotaStore.getState().showUpgradeModal({
      feature: 'x',
      label: 'x',
      benefit: 'x',
    });
    useQuotaStore.getState().dismissUpgradeModal();
    expect(useQuotaStore.getState().upgradeModalContext).toBeNull();
  });
});

describe('quota — helpers', () => {
  it('quotaExceededMessage returns distinct strings per resource', async () => {
    const { quotaExceededMessage } = await freshStore();
    const note = quotaExceededMessage('note');
    const board = quotaExceededMessage('board');
    const room = quotaExceededMessage('room');
    expect(note).toContain('synced notes');
    expect(board).toContain('shared board');
    expect(room).toContain('code-room');
    expect(note).not.toBe(board);
    expect(board).not.toBe(room);
  });

  it('isQuotaExceeded: 402 и 429 → true; 200/500 → false', async () => {
    const { isQuotaExceeded } = await freshStore();
    expect(isQuotaExceeded(new Response('', { status: 402 }))).toBe(true);
    expect(isQuotaExceeded(new Response('', { status: 429 }))).toBe(true);
    expect(isQuotaExceeded(new Response('', { status: 200 }))).toBe(false);
    expect(isQuotaExceeded(new Response('', { status: 500 }))).toBe(false);
    expect(isQuotaExceeded(new Response('', { status: 403 }))).toBe(false);
  });
});
