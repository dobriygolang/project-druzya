// QuotaUsageBar — компактный «3 / 10» индикатор с прогресс-полоской.
//
// Используется:
//   - Sidebar в Notes / SharedBoards / CodeRooms (variant="compact")
//   - Settings → Subscription (variant="full" с подписью)
import { memo, useMemo, type CSSProperties } from 'react';

import { useQuotaStore, type QuotaPolicy, type QuotaUsage } from '../stores/quota';

type QuotaResource = 'synced_notes' | 'active_shared_boards' | 'active_shared_rooms' | 'ai_this_month';

const LABELS: Record<QuotaResource, string> = {
  synced_notes: 'Synced notes',
  active_shared_boards: 'Shared boards',
  active_shared_rooms: 'Shared rooms',
  ai_this_month: 'AI calls this month',
};

const COMPACT_PREFIX: Record<QuotaResource, string> = {
  synced_notes: 'SYNCED',
  active_shared_boards: 'SHARED',
  active_shared_rooms: 'SHARED',
  ai_this_month: 'AI',
};

const COMPACT_PREFIX_STYLE: CSSProperties = { opacity: 0.45, marginRight: 6 };
const COMPACT_DENOM_STYLE: CSSProperties = { opacity: 0.5 };
const COMPACT_OVER_STYLE: CSSProperties = { opacity: 0.7 };
const COMPACT_BAR_OUTER_STYLE: CSSProperties = {
  flex: 1,
  height: 2,
  borderRadius: 1,
  background: 'var(--ink-tint-06)',
  position: 'relative',
  overflow: 'hidden',
};

const FULL_ROOT_STYLE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' };
const FULL_HEADER_STYLE: CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-90)' };
const FULL_BAR_OUTER_STYLE: CSSProperties = {
  height: 4,
  borderRadius: 2,
  background: 'var(--ink-tint-06)',
  position: 'relative',
  overflow: 'hidden',
};

const FULL_HINT_STYLE: CSSProperties = { fontSize: 11, color: 'var(--ink-40)', marginTop: 2 };

const FULL_BUTTON_STYLE: CSSProperties = {
  width: '100%',
  padding: 0,
  background: 'transparent',
  border: 0,
  textAlign: 'left',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
};

interface QuotaUsageBarProps {
  resource: QuotaResource;
  variant?: 'compact' | 'full';
}

