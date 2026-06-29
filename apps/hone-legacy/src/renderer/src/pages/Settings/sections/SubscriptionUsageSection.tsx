import { useEffect } from 'react';

import { QuotaUsageBar } from '../../../components/QuotaUsageBar';
import { useQuotaStore } from '../../../stores/quota';

// SubscriptionUsageSection — bars для всех subscription resource'ов
// (synced notes, shared boards, shared rooms, AI calls). Источник —
// useQuotaStore (refresh'ится из App.tsx hourly + on signin).
const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };

const tierStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  color: 'var(--ink-60)',
  marginBottom: 6,
};

export function SubscriptionUsageSection() {
  const tier = useQuotaStore((s) => s.tier);
  const refresh = useQuotaStore((s) => s.refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const tierLabel = tier === 'ascended' ? 'Ascended' : tier === 'seeker' ? 'Seeker' : 'Free';
  return (
    <div style={wrapStyle}>
      <div className="mono" style={tierStyle}>
        TIER: {tierLabel.toUpperCase()}
      </div>
      <QuotaUsageBar resource="synced_notes" variant="full" />
      <QuotaUsageBar resource="active_shared_boards" variant="full" />
      <QuotaUsageBar resource="active_shared_rooms" variant="full" />
      <QuotaUsageBar resource="ai_this_month" variant="full" />
    </div>
  );
}
