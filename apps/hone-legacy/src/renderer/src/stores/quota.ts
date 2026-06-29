// Quota store — tier + usage for Hone upgrade prompts.
//
// Backend: GET /v1/billing/me (project-druzya billing service).
import { create } from 'zustand';

import { API_BASE_URL, DEV_BEARER_TOKEN } from '../api/config';
import { useSessionStore } from './session';

export type Tier = 'free' | 'seeker' | 'ascended';

export interface QuotaPolicy {
  synced_notes: number;
  active_shared_boards: number;
  active_shared_rooms: number;
  shared_ttl_seconds: number;
  ai_monthly: number;
}

export interface QuotaUsage {
  synced_notes: number;
  active_shared_boards: number;
  active_shared_rooms: number;
  ai_this_month: number;
}

export interface UpgradeContext {
  feature: string;
  label: string;
  benefit: string;
  liftStat?: string;
  byokAvailable?: boolean;
}

interface QuotaState {
  tier: Tier;
  policy: QuotaPolicy;
  usage: QuotaUsage;
  loaded: boolean;
  upgradePromptMessage: string | null;
  upgradeModalContext: UpgradeContext | null;
  refresh: () => Promise<void>;
  showUpgradePrompt: (msg: string) => void;
  dismissUpgradePrompt: () => void;
  showUpgradeModal: (ctx: UpgradeContext) => void;
  dismissUpgradeModal: () => void;
}

const DEFAULT_POLICY: QuotaPolicy = {
  synced_notes: 10,
  active_shared_boards: 1,
  active_shared_rooms: 1,
  shared_ttl_seconds: 24 * 3600,
  ai_monthly: -1,
};

const DEFAULT_USAGE: QuotaUsage = {
  synced_notes: 0,
  active_shared_boards: 0,
  active_shared_rooms: 0,
  ai_this_month: 0,
};

export const useQuotaStore = create<QuotaState>((set) => ({
  tier: 'free',
  policy: DEFAULT_POLICY,
  usage: DEFAULT_USAGE,
  loaded: false,
  upgradePromptMessage: null,
  upgradeModalContext: null,
  refresh: async () => {
    try {
      const token = useSessionStore.getState().accessToken ?? DEV_BEARER_TOKEN;
      if (!token) {
        return;
      }
      const resp = await fetch(`${API_BASE_URL}/v1/billing/me`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        set({ loaded: true });
        return;
      }
      const j = (await resp.json()) as {
        planSlug?: string;
        plan_slug?: string;
        limits?: Record<string, { limit?: number; used?: number; unlimited?: boolean }>;
      };
      const planSlug = j.planSlug ?? j.plan_slug ?? 'free';
      const limits = j.limits ?? {};
      let syncedNotesUsed = usedFromEntitlement(limits, 'cloud_notes_count');
      try {
        const metaResp = await fetch(`${API_BASE_URL}/v1/notes/meta`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (metaResp.ok) {
          const meta = (await metaResp.json()) as { notes?: unknown[] };
          syncedNotesUsed = meta.notes?.length ?? syncedNotesUsed;
        }
      } catch {
        /* notes service optional offline */
      }
      set({
        tier: normalizeTier(planSlug),
        policy: {
          ...DEFAULT_POLICY,
          synced_notes: limitFromEntitlement(limits, 'cloud_notes_count', DEFAULT_POLICY.synced_notes),
          active_shared_rooms: limitFromEntitlement(limits, 'live_rooms_per_month', DEFAULT_POLICY.active_shared_rooms),
        },
        usage: {
          ...DEFAULT_USAGE,
          synced_notes: syncedNotesUsed,
          active_shared_rooms: usedFromEntitlement(limits, 'live_rooms_per_month'),
          ai_this_month: usedFromEntitlement(limits, 'ai_insights_per_day'),
        },
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },
  showUpgradePrompt: (msg: string) => set({ upgradePromptMessage: msg }),
  dismissUpgradePrompt: () => set({ upgradePromptMessage: null }),
  showUpgradeModal: (ctx: UpgradeContext) => set({ upgradeModalContext: ctx }),
  dismissUpgradeModal: () => set({ upgradeModalContext: null }),
}));

function normalizeTier(planSlug: string): Tier {
  const s = planSlug.toLowerCase();
  if (s.includes('pro') || s.includes('ascended') || s.includes('seeker')) {
    return 'ascended';
  }
  return 'free';
}

function limitFromEntitlement(
  limits: Record<string, { limit?: number; unlimited?: boolean }>,
  key: string,
  fallback: number,
): number {
  const spec = limits[key];
  if (!spec) return fallback;
  if (spec.unlimited) return -1;
  return spec.limit ?? fallback;
}

function usedFromEntitlement(
  limits: Record<string, { used?: number }>,
  key: string,
): number {
  return limits[key]?.used ?? 0;
}

export function quotaExceededMessage(resource: 'note' | 'board' | 'room'): string {
  switch (resource) {
    case 'note':
      return "You've reached your free-tier limit on synced notes. Upgrade to Pro for unlimited cross-device sync.";
    case 'board':
      return 'Free tier allows 1 shared board. Upgrade to Pro for more.';
    case 'room':
      return 'Free tier allows limited shared code-rooms. Upgrade to Pro for more.';
    default: {
      const _exhaustive: never = resource;
      throw new Error(`Unhandled resource: ${String(_exhaustive)}`);
    }
  }
}

export function isQuotaExceeded(resp: Response): boolean {
  return resp.status === 402 || resp.status === 429;
}
