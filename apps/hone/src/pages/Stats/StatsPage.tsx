import { useCallback, useEffect, useMemo, useState } from 'react';

import { getStats, padToSevenDays, type FocusDay, type HoneStats } from '../../api/focusClient';

type Range = '7d' | '30d' | '90d';

export function StatsPage() {
  const [range, setRange] = useState<Range>('7d');
  const [stats, setStats] = useState<HoneStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await getStats());
    } catch (e) {
      setStats(null);
      setError(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const focusDays = useMemo(() => padToSevenDays(stats?.lastSevenDays ?? []), [stats]);
  const totalFocusMin = useMemo(
    () => Math.round((stats?.totalFocusedSeconds ?? 0) / 60),
    [stats],
  );
  const focusTodayMin = useMemo(() => {
    const today = focusDays[focusDays.length - 1];
    return today ? Math.round(today.seconds / 60) : 0;
  }, [focusDays]);

  return (
    <div className="stats-page fadein">
      <div className="stats-inner">
        <header className="stats-header">
          <span className="stats-caption">Stats</span>
          <div role="tablist" aria-label="Date range" className="stats-range">
            {(['7d', '30d', '90d'] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={range === r}
                className={range === r ? 'stats-range-btn active' : 'stats-range-btn'}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="stats-error">
            <p>{error}</p>
            <button type="button" className="btn-ghost" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}

        {loading && !stats && !error && <p className="stats-muted">Loading…</p>}

        {stats && (
          <>
            <div className="stats-kpi-row">
              <KpiCard
                label="Focus today"
                value={`${focusTodayMin}`}
                unit="min"
                hint={`${totalFocusMin}m total · ${range}`}
              />
              <KpiCard
                label="Streak"
                value={`${stats.currentStreakDays}`}
                unit="days"
                hint={`Longest ${stats.longestStreakDays}d`}
              />
              <KpiCard
                label="Focused"
                value={`${totalFocusMin}`}
                unit="min"
                hint="All time (window)"
              />
            </div>

            <FocusHeatmap days={focusDays} />
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
}) {
  return (
    <div className="stats-kpi">
      <div className="stats-caption">{label}</div>
      <div className="stats-kpi-value">
        {value}
        <span className="stats-kpi-unit">{unit}</span>
      </div>
      {hint && <div className="stats-kpi-hint">{hint}</div>}
    </div>
  );
}

function FocusHeatmap({ days }: { days: FocusDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.seconds));
  return (
    <section className="stats-card">
      <h2 className="stats-card-title">Focus · last 7 days</h2>
      <div className="stats-heatmap">
        {days.map((d) => {
          const ratio = d.seconds / max;
          return (
            <div key={d.date} className="stats-heatmap-col">
              <div
                className="stats-heatmap-bar"
                title={`${d.date} · ${Math.round(d.seconds / 60)}m`}
                style={{
                  height: `${Math.max(8, ratio * 100)}%`,
                  opacity: 0.2 + ratio * 0.6,
                }}
              />
              <span className="stats-heatmap-day">{weekdayShort(d.date)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][d.getUTCDay()];
}