export const QuotaUsageBar = memo(function QuotaUsageBar({ resource, variant = 'compact' }: QuotaUsageBarProps) {
  const policy = useQuotaStore((s) => s.policy);
  const usage = useQuotaStore((s) => s.usage);

  const { used, limit, isUnlimited, pct, color, overLimit } = useMemo(() => {
    const usedV = readUsage(usage, resource);
    const limitV = readPolicyLimit(policy, resource);
    const unlimited = limitV < 0;
    const pctV = unlimited ? 0 : limitV === 0 ? 0 : Math.min(100, (usedV / limitV) * 100);
    const colorV =
      pctV >= 100
        ? 'var(--red)'
        : pctV >= 80
        ? 'var(--ink)'
        : 'var(--ink-60)';
    const overV = !unlimited && limitV > 0 && usedV > limitV;
    return { used: usedV, limit: limitV, isUnlimited: unlimited, pct: pctV, color: colorV, overLimit: overV };
  }, [usage, policy, resource]);

  const nearOrOver = !isUnlimited && (overLimit || pct >= 80);

  const onUpgradeClick = () => {
    void import('./UpgradeModal').then(({ requestUpgrade }) => {
      requestUpgrade(upgradeContextFor(resource));
    });
  };

  if (variant === 'compact') {
    const title = isUnlimited
      ? `${LABELS[resource]}: ${used} (unlimited)`
      : overLimit
        ? `${LABELS[resource]}: ${used} (over limit ${limit} — upgrade)`
        : `${LABELS[resource]}: ${used} / ${limit}`;

    return (
      <div
        className="mono"
        title={title}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          fontSize: 9,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color,
        }}
      >
        <span>
          <span style={COMPACT_PREFIX_STYLE}>{COMPACT_PREFIX[resource]}</span>
          {used}
          {!isUnlimited && !overLimit && <span style={COMPACT_DENOM_STYLE}>{` / ${limit}`}</span>}
          {overLimit && <span style={COMPACT_OVER_STYLE}>{` · OVER LIMIT ${limit}`}</span>}
        </span>
        {!isUnlimited && (
          <div aria-hidden style={COMPACT_BAR_OUTER_STYLE}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: `${pct}%`,
                background: color,
                transition: 'width var(--motion-dur-medium) var(--motion-ease-standard), background-color var(--motion-dur-medium) var(--motion-ease-standard)',
              }}
            />
          </div>
        )}
      </div>
    );
  }

  const fullInner = (
    <div style={FULL_ROOT_STYLE}>
      <div style={FULL_HEADER_STYLE}>
        <span>{LABELS[resource]}</span>
        <span className="mono" style={{ color }}>
          {used}
          {!isUnlimited && !overLimit && <span style={COMPACT_DENOM_STYLE}>{` / ${limit}`}</span>}
          {overLimit && <span style={COMPACT_OVER_STYLE}>{` · over limit ${limit}`}</span>}
          {isUnlimited && <span style={COMPACT_DENOM_STYLE}> (unlimited)</span>}
        </span>
      </div>
      {!isUnlimited && (
        <div aria-hidden style={FULL_BAR_OUTER_STYLE}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${pct}%`,
              background: color,
              transition: 'width var(--motion-dur-medium) var(--motion-ease-standard), background-color var(--motion-dur-medium) var(--motion-ease-standard)',
            }}
          />
        </div>
      )}
      {nearOrOver && (
        <div style={FULL_HINT_STYLE}>
          {overLimit ? 'Over free-tier limit · click to upgrade' : 'Approaching limit · upgrade to Pro'}
        </div>
      )}
    </div>
  );
  if (!nearOrOver) return fullInner;
  return (
    <button
      type="button"
      onClick={onUpgradeClick}
      className="focus-ring"
      style={FULL_BUTTON_STYLE}
    >
      {fullInner}
    </button>
  );
});

function upgradeContextFor(r: QuotaResource): { feature: string; label: string; benefit: string } {
  switch (r) {
    case 'synced_notes':
      return {
        feature: 'cross_device_sync',
        label: 'synced notes',
        benefit:
          'Pro lifts the synced-notes cap and keeps notes mirrored across desktop and other devices.',
      };
    case 'active_shared_boards':
      return {
        feature: 'cross_device_sync',
        label: 'shared boards',
        benefit:
          'Pro raises the live-room cap so you can pair-program more often each month.',
      };
    case 'active_shared_rooms':
      return {
        feature: 'cross_device_sync',
        label: 'shared code-rooms',
        benefit:
          'Pro keeps code-rooms always-on and bumps the cap so you can pair-program without 24-hour share-windows expiring.',
      };
    case 'ai_this_month':
      return {
        feature: 'llm_unlimited',
        label: 'AI calls this month',
        benefit:
          'Pro removes the monthly AI-call cap and routes you through the priority Cerebras/Groq cascade for sharper, faster answers.',
      };
  }
}

function readUsage(u: QuotaUsage, r: QuotaResource): number {
  switch (r) {
    case 'synced_notes': return u.synced_notes;
    case 'active_shared_boards': return u.active_shared_boards;
    case 'active_shared_rooms': return u.active_shared_rooms;
    case 'ai_this_month': return u.ai_this_month;
  }
}

function readPolicyLimit(p: QuotaPolicy, r: QuotaResource): number {
  switch (r) {
    case 'synced_notes': return p.synced_notes;
    case 'active_shared_boards': return p.active_shared_boards;
    case 'active_shared_rooms': return p.active_shared_rooms;
    case 'ai_this_month': return p.ai_monthly;
  }
}
