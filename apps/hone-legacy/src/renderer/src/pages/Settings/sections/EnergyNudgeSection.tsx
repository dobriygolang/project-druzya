// EnergyNudgeSection — soft energy-check nudge.
//
// Two controls:
//   1. Toggle «Спрашивать про энергию» — enables/disables the polling
//      scheduler в main процессе.
//   2. Interval selector (1..6 hours, default 3) — каждые N часов после
//      последнего log'а Hone шлёт тихую нотификацию.
//
// State stored on disk by main-process scheduler module
// (userData/energy_nudge.json). Same IPC-bridge pattern as DayShutdownSection.
// Quiet hours (00-08) — hardcoded в main, не настраиваются.
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useT } from '@d9-i18n';

const IPC_GET = 'energy-nudge:get-settings';
const IPC_SET = 'energy-nudge:set-settings';

interface EnergyNudgeSettings {
  enabled: boolean;
  intervalHours: number;
}

interface EnergyNudgeBridge {
  get: () => Promise<EnergyNudgeSettings>;
  set: (s: EnergyNudgeSettings) => Promise<void>;
}

function getBridge(): EnergyNudgeBridge | null {
  const ipc = window.__honeIPC;
  if (!ipc) return null;
  return {
    get: () => ipc.invoke(IPC_GET) as Promise<EnergyNudgeSettings>,
    set: (s) => ipc.invoke(IPC_SET, s) as Promise<void>,
  };
}

const DEFAULT_INTERVAL = 3;
const INTERVAL_OPTIONS = [1, 2, 3, 4, 6] as const;

const wrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };

const leadStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.55,
  color: 'var(--ink-60)',
  maxWidth: 580,
};

const noteStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--ink-40)',
  letterSpacing: '0.04em',
  padding: '6px 10px',
  border: '1px solid var(--ink-10)',
  borderRadius: 6,
};

const checkboxStyle: React.CSSProperties = { width: 16, height: 16, accentColor: '#ffffff' };

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  background: 'transparent',
  border: '1px solid var(--ink-10)',
  borderRadius: 6,
  color: 'var(--ink-90)',
  fontFamily: 'inherit',
};

export function EnergyNudgeSection() {
  const t = useT();
  const bridge = useMemo(() => getBridge(), []);
  const [enabled, setEnabled] = useState<boolean>(true);
  const [intervalHours, setIntervalHours] = useState<number>(DEFAULT_INTERVAL);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    if (!bridge) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    void bridge.get().then((s) => {
      if (cancelled) return;
      setEnabled(s.enabled);
      setIntervalHours(
        INTERVAL_OPTIONS.includes(s.intervalHours as (typeof INTERVAL_OPTIONS)[number])
          ? s.intervalHours
          : DEFAULT_INTERVAL,
      );
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  // React's batching де-facto debouncer'ит несколько setState'ов в один
  // setSettings; для toggle / select этого хватает.
  useEffect(() => {
    if (!bridge || !loaded) return;
    void bridge.set({ enabled, intervalHours });
  }, [bridge, loaded, enabled, intervalHours]);

  const onToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEnabled(e.target.checked),
    [],
  );
  const onIntervalChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setIntervalHours(Number(e.target.value)),
    [],
  );

  const toggleLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: 'var(--ink-90)',
    cursor: bridge ? 'pointer' : 'default',
  };

  const selectLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontSize: 13,
    color: 'var(--ink-90)',
    opacity: enabled && bridge ? 1 : 0.5,
  };

  return (
    <div style={wrapStyle}>
      <p style={leadStyle}>{t('hone.energy_nudge.lead')}</p>
      {!bridge && (
        <div className="mono" style={noteStyle}>
          {t('hone.energy_nudge.note_desktop_only')}
        </div>
      )}
      <label style={toggleLabelStyle}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
          disabled={!bridge}
          style={checkboxStyle}
        />
        {t('hone.energy_nudge.toggle_label')}
      </label>
      <label style={selectLabelStyle}>
        {t('hone.energy_nudge.interval_label')}
        <select
          value={intervalHours}
          onChange={onIntervalChange}
          disabled={!enabled || !bridge}
          className="focus-ring"
          style={selectStyle}
        >
          {INTERVAL_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {h}{' '}
              {h === 1
                ? t('hone.energy_nudge.hour.one')
                : h < 5
                  ? t('hone.energy_nudge.hour.few')
                  : t('hone.energy_nudge.hour.many')}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
