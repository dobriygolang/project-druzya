// Layout:
//   header — STATS label + range picker (7d/30d/90d)
//   row 1  — 3 KPI cards (focus today / streak / total focus time)
//   row 2  — 7-day heatmap
import React, { useMemo, useState } from 'react';

import { useT } from '@d9-i18n';

import { getStats, padToSevenDays, type HoneStats, type FocusDay } from '@features/focus/api/focusClient';
import { useDataState } from '@shared/hooks/useDataState';

type Range = '7d' | '30d' | '90d';

export const Stats: React.FC = () => {
  const [range, setRange] = useState<Range>('7d');
  const [reload, setReload] = useState(0);

  const statsState = useDataState(() => getStats(), [reload]);

  const stats: HoneStats | null = statsState.data;
  const focusDays = useMemo(() => padToSevenDays(stats?.lastSevenDays ?? []), [stats]);
  const totalFocusMin = useMemo(
    () => Math.round((stats?.totalFocusedSeconds ?? 0) / 60),
    [stats],
  );
  const focusTodayMin = useMemo(() => {
    const today = focusDays[focusDays.length - 1];
    return today ? Math.round(today.seconds / 60) : 0;
  }, [focusDays]);

  const firstError =
    statsState.status === 'error' && statsState.error ? statsState.error : null;

  return (
    <div style={shell} className="motion-page-in">
      <div style={innerWrap}>
        <Header range={range} setRange={setRange} />

        {firstError && (
          <ErrorStripe
            message={firstError.message}
            onRetry={() => setReload((n) => n + 1)}
          />
        )}

        <div style={kpiRow} className="motion-stagger">
          <KpiCard
            label="focus today"
            value={`${focusTodayMin}`}
            unit="min"
            hint={`${totalFocusMin}m total · ${range}`}
          />
          <KpiCard
            label="streak"
            value={stats ? `${stats.currentStreakDays}` : '—'}
            unit="days"
            hint={stats ? `longest ${stats.longestStreakDays}d` : ''}
          />
          <KpiCard
            label="focused"
            value={stats ? `${totalFocusMin}` : '—'}
            unit="min"
            hint="all time (window)"
          />
        </div>

        <div style={midRow} className="motion-stagger">
          <FocusHeatmap days={focusDays} />
        </div>
      </div>
    </div>
  );
};

const Header: React.FC<{
  range: Range;
  setRange: (r: Range) => void;
}> = ({ range, setRange }) => (
  <header style={headerWrap}>
    <span style={captionMonoSmall}>stats</span>
    <div role="tablist" aria-label="Date range" style={rangeBox}>
      {(['7d', '30d', '90d'] as Range[]).map((r) => (
        <button
          key={r}
          onClick={() => setRange(r)}
          role="tab"
          aria-selected={range === r}
          aria-pressed={range === r}
          className="focus-ring motion-press"
          style={{
            ...rangeBtn,
            color: range === r ? 'var(--ink)' : 'var(--ink-60)',
            background: range === r ? 'rgb(var(--ink-rgb) / 0.06)' : 'transparent',
            borderColor: range === r ? 'var(--hair-2)' : 'transparent',
          }}
        >
          {r}
        </button>
      ))}
    </div>
  </header>
);

const ErrorStripe: React.FC<{ message: string; onRetry: () => void }> = ({
  message,
  onRetry,
}) => {
  const t = useT();
  return (
    <div className="data-loader-error" style={{ marginBottom: 16 }}>
      <div className="data-loader-error-stripe" />
      <div className="data-loader-error-body">
        <div className="data-loader-error-label">{t('hone.stats.err_load_label')}</div>
        {message && <div className="data-loader-error-detail">{message}</div>}
        <button type="button" className="data-loader-error-retry focus-ring motion-press" onClick={onRetry}>
          retry
        </button>
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: string; unit: string; hint: string }> = ({
  label,
  value,
  unit,
  hint,
}) => (
  <div style={kpiCard}>
    <div style={captionMonoTiny}>{label}</div>
    <div style={{ ...kpiValue, marginTop: 8 }}>
      {value}
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-60)', marginLeft: 4 }}>{unit}</span>
    </div>
    {hint && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--ink-40)' }}>{hint}</div>}
  </div>
);

const FocusHeatmap: React.FC<{ days: FocusDay[] }> = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => d.seconds));
  return (
    <section style={card}>
      <h2 style={cardTitle}>focus · last 7 days</h2>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, marginTop: 16 }}>
        {days.map((d) => {
          const ratio = d.seconds / max;
          return (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div
                title={`${d.date} · ${Math.round(d.seconds / 60)}m`}
                style={{
                  width: '100%',
                  maxWidth: 32,
                  height: `${Math.max(8, ratio * 100)}%`,
                  minHeight: 8,
                  background: `rgb(var(--ink-rgb) / ${0.2 + ratio * 0.6})`,
                  borderRadius: 4,
                }}
              />
              <span style={{ fontFamily: monoFont, fontSize: 9, color: 'var(--ink-40)' }}>{weekdayShort(d.date)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getUTCDay()];
}

const monoFont = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const captionMonoSmall: React.CSSProperties = {
  fontFamily: monoFont,
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
};

const captionMonoTiny: React.CSSProperties = {
  fontFamily: monoFont,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
};

const shell: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflowY: 'auto',
  background: 'var(--bg)',
  color: 'var(--ink)',
  padding: '60px 28px 96px',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  letterSpacing: '-0.005em',
};

const innerWrap: React.CSSProperties = {
  maxWidth: 1280,
  margin: '0 auto',
};

const headerWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingTop: 8,
  paddingBottom: 20,
  gap: 16,
  flexWrap: 'wrap',
};

const rangeBox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: 4,
  background: 'transparent',
  border: '1px solid var(--hair-2)',
  borderRadius: 'var(--radius-inner)',
  gap: 4,
};

const rangeBtn: React.CSSProperties = {
  padding: '6px 16px',
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: '0.02em',
  borderRadius: 6,
  minWidth: 56,
  border: '1px solid transparent',
  cursor: 'pointer',
  fontFamily: monoFont,
};

const kpiRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
  marginBottom: 16,
};

const kpiCard: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--hair-2)',
  borderRadius: 'var(--radius-outer)',
  padding: 20,
  minWidth: 0,
};

const kpiValue: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 600,
  letterSpacing: '-0.018em',
  lineHeight: 1,
  color: 'var(--ink)',
};

const midRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
  gap: 16,
  marginBottom: 16,
};

const card: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--hair-2)',
  borderRadius: 'var(--radius-outer)',
  padding: 24,
  minWidth: 0,
};

const cardTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: '-0.012em',
  margin: 0,
  color: 'var(--ink)',
};

export default Stats;
